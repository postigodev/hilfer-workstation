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
  for (const text of ['Available for duty', 'Human Resources', 'Unverified']) assert.ok((await report.textContent()).includes(text));
  assert.doesNotMatch(await report.textContent(), /OH-008|NOT_CLEARED/);
  assert.equal(await page.locator('[data-report-section="CASE-002"]').count(), 0);
  assert.doesNotMatch(await report.innerText(), /EMP-JESSICA|AVAILABLE|CASE-001/);
  assert.equal(await report.locator('details').getAttribute('open'), null);

  // Records is investigative: merely listing files does not attach or reconcile them.
  await page.locator('[data-open="records"]').first().click();
  assert.deepEqual(await page.evaluate(() => hilfer.getState().completedCaseIds), []);
  assert.match(await page.locator('[data-file-id="HR-014"]').innerText(), /Jessica — Personnel File/);
  await page.locator('#records-search').fill('HR-014');
  assert.equal(await page.locator('[data-file-id]').count(), 1);
  await page.locator('#clear-search').click();
  await page.locator('[data-file-id="HR-014"]').click();
  assert.match(await page.locator('.document-date').innerText(), /Oct 12, 1998/);
  assert.doesNotMatch(await page.locator('.record-document').innerText(), /EMP-JESSICA|AVAILABLE|1998-10-12/);
  await page.locator('.record-document summary').focus();
  await page.keyboard.press('Enter');
  for (const text of ['HR-014', 'EMP-JESSICA', 'AVAILABLE', '1998-10-12 / 1998-10-18']) assert.ok((await page.locator('.record-document').innerText()).includes(text));
  await page.locator('.record-document summary').click();
  assert.equal(await page.locator('.claim-source').count(), 1);
  await page.locator('.claim-source').click();
  assert.equal(await page.locator('.claim-compare').count(), 1);
  assert.ok(await page.locator('#reconciliation-window').evaluate(el => el.classList.contains('active')));
  assert.ok(await page.locator('.claim-compare').evaluate(el => el === document.activeElement), 'focus follows the comparison');
  assert.match(await page.locator('.claim-compare').textContent(), /CURRENT REPORT/);
  assert.equal(await page.locator('.claim-apply').count(), 0, 'baseline alone cannot complete a case');
  assert.deepEqual(await page.evaluate(() => hilfer.getState().completedCaseIds), []);

  await page.locator('[data-open="records"]').first().click();
  await page.locator('[data-file-id="OH-008"]').click();
  assert.match(await page.locator('.medical-document').textContent(), /Not established/);
  await page.locator('.claim-source').click();
  for (const text of ['Available for duty', 'Not cleared for work', 'Human Resources', 'Occupational Health', 'Oct 12', 'Oct 13', 'OH-008']) assert.ok((await page.locator('.claim-compare').textContent()).includes(text));
  assert.equal(await page.locator('[data-dismiss-claim]').innerText(), 'Continue reviewing');
  assert.equal(await page.locator('.claim-apply').innerText(), 'Update report');
  await page.screenshot({path:join(tmpdir(), 'hilfer-editorial-comparison.png')});
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
  for (const text of ['Filed', 'Not cleared for work', 'Occupational Health', 'Work-related cause', 'Not established']) assert.ok((await report.textContent()).includes(text));
  assert.deepEqual(await page.evaluate(() => hilfer.getState().attachedEvidence['CASE-001']), ['HR-014','OH-008']);
  assert.equal(await page.evaluate(() => hilfer.getState().distortionLevel), 1);
  assert.ok(await page.evaluate(() => hilfer.getState().unlockedCaseIds.includes('CASE-002')));
  assert.equal(await page.locator('html').getAttribute('data-distortion'), '1');
  assert.ok(await page.locator('html').evaluate(el => el.classList.contains('microglitch')));
  await page.waitForFunction(() => !document.documentElement.classList.contains('microglitch'));
  await page.evaluate(() => hilfer.reconcileClaim('CASE-001', 'OH-008', 'workEligibility'));
  assert.equal(await page.evaluate(() => milestones.filter(x => x === 'hilfer:case-reconciled').length), 1);
  assert.equal(await page.evaluate(() => milestones.filter(x => x === 'hilfer:distortion-changed').length), 1);
  assert.ok(await page.locator('html').evaluate(el => !el.classList.contains('microglitch')), 'repeat filing does not glitch again');
  await page.screenshot({path:process.env.HILFER_SCREENSHOT || join(tmpdir(), 'hilfer-claim-based.png')});

  assert.doesNotMatch(await report.innerText(), /NOT_CLEARED|NOT_ESTABLISHED|Disposition|EMP-JESSICA/);
  await report.locator('summary').focus();
  await page.keyboard.press('Enter');
  assert.ok(await report.locator('details').evaluate(el => el.open));
  for (const text of ['CASE-001', 'EMP-JESSICA', 'HR-014', 'OH-008', 'NOT_CLEARED', 'NOT_ESTABLISHED', 'Previous entry', 'Record discrepancy resolved']) assert.ok((await report.innerText()).includes(text));
  await report.locator('summary').click();
  await page.locator('[data-open-record="OH-008"]').first().click();
  assert.equal(await page.locator('#preview-reference').textContent(), 'Jessica — Medical Clearance');
  assert.ok(await page.locator('#records-window').evaluate(el => el.classList.contains('active')));
  await page.reload(); await page.waitForFunction(() => window.hilfer);
  assert.equal(await page.evaluate(() => hilfer.getState().distortionLevel), 1);
  assert.match(await page.locator('[data-report-section="CASE-001"]').textContent(), /NOT_CLEARED/);
  await page.locator('.start-button').click();
  await page.locator('#reset-progress').click();
  assert.equal(await page.evaluate(() => hilfer.getState().completedCaseIds.length), 0);
  assert.equal(await page.evaluate(() => hilfer.getState().distortionLevel), 0);
  await page.locator('[data-open="reconciliation"]').first().click();
  for (const text of ['Available for duty', 'Unverified']) assert.ok((await report.textContent()).includes(text));

  // Keep the desktop-shell regression coverage alongside the new gameplay.
  await page.getByRole('button', {name:'Minimize Reconciliation',exact:true}).click();
  assert.ok(await page.locator('#reconciliation-window').isHidden());
  await page.locator('.taskbar-item[data-window="reconciliation"]').click();
  assert.ok(await page.locator('#reconciliation-window').isVisible());
  await page.getByRole('button', {name:'Maximize Reconciliation',exact:true}).click();
  assert.equal((await page.locator('#reconciliation-window').boundingBox()).width, 1440);
  await page.getByRole('button', {name:'Maximize Reconciliation',exact:true}).click();
  await page.getByRole('button', {name:'Close Reconciliation',exact:true}).click();
  assert.equal(await page.locator('.taskbar-item[data-window="reconciliation"]').count(), 0);
  await page.locator('[data-open="records"]').first().click();
  const before = await page.locator('#records-window').boundingBox();
  await page.mouse.move(before.x + before.width - 6, before.y + before.height - 6);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width - 65, before.y + before.height - 50, {steps:12});
  await page.mouse.up();
  const resized = await page.locator('#records-window').boundingBox();
  assert.ok(resized.width < before.width && resized.height < before.height);
  await page.locator('[data-file-id="OH-008"]').click();
  await page.locator('#record-preview').evaluate(el => { el.scrollTop = el.scrollHeight; });
  assert.ok(await page.locator('#record-preview').evaluate(el => el.scrollHeight <= el.clientHeight || el.scrollTop > 0));
  const header = await page.locator('#records-window .window-header').boundingBox();
  await page.mouse.move(header.x + 180, header.y + 10); await page.mouse.down();
  await page.mouse.move(5, header.y + 10, {steps:12}); await page.mouse.up();
  const released = await page.locator('#records-window').boundingBox();
  assert.ok(released.x < 0, 'window can move past the viewport edge');
  await page.mouse.move(100, 100);
  assert.deepEqual(await page.locator('#records-window').boundingBox(), released);
  for (const asset of ['logo', 'wallpaper', 'records', 'reconciliation', 'settings']) {
    assert.equal((await page.request.get(new URL('/assets/arwa/' + asset + '.webp', target).href)).status(), 200);
  }

  const mobile = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  try {
    const small = await mobile.newPage();
    small.on('pageerror', error => errors.push(error.message));
    await small.goto(target); await small.waitForFunction(() => window.hilfer);
    await small.locator('[data-open="records"]').first().click();
    await small.locator('[data-file-id="OH-008"]').click();
    await small.locator('.claim-source').click();
    assert.ok(await small.locator('.claim-compare').evaluate(el => el === document.activeElement));
    assert.deepEqual(await small.evaluate(() => hilfer.getState().completedCaseIds), []);
    await small.locator('.claim-apply').focus();
    await small.keyboard.press('Enter');
    assert.deepEqual(await small.evaluate(() => hilfer.getState().completedCaseIds), ['CASE-001']);
    assert.ok(await small.locator('#reconciliation-app').evaluate(el => el.scrollWidth <= el.clientWidth));
    await small.screenshot({path:join(tmpdir(), 'hilfer-editorial-mobile.png')});
    await small.locator('[data-report-section="CASE-001"] summary').click();
    await small.locator('[data-open-record="HR-014"]').first().click();
    assert.equal(await small.locator('#preview-reference').textContent(), 'Jessica — Personnel File');
    assert.ok(await small.locator('#records-app').evaluate(el => el.scrollWidth <= el.clientWidth));
  } finally { await mobile.close(); }
  assert.deepEqual(errors, [], 'no browser page errors');
  console.log('PASS: claim comparison, keyboard focus, report/provenance, once-only glitch/unlock, reload/reset, source navigation, artwork, window controls/resize/scroll/offscreen drag, desktop/mobile. No browser errors.');
} finally {
  await browser.close();
}
