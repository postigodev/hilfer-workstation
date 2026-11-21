import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {applicationFixture} from './fixtures/application.js';
const {chromium}=await import(process.env.HILFER_PLAYWRIGHT_MODULE?pathToFileURL(process.env.HILFER_PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const target=process.env.HILFER_URL || 'http://127.0.0.1:8080',errors=[];
async function pageWithFixture({blockedStorage=false}={}) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),data=applicationFixture();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  for(const name of ['records','cases','emails','progression']) await page.route('**/data/'+name+'.json',route=>route.fulfill({json:data[name]}));
  await page.addInitScript(()=>{
    window.engineAudioPlays=0;const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      if(this.src.endsWith('/glitch.mp3')) {window.engineAudio=this;this.addEventListener('playing',()=>window.engineAudioPlays++,{once:true});}
      return play.call(this);
    };
  });
  if(blockedStorage) await page.addInitScript(()=>{
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
    Storage.prototype.getItem=function(key){if(key==='hilfer:save:v2')throw Error('Blocked test storage');return get.call(this,key);};
    Storage.prototype.setItem=function(key,value){if(key==='hilfer:save:v2')throw Error('Blocked test storage');return set.call(this,key,value);};
  });
  await page.goto(target);await page.waitForFunction(()=>window.hilfer);return page;
}
const inspected=page=>page.evaluate(()=>hilfer.getSnapshot().facts.inspectedEvidenceIds);
// Resolve shell controls by their observed data-open selectors, matching existing browser suites.
async function shellOpen(page,name) {await page.locator('[data-open="'+name+'"]').first().click();}
try {
  const page=await pageWithFixture();
  await shellOpen(page,'reconciliation');await page.locator('#register-tab').click();
  assert.ok(await page.locator('[data-case="CASE-002"]').isVisible());
  assert.match(await page.locator('[data-case="CASE-002"]').innerText(),/LOCKED/);
  assert.equal(await page.locator('[data-case="TEST-LOCKED-PLACEHOLDER"]').count(),0);
  assert.doesNotMatch(await page.locator('#reconciliation-app').textContent(),/Synthetic reserved title|Synthetic private metadata/);
  await shellOpen(page,'records');await page.locator('[data-file-id="HR-014"]').click();
  await shellOpen(page,'reconciliation');await page.locator('#register-tab').click();
  assert.ok(await page.locator('[data-case="TEST-LOCKED-PLACEHOLDER"]').isVisible());
  await shellOpen(page,'emails');
  await page.locator('[data-mail-row="TEST-THREAD"]').dblclick();
  await page.waitForFunction(()=>hilfer.getSnapshot().facts.inspectedEvidenceIds.includes('TEST-MAIL-B'));
  assert.ok(!(await inspected(page)).includes('TEST-SHARED'),'opening a thread must not inspect its collapsed message A');
  assert.ok(!(await inspected(page)).includes('TEST-ATTACHMENT-EVIDENCE'));
  await page.waitForFunction(()=>Object.values(hilfer.getSnapshot().effectReceipts).every(r=>r.status==='delivered'));
  await page.waitForFunction(()=>engineAudioPlays===1);
  assert.deepEqual(await page.evaluate(()=>Object.keys(hilfer.getSnapshot().facts.inferences)),[]);
  const reader=page.locator('[data-thread-id="TEST-THREAD"]');
  await reader.locator('[data-message-id="TEST-MESSAGE-A"] > summary').click();
  await page.waitForFunction(()=>hilfer.getSnapshot().facts.inspectedEvidenceIds.includes('TEST-SHARED'));
  assert.ok(!(await inspected(page)).includes('TEST-ATTACHMENT-EVIDENCE'));
  await shellOpen(page,'records');
  await page.locator('[data-file-id="TEST-SEALED"]').click();
  assert.equal((await inspected(page)).filter(id=>id==='TEST-SHARED').length,1);
  await page.locator('[data-file-id="TEST-REVOKE"]').click();
  await page.waitForFunction(()=>!hilfer.getAccess().includes('test.access'));
  assert.equal(await page.locator('[data-file-id="TEST-SEALED"]').count(),0);
  assert.doesNotMatch(await page.locator('#records-app').innerText(),/Restricted test department|Restricted test record/);
  assert.equal(await reader.count(),0);
  assert.equal(await page.evaluate(()=>hilfer.openRecord('TEST-SEALED').ok),false);
  await shellOpen(page,'emails');await page.locator('#mail-search').fill('Synthetic body');assert.equal(await page.locator('[data-mail-row]').count(),0);
  await shellOpen(page,'records');await page.locator('[data-file-id="TEST-REGRANT"]').click();
  await page.waitForFunction(()=>hilfer.getAccess().includes('test.access'));
  assert.equal(await page.locator('[data-file-id="TEST-SEALED"]').count(),1);
  await shellOpen(page,'footage');
  const video=page.locator('#footage-window video');
  assert.ok(!(await inspected(page)).includes('TEST-VIDEO'),'poster/window opening is not inspection');
  // Native play is called inside the existing authorized player, not as a fabricated inspection command.
  await video.evaluate(node=>node.play());
  await page.waitForFunction(()=>hilfer.getSnapshot().facts.inspectedEvidenceIds.includes('TEST-VIDEO'));
  await page.screenshot({path:join(tmpdir(),'hilfer-pr2-applications.png')});
  await page.evaluate(()=>hilfer.resetProgress());
  assert.ok(await video.evaluate(v=>v.paused));
  assert.deepEqual(await inspected(page),[]);
  await page.reload();await page.waitForFunction(()=>window.hilfer);assert.deepEqual(await inspected(page),[]);

  const delayed=await pageWithFixture();
  await delayed.evaluate(async()=>{
    const {createArtifacts}=await import('/js/core/artifacts.js');
    const {presentationPolicies}=await import('/js/apps/inspection.js');
    const {createMailModel}=await import('/js/apps/emails.js');
    const emails=await(await fetch('/data/emails.json')).json();
    const mail=createMailModel(emails,{grants:hilfer.getAccess(),isAvailable:id=>hilfer.isArtifactAvailable('mail',id)});
    window.delayedArtifacts=createArtifacts({store:hilfer,records:hilfer.getRecords(),emails,mail,footage:[{id:'CAM4-PREVIEW'}],policies:{...presentationPolicies,'document-presented':p=>new Promise(resolve=>{window.finishDocument=()=>resolve(presentationPolicies['document-presented'](p,new AbortController().signal));})}});
    const node=document.createElement('article');node.className='record-document';node.dataset.artifactId='TEST-SEALED';node.textContent='Synthetic rendered content';document.body.append(node);window.delayedNode=node;
    window.pendingInspection=delayedArtifacts.present('test-viewer','records','TEST-SEALED',{node});
  });
  await delayed.evaluate(()=>{hilfer.discover('TEST-REVOKE');hilfer.discover('TEST-REGRANT');finishDocument();});
  assert.equal(await delayed.evaluate(()=>pendingInspection.then(r=>r.ok)),false);
  assert.ok(!(await inspected(delayed)).includes('TEST-SHARED'));
  await delayed.evaluate(()=>{window.newInspection=delayedArtifacts.present('test-viewer','records','TEST-SEALED',{node:delayedNode});finishDocument();});
  assert.equal(await delayed.evaluate(()=>newInspection.then(r=>r.ok)),true);
  assert.ok((await inspected(delayed)).includes('TEST-SHARED'));
  assert.deepEqual(await delayed.evaluate(async()=>{
    const attachment=delayedArtifacts.get('mail','TEST-ATTACHMENT');
    const node=document.createElement('section');node.dataset.attachmentId=attachment.id;
    const content=document.createElement('div');content.dataset.attachmentContent='';node.append(content);document.body.append(node);
    const results=[];
    for(const [state,text] of [['loading','Loading…'],['error','Load failed'],['ready','']]) {
      node.dataset.attachmentState=state;content.textContent=text;
      results.push((await delayedArtifacts.present('attachment','mail',attachment.id,{node})).ok);
      if(hilfer.getSnapshot().facts.inspectedEvidenceIds.includes('TEST-ATTACHMENT-EVIDENCE')) throw Error('Incomplete attachment was inspected');
    }
    content.textContent=attachment.body;node.dataset.attachmentState='ready';
    results.push((await delayedArtifacts.present('attachment','mail',attachment.id,{node})).ok);return results;
  }),[false,false,false,true]);
  assert.ok((await inspected(delayed)).includes('TEST-ATTACHMENT-EVIDENCE'));

  const blocked=await pageWithFixture({blockedStorage:true});await shellOpen(blocked,'records');
  await blocked.locator('[data-file-id="OH-008"]').click();
  await blocked.waitForFunction(()=>hilfer.getSnapshot().facts.inspectedEvidenceIds.includes('OH-008'));
  assert.match(await blocked.locator('#save-status').textContent(),/cannot be saved/);
  await blocked.reload();await blocked.waitForFunction(()=>window.hilfer);assert.deepEqual(await inspected(blocked),[]);
  assert.deepEqual(errors,[]);
  console.log('PASS: catalog-backed cross-app authorization, message granularity/shared evidence, native media frames, mounted effects, revoke/regrant stale completion, reset/reload.');
} finally {await browser.close();}
