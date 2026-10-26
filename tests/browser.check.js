import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const moduleName = process.env.HILFER_PLAYWRIGHT_MODULE;
const { chromium } = await import(moduleName ? pathToFileURL(moduleName).href : 'playwright');
const browser = await chromium.launch({headless:true, channel:'msedge'});
const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const target = process.env.HILFER_URL || 'http://127.0.0.1:8080';

try {
  await page.goto(target);
  await page.waitForFunction(() => window.hilfer);
  const report = page.locator('[data-report-section="CASE-001"]');
  await page.locator('[data-open="reconciliation"]').first().click();
  assert.equal(await page.locator('#report-tab').getAttribute('aria-selected'), 'true');
  assert.match(await report.textContent(), /AVAILABLE|HR-014|UNVERIFIED/);
  assert.doesNotMatch(await report.textContent(), /OH-008|NOT_CLEARED/);

  // Records is investigative: merely listing files does not attach or reconcile them.
  await page.locator('[data-open="records"]').first().click();
  assert.deepEqual(await page.evaluate(() => hilfer.getState().completedCaseIds), []);
  await page.locator('[data-file-id="HR-014"]').click();
  assert.equal(await page.locator('.claim-source').count(), 1);
  await page.locator('.claim-source').click();
  assert.equal(await page.locator('.claim-compare').count(), 1);
  assert.match(await page.locator('.claim-compare').textContent(), /EXISTING ENTRY/);
  assert.equal(await page.locator('.claim-apply').count(), 0, 'baseline alone cannot complete a case');
  assert.deepEqual(await page.evaluate(() => hilfer.getState().completedCaseIds), []);

  await page.locator('[data-open="records"]').first().click();
  await page.locator('[data-file-id="OH-008"]').click();
  assert.match(await page.locator('.medical-document').textContent(), /NOT_ESTABLISHED/);
  await page.locator('.claim-source').click();
  assert.match(await page.locator('.claim-compare').textContent(), /AVAILABLE|NOT_CLEARED|OH-008/);
  await page.locator('[data-dismiss-claim]').click();
  assert.deepEqual(await page.evaluate(() => hilfer.getState().completedCaseIds), [], 'keeping baseline remains unresolved');
  await page.locator('[data-open="records"]').first().click();
  await page.locator('.claim-source').click();

  await page.evaluate(() => {
    window.milestones = [];
    hilfer.onEvent(({type}) => window.milestones.push(type));
  });
  await page.locator('.claim-apply').click();
  await page.waitForFunction(() => window.hilfer.getState().completedCaseIds.includes('CASE-001'));
  assert.equal(await page.locator('#report-tab').getAttribute('aria-selected'), 'true');
  assert.match(await report.textContent(), /RECONCILED|NOT_CLEARED|OH-008|NOT_ESTABLISHED/);
  assert.deepEqual(await page.evaluate(() => hilfer.getState().attachedEvidence['CASE-001']), ['HR-014','OH-008']);
  assert.equal(await page.evaluate(() => hilfer.getState().distortionLevel), 1);
  assert.equal(await page.evaluate(() => milestones.filter(x => x === 'hilfer:case-reconciled').length), 1);
  await page.screenshot({path:process.env.HILFER_SCREENSHOT || join(tmpdir(), 'hilfer-claim-based.png')});

  await page.locator('[data-open-record="OH-008"]').first().click();
  assert.equal(await page.locator('#preview-reference').textContent(), 'OH-008 / EMP-JESSICA');
  await page.reload(); await page.waitForFunction(() => window.hilfer);
  assert.equal(await page.evaluate(() => hilfer.getState().distortionLevel), 1);
  assert.match(await page.locator('[data-report-section="CASE-001"]').textContent(), /NOT_CLEARED/);
  await page.locator('.start-button').click();
  await page.locator('#reset-progress').click();
  assert.equal(await page.evaluate(() => hilfer.getState().completedCaseIds.length), 0);
  assert.equal(await page.evaluate(() => hilfer.getState().distortionLevel), 0);
  await page.locator('[data-open="reconciliation"]').first().click();
  assert.match(await page.locator('[data-report-section="CASE-001"]').textContent(), /AVAILABLE|UNVERIFIED/);
  assert.deepEqual(errors, [], 'no browser page errors');
  console.log('PASS: claim comparison, report, persistence, reset, art and window bridge');
} finally {
  await browser.close();
}
