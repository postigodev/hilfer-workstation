import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const moduleName = process.env.HILFER_PLAYWRIGHT_MODULE;
const { chromium } = await import(moduleName ? pathToFileURL(moduleName).href : 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const check = async (condition, message) => { assert.ok(await condition(), message); };
try {
  await page.goto(process.env.HILFER_URL || 'http://127.0.0.1:8080');
  await page.waitForFunction(() => window.hilfer);
  assert.equal(await page.locator('.taskbar').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(192, 192, 192)');
  await page.locator('[data-open="reconciliation"]').first().click();
  await page.locator('[data-open="records"]').first().click();
  await page.locator('[data-case="CASE-002"]').click();
  await check(() => page.getByText('Locked. Complete the preceding').isVisible(), 'locked case displays requirements');
  await page.locator('[data-case="CASE-001"]').click();
  // Actual browser mouse drag, rather than dispatching synthetic drop events.
  for (const id of ['HR-014', 'OH-008']) {
    await page.locator(`details[data-record="${id}"] summary`).click();
    const card = page.locator(`[data-record-id="${id}"]`);
    await card.scrollIntoViewIfNeeded();
    const windowPosition = await page.locator('#records-window').boundingBox();
    await card.dragTo(page.locator('#evidence-tray'));
    await check(() => page.locator(`.evidence-card:has-text("${id}")`).isVisible(), `${id} native drag attaches`);
    const after = await page.locator('#records-window').boundingBox();
    assert.equal(after.x, windowPosition.x); assert.equal(after.y, windowPosition.y);
  }
  assert.equal(await page.evaluate(() => hilfer.getState().completedCaseIds.length), 0);
  await page.locator('#record-id').fill('HR-014'); await page.locator('#attach-form button').click();
  await check(() => page.getByText('This record is already attached.').isVisible(), 'duplicate feedback');
  await page.locator('#record-id').fill('UNKNOWN'); await page.locator('#attach-form button').click();
  await check(() => page.getByText('Unknown record ID.').isVisible(), 'unknown feedback');
  await page.getByRole('button', { name: 'Remove HR-014', exact: true }).click();
  assert.equal(await page.locator('.evidence-card').count(), 1);
  await page.locator('#record-id').fill('HR-014'); await page.locator('#attach-form button').click();
  await page.locator('#status-value').selectOption('AVAILABLE');
  await page.locator('#source-id').selectOption('HR-014');
  await page.getByRole('button', { name: 'Commit Resolution', exact: true }).click();
  await check(() => page.getByText('Unsupported determination.').isVisible(), 'wrong resolution rejected');
  await page.evaluate(() => {
    window.milestones = [];
    hilfer.onEvent(e => milestones.push({type:e.type, glitch: document.documentElement.classList.contains('microglitch')}));
    window.glitchSeen = false;
    new MutationObserver(() => { if (document.documentElement.classList.contains('microglitch')) window.glitchSeen = true; }).observe(document.documentElement, {attributes:true,attributeFilter:['class']});
  });
  await page.locator('#status-value').selectOption('NOT_CLEARED');
  await page.locator('#source-id').selectOption('OH-008');
  await page.getByRole('button', { name: 'Commit Resolution', exact: true }).click();
  await page.waitForFunction(() => window.glitchSeen);
  assert.equal(await page.locator('html').getAttribute('data-distortion'), '1');
  await page.waitForFunction(() => !document.documentElement.classList.contains('microglitch'));
  await check(() => page.getByRole('button', {name:'Resolution committed',exact:true}).isDisabled(), 'committed form is sealed');
  await check(() => page.locator('[data-case="CASE-002"]').textContent().then(t => t.includes('AVAILABLE · PLACEHOLDER')), 'next case released');
  assert.equal(await page.evaluate(() => milestones.filter(e => e.type === 'hilfer:case-reconciled').length),1);
  await page.screenshot({path:process.env.HILFER_SCREENSHOT || join(tmpdir(), 'hilfer-prototype.png')});
  await page.reload(); await page.waitForFunction(() => window.hilfer);
  assert.equal(await page.evaluate(() => hilfer.getState().distortionLevel), 1);
  assert.equal(await page.evaluate(() => hilfer.getState().resolutions['CASE-001'].sourceId),'OH-008');
  assert.equal(await page.locator('html').getAttribute('data-distortion'), '1');
  assert.equal(await page.locator('html').getAttribute('class') ?? '', '');
  // Window controls, taskbar restore, titlebar movement, Start and reset.
  await page.locator('[data-open="reconciliation"]').first().click();
  await page.getByRole('button', {name:'Minimize Reconciliation',exact:true}).click();
  await check(() => page.locator('#reconciliation-window').isHidden(), 'minimize hides window');
  await page.locator('.taskbar-item[data-window="reconciliation"]').click();
  await check(() => page.locator('#reconciliation-window').isVisible(), 'taskbar restores');
  await page.getByRole('button', {name:'Maximize Reconciliation',exact:true}).click();
  assert.equal((await page.locator('#reconciliation-window').boundingBox()).width,1440);
  await page.getByRole('button', {name:'Maximize Reconciliation',exact:true}).click();
  const title = page.locator('#reconciliation-window .window-title'); const box = await title.boundingBox();
  await page.mouse.move(box.x+50,box.y+5); await page.mouse.down(); await page.mouse.move(box.x+90,box.y+35,{steps:8}); await page.mouse.up();
  const moved = await page.locator('#reconciliation-window').boundingBox(); assert.ok(moved.x > 145);
  await page.getByRole('button', {name:'Close Reconciliation',exact:true}).click();
  assert.equal(await page.locator('.taskbar-item[data-window="reconciliation"]').count(),0);
  await page.locator('.start-button').click(); await page.locator('#reset-progress').click();
  assert.equal(await page.evaluate(() => hilfer.getState().distortionLevel),0);
  await page.reload(); await page.waitForFunction(() => window.hilfer);
  assert.equal(await page.evaluate(() => hilfer.getState().completedCaseIds.length),0);
  // Repeat a complete playthrough through accessible controls.
  await page.locator('[data-open="reconciliation"]').first().click();
  for (const id of ['OH-008','HR-014']) {
    await page.locator('#record-id').fill(id); await page.locator('#attach-form button').click();
  }
  await page.locator('#status-value').selectOption('NOT_CLEARED'); await page.locator('#source-id').selectOption('OH-008');
  await page.getByRole('button', {name:'Commit Resolution',exact:true}).click();
  assert.equal(await page.evaluate(() => hilfer.getState().completedCaseIds.length),1);
  await page.locator('[data-open="themes"]').first().click();
  await page.locator('#display-theme').selectOption('archive');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'archive');
  await page.getByRole('button', {name:'Close Display Properties',exact:true}).click();
  // Small viewport: all case content remains scrollable and controls reachable.
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-case="CASE-002"]').click();
  await check(() => page.getByText('Assignment released. Content pending;').isVisible(), 'mobile case navigation');
  assert.deepEqual(errors, []);
  console.log('PASS: native record drags; validation/removal; commit/glitch/unlock; reload/reset/repeat; window controls/taskbar/drag; small viewport. No browser errors.');
} finally { await browser.close(); }
