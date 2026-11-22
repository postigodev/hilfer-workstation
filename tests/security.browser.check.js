import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.HILFER_PLAYWRIGHT_MODULE?pathToFileURL(process.env.HILFER_PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const target=process.env.HILFER_URL||'http://127.0.0.1:8080';
const errors=[];
const open=async(p,id)=>{await p.locator('.start-button').click();await p.locator('.start-menu-item[data-open="'+id+'"]').click();};
const inspected=p=>p.evaluate(()=>hilfer.getSnapshot().facts.inspectedEvidenceIds);
async function page({approved=false,fallback=false,missing=false,mobile=false}={}) {
  const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});
  p.setDefaultTimeout(12000);
  p.on('pageerror',e=>errors.push(e.message));
  if(approved)await p.route('**/data/progression.json',async route=>{
    const response=await route.fetch(),d=await response.json();d.initialGrantIds.push('security.timeline.verified');
    await route.fulfill({json:d}); // Test-only editorial approval. Never shipped in production.
  });
  if(fallback)await p.addInitScript(()=>{HTMLVideoElement.prototype.requestVideoFrameCallback=undefined;});
  if(missing)await p.route('**/assets/footage/recovered-review.mp4',route=>route.fulfill({status:404,body:'Missing test asset'}));
  await p.goto(target);await p.waitForFunction(()=>window.hilfer);return p;
}
async function archive(p,local='ENG-LOCAL-SEGMENT') {
  await p.evaluate(()=>hilfer.openRecord('OH-008'));
  await p.locator('.claim-source').click();await p.locator('.claim-apply').click();
  for(const id of ['SEC-INDEX',local]) {
    await p.evaluate(id=>hilfer.openRecord(id),id);
    await p.waitForFunction(id=>hilfer.getSnapshot().facts.inspectedEvidenceIds.includes(id),id);
  }
  await open(p,'reconciliation');
  await p.locator('[data-report-case="CASE-ARCHIVE"]').click();
  await p.locator('[data-inference-id="E-I1"]:enabled').first().click();
  await p.locator('[data-file-determination]:enabled').click();
  assert.ok(await p.evaluate(()=>hilfer.getCompletedCaseIds().includes('CASE-ARCHIVE')));
}
async function recovered(p,{dismiss=true}={}) {
  if(dismiss && await p.locator('#assistant-balloon').isVisible())await p.getByRole('button',{name:'Dismiss Assistant'}).click();
  await open(p,'footage');await p.locator('[data-security-clip="CAM-R03"]').click();
  await p.waitForFunction(()=>document.querySelector('#footage-window video').readyState>=2);
  assert.equal(await p.locator('#footage-window video').evaluate(v=>v.duration),14.375);
}
async function playFrom(p,time) {
  await p.locator('#footage-window video').evaluate(async(v,time)=>{
    v.pause();v.currentTime=time;
    if(v.seeking)await Promise.race([new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true})),new Promise((_,reject)=>setTimeout(()=>reject(Error('Media seek stalled')),8000))]);
    if(Math.abs(v.currentTime-time)>0.2)throw new Error('Requested media seek was not performed');
    await v.play();
  },time);
}
try {
  const p=await page();const requests=[];p.on('request',r=>requests.push(r.url()));
  await open(p,'footage');
  assert.equal(await p.locator('[data-security-clip="CAM-R03"]').count(),0);
  assert.doesNotMatch(await p.locator('#footage-window').evaluate(el=>el.outerHTML),/recovered-review|SEG-R03-01|CAM-R03/);
  await playFrom(p,0);
  await p.waitForFunction(()=>document.querySelector('#footage-window video').currentTime>0.5);
  assert.deepEqual(await inspected(p),[],'Preview cannot register narrative observations');
  assert.equal(requests.some(x=>x.includes('recovered-review')),false);
  await archive(p);await recovered(p);
  await playFrom(p,13.9);await p.waitForFunction(()=>document.querySelector('#footage-window video').ended);
  console.log('PASS: real seek-to-end');
  assert.equal((await inspected(p)).some(x=>x.startsWith('CAM-R03:')),false,'Seek-to-end is not observation');
  await playFrom(p,3.5);await p.waitForFunction(()=>document.querySelector('#footage-window video').currentTime>5.8);
  assert.equal((await inspected(p)).includes('CAM-R03:transport-visual'),false,'Partial coverage is insufficient');
  await playFrom(p,1.7);await p.waitForFunction(()=>document.querySelector('#footage-window video').currentTime>2.6);
  await p.locator('#footage-window [data-control="minimize"]').click();
  assert.equal(await p.locator('#footage-window video').evaluate(v=>v.paused),true);
  assert.equal((await inspected(p)).some(x=>x.startsWith('CAM-R03:')),false);
  await open(p,'footage');
  await playFrom(p,1.7);await p.waitForFunction(()=>document.querySelector('#footage-window video').currentTime>2.6);
  await p.evaluate(()=>{
    Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await p.locator('#footage-window video').evaluate(v=>v.paused),true);
  assert.equal((await inspected(p)).some(x=>x.startsWith('CAM-R03:')),false);
  await p.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
  await playFrom(p,1.7);await p.waitForFunction(()=>document.querySelector('#footage-window video').currentTime>2.6);
  await p.locator('[data-security-clip="CAM4-PREVIEW"]').click();
  assert.equal((await inspected(p)).some(x=>x.startsWith('CAM-R03:')),false,'Replacement cancels pending proof');
  await recovered(p);
  await playFrom(p,1.7);
  await p.waitForFunction(()=>hilfer.getSnapshot().facts.inspectedEvidenceIds.includes('CAM-R03:transport-visual'));
  assert.equal((await inspected(p)).includes('CAM-R03:injury-visual'),false);
  await p.waitForFunction(()=>hilfer.getSnapshot().facts.inspectedEvidenceIds.includes('CAM-R03:injury-visual'));
  console.log('PASS: independent natural playback observations');
  assert.equal(await p.evaluate(()=>hilfer.canInspectEvidence('ASSET-CUSTODY-03')),false,'Unreconciled timeline cannot release custody');
  await open(p,'reconciliation');await p.locator('[data-report-case="CASE-REC03-PURPOSE"]').click();
  assert.match(await p.locator('#reconciliation-panel').innerText(),/Pending source review/);
  assert.doesNotMatch(await p.locator('#reconciliation-panel').evaluate(el=>el.outerHTML),/PROTOTYPE_RETRIEVAL|ASSET-CUSTODY-03/);
  await p.screenshot({path:join(tmpdir(),'hilfer-security-editorial-block.png')});
  await p.reload();await p.waitForFunction(()=>window.hilfer);
  assert.ok((await inspected(p)).includes('CAM-R03:injury-visual'));
  assert.equal(await p.evaluate(()=>hilfer.getSnapshot().facts.milestones['CAM-R03:transport-observed']),undefined);
  await p.evaluate(()=>hilfer.resetProgress());
  assert.deepEqual(await inspected(p),[]);
  assert.equal(await p.locator('[data-security-clip="CAM-R03"]').count(),0);
  assert.doesNotMatch(await p.locator('#footage-window').evaluate(el=>el.outerHTML),/recovered-review/);

  // Independent Operations route, fallback decoder path, and hypothetical editorial approval.
  const q=await page({approved:true,fallback:true,mobile:true});await archive(q,'OPS-TRANSFER');await recovered(q,{dismiss:false});
  await q.locator('#footage-window video').evaluate(v=>v.play().catch(()=>{}));
  await q.waitForFunction(()=>document.querySelector('#footage-window video').paused);
  assert.equal((await inspected(q)).some(x=>x.startsWith('CAM-R03:')),false,'An obscuring Assistant is not visible evidence');
  await q.getByRole('button',{name:'Dismiss Assistant'}).click();
  console.log('PASS: Operations route; beginning fallback playback');
  await playFrom(q,1.7);
  await q.waitForFunction(()=>hilfer.getSnapshot().facts.milestones['CAM-R03:transport-observed'],{timeout:15000});
  assert.equal(await q.evaluate(()=>hilfer.canInspectEvidence('ASSET-CUSTODY-03')),true);
  await q.waitForFunction(()=>document.querySelector('#footage-window video').paused);
  assert.equal((await inspected(q)).includes('CAM-R03:injury-visual'),false,'Access transition cancels old pending operations');
  await playFrom(q,6.7);
  await q.waitForFunction(()=>hilfer.getSnapshot().facts.milestones['CAM-R03:injury-observed'],{timeout:15000});
  assert.equal(await q.evaluate(()=>hilfer.getSnapshot().ruleReceipts['SEC:verified-injury'].activationCount),1);
  await q.screenshot({path:join(tmpdir(),'hilfer-security-mobile.png')});
  assert.ok(await q.locator('#footage-window .window-content').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await q.evaluate(()=>hilfer.resetProgress());
  assert.deepEqual(await inspected(q),[]);
  await archive(q);await recovered(q);await playFrom(q,1.7);
  await q.waitForFunction(()=>document.querySelector('#footage-window video').currentTime>2.6);
  await q.evaluate(()=>hilfer.resetProgress());
  assert.deepEqual(await inspected(q),[]);
  await archive(q);await recovered(q);
  await playFrom(q,4.0);await q.waitForFunction(()=>document.querySelector('#footage-window video').currentTime>5.8);
  assert.equal((await inspected(q)).some(x=>x.startsWith('CAM-R03:')),false,'Reset/regrant cannot revive an old partial observation');

  const broken=await page({missing:true});await archive(broken);await open(broken,'footage');
  await broken.locator('[data-security-clip="CAM-R03"]').click();
  await broken.waitForFunction(()=>document.querySelector('.footage-status').textContent.includes('could not be loaded'));
  assert.equal((await inspected(broken)).some(x=>x.startsWith('CAM-R03:')),false);
  assert.match(await broken.locator('.footage-status').innerText(),/could not be loaded/);
  assert.deepEqual(errors,[]);
  console.log('PASS: real decoded 14.375s asset; both E routes; locked network/DOM; preview/seek/partial denial; independent transport/injury; fallback; editorial block; hypothetical grant; reload/reset; missing asset; desktop/mobile.');
} finally {await browser.close();}
