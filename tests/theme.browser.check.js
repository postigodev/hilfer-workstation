import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const moduleName = process.env.HILFER_PLAYWRIGHT_MODULE;
const { chromium } = await import(moduleName ? pathToFileURL(moduleName).href : 'playwright');
const browser = await chromium.launch({headless:true,channel:'msedge'});
const target = process.env.HILFER_URL || 'http://127.0.0.1:8080';
const errors = [];
const watch = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
};
const open = async (page, id) => {
  if (!(await page.locator('#start-menu').isVisible())) await page.locator('.start-button').click();
  await page.locator('.start-menu-item[data-open="' + id + '"]').click();
};
const apps = {reconciliation:'reconciliation',records:'records',themes:'display',ai:'assistant'};
async function checkArtwork(page, graphite, logo = 'theme') {
  for (const [app, file] of Object.entries(apps)) {
    const suffix = file + (graphite ? '-graphite.webp' : '-pixel.webp');
    const icon = page.locator('.desktop-icons [data-open="' + app + '"] .icon-image');
    assert.ok((await icon.evaluate(el => getComputedStyle(el).backgroundImage)).includes(suffix));
    assert.equal(await icon.evaluate(el => getComputedStyle(el).imageRendering), 'pixelated');
    assert.equal(await icon.evaluate(el => getComputedStyle(el).mixBlendMode), graphite ? 'multiply' : 'normal');
    for (const selector of ['#' + app + '-window .window-title','.taskbar-item[data-window="' + app + '"]','.start-menu-item[data-open="' + app + '"]']) {
      assert.ok((await page.locator(selector).evaluate(el => getComputedStyle(el,'::before').backgroundImage)).includes(suffix), selector);
    }
  }
  for (const department of ['hr','medical']) {
    const icon = page.locator('[data-department-icon="' + department + '"]');
    assert.ok((await icon.evaluate(el => getComputedStyle(el).backgroundImage)).includes(department + (graphite ? '-graphite.webp' : '-pixel.webp')));
  }
  assert.ok((await page.locator('.file-symbol').first().evaluate(el => getComputedStyle(el).backgroundImage)).includes('file-' + (graphite ? 'graphite' : 'pixel') + '.webp'));
  const expectedLogo = logo === 'smooth' ? '/logo.webp' : logo === 'pixel' ? (graphite ? 'logo-graphite.webp' : 'logo-pixel.webp') : graphite ? 'logo-graphite.webp' : '/logo.webp';
  assert.ok((await page.locator('.desktop-logo').evaluate(el => getComputedStyle(el).backgroundImage)).includes(expectedLogo));
}
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}}); watch(page);
  await page.goto(target); await page.waitForFunction(() => window.hilfer);
  for (const app of Object.keys(apps)) await open(page, app);
  await checkArtwork(page, false);
  const initial = await page.evaluate(() => hilfer.getState());
  await page.evaluate(() => { window.themeEvents = []; hilfer.onEvent(({type}) => themeEvents.push(type)); });
  await open(page, 'themes'); await page.locator('#display-theme').selectOption('archive');
  await checkArtwork(page, true);
  assert.equal(await page.locator('#desktop-logo-status').innerText(), 'Logo: pixelated');
  await page.locator('#toggle-desktop-logo').focus(); await page.keyboard.press('Enter');
  await checkArtwork(page, true, 'smooth');
  assert.equal(await page.locator('#desktop-logo-status').innerText(), 'Logo: original');
  assert.ok((await page.locator('.report-letterhead').evaluate(el => getComputedStyle(el).backgroundImage)).includes('logo-graphite.webp'), 'desktop switch does not replace document branding');
  await page.locator('#toggle-desktop-logo').click(); await checkArtwork(page, true, 'pixel');
  assert.deepEqual(await page.evaluate(() => hilfer.getState()), initial);
  assert.deepEqual(await page.evaluate(() => themeEvents), []);
  for (const name of ['reconciliation','records','display','assistant','hr','medical','file','logo']) {
    assert.equal((await page.request.get(new URL('assets/arwa/icons/' + name + '-graphite.webp', target).href)).status(), 200);
  }
  await page.getByRole('button',{name:'Close Display Properties',exact:true}).click();
  await open(page, 'records'); await page.locator('[data-file-id="OH-008"]').click();
  await page.locator('.claim-source').click(); await page.locator('.claim-apply').click();
  assert.equal(await page.locator('html').getAttribute('data-distortion'), '1');
  // The distortion aliases must retain the active theme's desaturated artwork.
  await open(page, 'themes'); await checkArtwork(page, true);
  const filed = await page.evaluate(() => hilfer.getState());
  await page.screenshot({path:join(tmpdir(), 'hilfer-graphite-desktop.png')});
  await page.locator('#display-theme').selectOption('default'); await checkArtwork(page, false, 'pixel');
  await page.locator('#toggle-desktop-logo').click(); await checkArtwork(page, false, 'smooth');
  assert.deepEqual(await page.evaluate(() => hilfer.getState()), filed);
  assert.equal(await page.evaluate(() => themeEvents.filter(x => x === 'hilfer:case-reconciled').length), 1);
  await page.reload(); await page.waitForFunction(() => window.hilfer);
  assert.equal(await page.locator('html').getAttribute('data-logo-style'), null, 'demo logo choice is session-only');
  assert.equal(await page.evaluate(() => hilfer.getState().resolutions['CASE-001'].sourceId), 'OH-008');
  assert.ok(await page.locator('html').evaluate(el => !el.classList.contains('microglitch')));
  const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const small = await mobile.newPage(); watch(small); await small.goto(target); await small.waitForFunction(() => window.hilfer);
  await open(small, 'themes'); await small.locator('#display-theme').selectOption('archive');
  await small.locator('#toggle-desktop-logo').click();
  assert.equal(await small.locator('#desktop-logo-status').innerText(), 'Logo: original');
  await open(small, 'ai');
  assert.ok(await small.locator('#ai-app').evaluate(el => el.scrollWidth <= el.clientWidth));
  assert.ok((await small.locator('.desktop-icons [data-open="ai"] .icon-image').evaluate(el => getComputedStyle(el).backgroundImage)).includes('assistant-graphite.webp'));
  await small.screenshot({path:join(tmpdir(), 'hilfer-graphite-mobile.png')}); await mobile.close();
  assert.deepEqual(errors, []);
  console.log('PASS: Standard/Graphite desktop/title/taskbar/Start/department/file/logo artwork; reversible switching without gameplay events; Jessica and reload; distortion alias compatibility; mobile; no missing assets or JS errors.');
} finally { await browser.close(); }
