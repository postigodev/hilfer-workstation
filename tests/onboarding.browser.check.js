import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.HILFER_PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.HILFER_URL);await p.waitForFunction(()=>window.hilfer);
 await p.screenshot({path:'C:/Users/akuma/AppData/Local/Temp/hilfer-rescue-assignment.png'});
 assert.match(await p.locator('.investigation-lead').innerText(),/research associate|Jessica/);
 await p.getByRole('button',{name:'Begin review',exact:true}).click();
 await p.getByRole('button',{name:'Open HR status',exact:true}).click();
 assert.match(await p.locator('.record-document').innerText(),/Jessica/);
 await p.locator('#records-app').getByRole('button',{name:'Review Occupational Health clearance',exact:true}).click();
 assert.match(await p.locator('.record-document').innerText(),/Not cleared for work/);
 await p.locator('.claim-source').click();await p.screenshot({path:'C:/Users/akuma/AppData/Local/Temp/hilfer-rescue-comparison.png'});
 await p.getByRole('button',{name:'Update report',exact:true}).click();
 assert.equal((await p.evaluate(()=>hilfer.getCompletedCaseIds())).includes('CASE-001'),true);
 assert.ok(await p.getByRole('button',{name:'Open central archive index',exact:true}).isVisible());
 await p.getByRole('button',{name:'Open central archive index',exact:true}).click();assert.match(await p.locator('.record-document').innerText(),/Security|Archive/i);
 assert.deepEqual(errors,[]);console.log('PASS: fresh visible Begin → HR → OH → real comparison → Update report → native Security source; no IDs or writes injected.');
}finally{await browser.close();}
