import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.HILFER_PLAYWRIGHT_MODULE?pathToFileURL(process.env.HILFER_PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const url=process.env.HILFER_URL||'http://127.0.0.1:8080';
const errors=[];
const open=async(p,id)=>{await p.locator('.start-button').click();await p.locator('.start-menu-item[data-open="'+id+'"]').click();};
const inspect=async(p,id)=>{
  await p.evaluate(id=>hilfer.openRecord(id),id);
  await p.waitForFunction(id=>hilfer.getSnapshot().facts.inspectedEvidenceIds.includes(id),id);
};
const review=async(p,id)=>{
  await open(p,'reconciliation');await p.locator('#report-tab').click();
  await p.locator('[data-report-case="'+id+'"]').click();
};
const snapshot=p=>p.evaluate(()=>hilfer.getSnapshot());
try {
  for(const [index,local] of ['ENG-LOCAL-SEGMENT','OPS-TRANSFER'].entries()) {
    const p=await browser.newPage({viewport:index?{width:390,height:844}:{width:1440,height:1000}});
    p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
    const mediaRequests=[];p.on('request',r=>{if(r.url().includes('recovered-review.mp4'))mediaRequests.push(r.url());});
    await p.goto(url);await p.waitForFunction(()=>window.hilfer);
    assert.equal((await snapshot(p)).contentVersion,5);
    assert.equal(await p.evaluate(()=>hilfer.canInspectEvidence('ASSET-CUSTODY-03')),false);
    await inspect(p,'OH-008');await p.locator('.claim-source').click();await p.locator('.claim-apply').click();
    for(const id of ['SEC-INDEX',local])await inspect(p,id);
    assert.equal(mediaRequests.length,0,'No premature recovered-video fetch');
    await review(p,'CASE-ARCHIVE');
    await p.locator('[data-inference-id="E-I1"]:enabled').first().click();
    await p.locator('[data-file-determination]:enabled').click();
    for(const id of ['ENG-LOCAL-SEGMENT:association','OPS-TRANSFER:association'])await inspect(p,id);
    await review(p,'CASE-REC03-PURPOSE');
    assert.equal(await p.locator('[data-inference-id="E-I3"]').isEnabled(),false,'Documents alone are insufficient');
    assert.doesNotMatch(await p.locator('#reconciliation-panel').evaluate(el=>el.outerHTML),/PROTOTYPE_RETRIEVAL|ASSET-CUSTODY-03/);
    if(await p.locator('#assistant-balloon').isVisible())await p.getByRole('button',{name:'Dismiss Assistant'}).click();
    await open(p,'footage');await p.locator('[data-security-clip="CAM-R03"]').click();
    await p.waitForFunction(()=>document.querySelector('#footage-window video').readyState>=2);
    await p.locator('#footage-window video').evaluate(v=>v.play());
    await p.waitForFunction(()=>hilfer.getSnapshot().facts.inspectedEvidenceIds.includes('CAM-R03:transport-visual'));
    await p.locator('#footage-window video').evaluate(v=>v.pause());
    assert.equal((await snapshot(p)).facts.inspectedEvidenceIds.includes('CAM-R03:injury-visual'),false);
    assert.equal(await p.evaluate(()=>hilfer.getAccess().includes('security.timeline.verified')),false,'No automatic inference');
    assert.equal(await p.evaluate(()=>hilfer.canInspectEvidence('ASSET-CUSTODY-03')),false);
    await review(p,'CASE-REC03-PURPOSE');await p.locator('[data-inference-id="E-I3"]').click();
    assert.equal(await p.evaluate(()=>hilfer.getAccess().includes('security.timeline.verified')),true);
    assert.ok((await snapshot(p)).facts.milestones['CAM-R03:transport-observed']);
    assert.doesNotMatch(await p.locator('#reconciliation-panel').evaluate(el=>el.outerHTML),/PROTOTYPE_RETRIEVAL/);
    assert.equal((await snapshot(p)).facts.inspectedEvidenceIds.includes('ASSET-CUSTODY-03'),false);
    await open(p,'footage');
    assert.match(await p.locator('[data-security-clip="CAM-R03"]').innerText(),/Documented association/);
    assert.match(await p.locator('.footage-status').innerText(),/personal identity unverified/);
    if(!index)await p.screenshot({path:join(tmpdir(),'hilfer-reconciliation-associated.png')});
    await p.reload();await p.waitForFunction(()=>window.hilfer);
    assert.ok((await snapshot(p)).facts.inferences['E-I3']);
    assert.equal((await snapshot(p)).ruleReceipts['SEC:verified-transport'].activationCount,1);
    for(const id of ['REC-01-02-CLOSEOUT','REC-03-APPROVAL-ROSTER','ASSET-CUSTODY-03'])await inspect(p,id);
    await review(p,'CASE-REC03-PURPOSE');
    assert.match(await p.locator('#reconciliation-panel').innerText(),/PROTOTYPE_RETRIEVAL/);
    await p.locator('[data-inference-id="F-I1"]').click();
    if(index)await p.locator('.case-detail').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    await p.locator('[data-file-determination="CASE-REC03-PURPOSE:operationalPurpose"]').click();
    await inspect(p,'INC-SUMMARY');await review(p,'CASE-LINEAGE');
    await p.locator('[data-inference-id="F-I4"]').click();
    const filing=p.locator('[data-file-determination="CASE-LINEAGE:recoveryClassification"]');
    if(index) {
      await p.locator('.case-detail').evaluate(el=>{el.scrollTop=el.scrollHeight;});
      assert.ok((await filing.boundingBox()).y+(await filing.boundingBox()).height<
        (await p.locator('#assistant-portrait').boundingBox()).y,'Mobile filing scrolls above the Assistant');
    }
    await filing.click();
    const done=await snapshot(p);
    assert.equal(await p.evaluate(()=>hilfer.getCompletedCaseIds().length),4);
    assert.ok(done.facts.milestones['ARCHIVE:unlocked']);
    assert.equal(done.facts.inferences['E-I2'],undefined);
    assert.equal(done.facts.inspectedEvidenceIds.includes('CAM-R03:injury-visual'),false);
    assert.equal(done.facts.determinations['CASE-LINEAGE:medicalCountScope'],undefined);
    assert.equal(done.facts.determinations['CASE-LINEAGE:approvedLanguageLevel'],undefined);
    assert.match(await p.locator('#reconciliation-panel').innerText(),/CONSOLIDATED/);
    await p.screenshot({path:join(tmpdir(),index?'hilfer-reconciliation-report-mobile.png':'hilfer-reconciliation-report.png')});
    await p.reload();await p.waitForFunction(()=>window.hilfer);
    assert.deepEqual((await snapshot(p)).facts,done.facts);
    await p.evaluate(()=>hilfer.resetProgress());
    assert.deepEqual((await snapshot(p)).facts.inferences,{});
    assert.equal(await p.evaluate(()=>hilfer.canInspectEvidence('ASSET-CUSTODY-03')),false);
    assert.equal(await p.locator('[data-security-clip="CAM-R03"]').count(),0);
    await p.close();
    console.log('PASS: production J→E→E-I3→F→G-OPS via '+local+(index?' / mobile':' / desktop')+'; no injury or identity requirement; reload/reset and spoilers.');
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
