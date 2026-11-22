import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.HILFER_PLAYWRIGHT_MODULE?pathToFileURL(process.env.HILFER_PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
  for(const reducedMotion of ['no-preference','reduce']) {
    const p=await browser.newPage({reducedMotion});await p.goto(process.env.HILFER_URL||'http://127.0.0.1:8080');await p.waitForFunction(()=>window.hilferEffects);
    const before=await p.evaluate(()=>hilfer.getSnapshot());
    for(const id of ['clock-rewind','index-recovery','cursor-echo','transport-static']) {
      await p.evaluate(id=>hilferEffects.preview(id),id);
      if(id==='clock-rewind')assert.equal(await p.locator('#clock').innerText(),'1:56 PM');
      if(id==='index-recovery'){assert.equal(await p.locator('.index-recovery').count(),1);await p.locator('.index-recovery button').click();assert.equal(await p.locator('.index-recovery').count(),0);}
      if(id==='cursor-echo')assert.equal(await p.locator('.cursor-echo').count(),reducedMotion==='reduce'?0:1);
      await p.keyboard.press('Escape');assert.equal(await p.locator('.cursor-echo,.index-recovery').count(),0);
      assert.equal(await p.locator('html').evaluate(n=>n.classList.contains('transport-static')),false);
    }
    await p.locator('[data-effects-mute]').click();assert.match(await p.locator('[data-effects-mute]').innerText(),/Unmute/);
    assert.deepEqual(await p.evaluate(()=>hilfer.getSnapshot()),before,'Cosmetics and mute cannot grant progress');
    await p.reload();await p.waitForFunction(()=>window.hilferEffects);assert.match(await p.locator('[data-effects-mute]').innerText(),/Unmute/);
    assert.equal(await p.locator('.cursor-echo,.index-recovery').count(),0);await p.close();
  }
  console.log('PASS: bounded clock, reversible index, cosmetic cursor, post-proof static, Escape cleanup, reduced motion, mute reload; facts unchanged.');
} finally {await browser.close();}
