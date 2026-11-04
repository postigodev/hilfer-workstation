import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const moduleName = process.env.HILFER_PLAYWRIGHT_MODULE;
const { chromium } = await import(moduleName ? pathToFileURL(moduleName).href : 'playwright');
const browser = await chromium.launch({headless:true,channel:'msedge'});
const target = process.env.HILFER_URL || 'http://127.0.0.1:8080';
const errors = [];
const listen = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => {
    const reason = r.failure()?.errorText;
    // Stopping/unloading the short cue may cancel the remaining media download.
    if (new URL(r.url()).pathname === '/assets/sounds/glitch.mp3' && reason === 'net::ERR_ABORTED') return;
    errors.push(reason + ' ' + r.url());
  });
};
const ready = async page => { await page.waitForFunction(() => window.hilfer); };
const openAssistant = async page => {
  if (!(await page.locator('#start-menu').isVisible())) await page.locator('.start-button').click();
  await page.locator('.start-menu-item[data-open="ai"]').click();
};
const observe = async page => page.evaluate(() => {
  window.cuePlays = 0; window.filings = 0;
  document.querySelector('#glitch-sound').addEventListener('play', () => window.cuePlays++);
  hilfer.onEvent(({type}) => { if (type === 'hilfer:case-reconciled') window.filings++; });
});
const fileJessica = async page => {
  await page.locator('#ai-app [data-open="records"]').click();
  await page.locator('[data-file-id="HR-014"]').click();
  assert.match(await page.locator('.ai-transcript').textContent(), /review remains open/);
  await page.locator('[data-file-id="OH-008"]').click();
  await page.locator('.claim-source').click();
  await page.locator('.claim-apply').click();
};
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}}); listen(page);
  await page.goto(target); await ready(page);
  for (const path of ['assets/sounds/glitch.mp3', 'assets/arwa/icons/assistant-pixel.webp']) {
    assert.equal((await page.request.get(new URL(path, target).href)).status(), 200);
  }
  assert.ok(await page.locator('#assistant-notification').isHidden());
  await openAssistant(page);
  assert.match(await page.locator('.ai-transcript').innerText(), /Welcome to HILFER/);
  assert.equal(await page.locator('[data-ai-next]').count(), 0);
  assert.doesNotMatch(await page.locator('.ai-transcript').innerText(), /OH-008|NOT_CLEARED|Not cleared/);
  await page.locator('#ai-app [data-open="records"]').click();
  await page.locator('[data-file-id="HR-014"]').click();
  await page.reload(); await ready(page); await openAssistant(page);
  assert.match(await page.locator('.ai-transcript').innerText(), /review remains open/);
  assert.ok(await page.locator('#assistant-notification').isHidden());
  assert.ok(await page.locator('#glitch-sound').evaluate(el => el.paused && el.currentTime === 0));
  await observe(page); await fileJessica(page);
  assert.ok(await page.locator('#assistant-notification').isVisible());
  assert.deepEqual(await page.evaluate(() => hilfer.getState().completedCaseIds), ['CASE-001']);
  await page.waitForFunction(() => cuePlays === 1);
  await page.waitForFunction(() => document.querySelector('#glitch-sound').paused);
  assert.ok(await page.locator('#glitch-sound').evaluate(el => el.currentTime === 0 && el.volume === 0.2));
  assert.equal(await page.evaluate(() => filings), 1);
  await page.evaluate(() => hilfer.reconcileClaim('CASE-001','OH-008','workEligibility'));
  assert.equal(await page.evaluate(() => cuePlays), 1); assert.equal(await page.evaluate(() => filings), 1);
  await page.screenshot({path:join(tmpdir(), 'hilfer-assistant-notification.png')});
  // Unread correspondence survives reload without replaying audiovisual rewards.
  await page.reload(); await ready(page);
  assert.ok(await page.locator('#assistant-notification').isVisible());
  assert.ok(await page.locator('#glitch-sound').evaluate(el => el.paused && el.currentTime === 0));
  assert.ok(await page.locator('html').evaluate(el => !el.classList.contains('microglitch')));
  await page.locator('#assistant-notification').focus();
  await page.keyboard.press('Enter');
  assert.ok(await page.locator('#ai-window').evaluate(el => el.classList.contains('active')));
  assert.ok(await page.locator('#assistant-notification').isHidden());
  assert.ok(await page.locator('.ai-transcript').evaluate(el => el === document.activeElement));
  assert.match(await page.locator('.ai-transcript').innerText(), /entry for Jessica has been revised/);
  assert.notEqual(await page.locator('.ai-avatar').evaluate(el => getComputedStyle(el).filter), 'none');
  await page.screenshot({path:join(tmpdir(), 'hilfer-assistant-filed.png')});
  await page.getByRole('button',{name:'Minimize HILFER Assistant',exact:true}).click();
  await page.locator('.taskbar-item[data-window="ai"]').click();
  assert.ok(await page.locator('#ai-window').isVisible());
  await page.getByRole('button',{name:'Maximize HILFER Assistant',exact:true}).click();
  assert.equal((await page.locator('#ai-window').boundingBox()).width,1440);
  await page.getByRole('button',{name:'Maximize HILFER Assistant',exact:true}).click();
  await page.getByRole('button',{name:'Close HILFER Assistant',exact:true}).click();
  await page.reload(); await ready(page);
  assert.ok(await page.locator('#assistant-notification').isHidden(), 'read receipt survives reload');
  await page.locator('.start-button').click(); await page.locator('#reset-progress').click();
  await openAssistant(page);
  assert.match(await page.locator('.ai-transcript').innerText(), /Welcome to HILFER/);
  assert.doesNotMatch(await page.locator('.ai-transcript').innerText(), /entry for Jessica has been revised/);
  assert.equal(await page.locator('.ai-avatar').evaluate(el => getComputedStyle(el).filter), 'none');
  assert.equal(await page.evaluate(() => localStorage.getItem('hilfer:assistant:v1')), null);
  await observe(page); await fileJessica(page);
  await page.waitForFunction(() => cuePlays === 1); assert.ok(await page.locator('#assistant-notification').isVisible());
  // A failed audio cue must never roll back filing or suppress the notification.
  await page.evaluate(() => hilfer.resetProgress()); await openAssistant(page);
  await page.evaluate(() => { document.querySelector('#glitch-sound').play = () => Promise.reject(new Error('blocked')); });
  await fileJessica(page);
  assert.deepEqual(await page.evaluate(() => hilfer.getState().completedCaseIds), ['CASE-001']);
  assert.ok(await page.locator('#assistant-notification').isVisible());

  const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const small = await mobile.newPage(); listen(small); await small.goto(target); await ready(small); await openAssistant(small);
  await fileJessica(small); assert.ok(await small.locator('#assistant-notification').isVisible());
  const notice = await small.locator('#assistant-notification').boundingBox();
  assert.ok(notice.x >= 0 && notice.x + notice.width <= 390);
  await small.locator('#assistant-notification').click();
  assert.ok(await small.locator('#assistant-notification').isHidden());
  assert.ok(await small.locator('#ai-app').evaluate(el => el.scrollWidth <= el.clientWidth));
  await small.screenshot({path:join(tmpdir(), 'hilfer-assistant-mobile.png')});
  await small.waitForFunction(() => document.querySelector('#glitch-sound').paused);
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log('PASS: contextual assistant, no spoilers, sound once, pending/unread/read reload, reset/replay, audio rejection fallback, portrait variance, notification, window controls and mobile; no missing assets or JS errors.');
} finally { await browser.close(); }
