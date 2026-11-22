import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStore} from '../js/core/store.js';
import {initialStory} from '../js/core/story.js';
import {validateDefinitions} from '../js/core/rules.js';
const read=n=>JSON.parse(readFileSync(new URL('../data/'+n+'.json',import.meta.url),'utf8'));
const records=read('records'),cases=read('cases'),progression=read('progression');
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
const command=(s,type,props={})=>s.dispatch({type,...props});
const inspect=(s,id)=>assert.equal(command(s,'inspectEvidence',{evidenceId:id}).ok,true,id);
function filing(s,id,source){assert.equal(command(s,'fileDetermination',{determinationId:id,sourceEvidenceId:source}).ok,true,id);}
function infer(s,id,evidenceIds){assert.equal(command(s,'establishInference',{inferenceId:id,evidenceIds}).ok,true,id);}
function assigned(s,g='ops') {
  inspect(s,'OH-008');assert.equal(s.reconcileClaim('CASE-001','OH-008','workEligibility').ok,true);
  for(const id of ['SEC-INDEX','ENG-LOCAL-SEGMENT'])inspect(s,id);
  infer(s,'E-I1',['SEC-INDEX','ENG-LOCAL-SEGMENT']);filing(s,'CASE-ARCHIVE:via-engineering','ENG-LOCAL-SEGMENT');
  inspect(s,'CAM-R03:transport-visual');
  assert.equal(s.getAccess().includes('security.timeline.verified'),false);
  assert.equal(s.canInspectEvidence('ASSET-CUSTODY-03'),true);
  for(const id of ['REC-01-02-CLOSEOUT','REC-03-APPROVAL-ROSTER','ASSET-CUSTODY-03','INC-SUMMARY'])inspect(s,id);
  infer(s,'F-I1',['REC-01-02-CLOSEOUT','REC-03-APPROVAL-ROSTER','ASSET-CUSTODY-03']);filing(s,'CASE-REC03-PURPOSE:operationalPurpose','ASSET-CUSTODY-03');
  if(g==='ops'){infer(s,'F-I4',['REC-01-02-CLOSEOUT','INC-SUMMARY','ASSET-CUSTODY-03']);filing(s,'CASE-LINEAGE:recoveryClassification','INC-SUMMARY');}
  else {
    for(const id of ['OH-SIX-REVIEW','MAIL-015','MAIL-016'])inspect(s,id);
    infer(s,g==='med'?'C-I1':'C-I2',g==='med'?['OH-SIX-REVIEW','MAIL-015','INC-SUMMARY']:['OH-SIX-REVIEW','MAIL-015','INC-SUMMARY','MAIL-016']);
    filing(s,g==='med'?'CASE-LINEAGE:medicalCountScope':'CASE-LINEAGE:approvedLanguageLevel','INC-SUMMARY');
  }
}
for(const route of ['ops','med','comms'])test('validated story reaches END via G-'+route+' without fabricated historical grant',()=>{
  const storage=memory(),s=createStore({records,cases,progression,storage});
  for(const type of ['acknowledgeGuy','acknowledgeOccupancy','attemptDisclosure','sendDisclosure','reviewSentCopy','acknowledgeMedicalNotice'])assert.equal(command(s,type).ok,false,type);
  assigned(s,route);
  assert.equal(command(s,'attemptDisclosure').ok,false,'Filing alone is not a complete story');
  for(const id of ['GUY-UNFINISHED-DRAFT','LOS-AUDIT','AREA-OCCUPANCY','OH-LOSURDO','COMM-GATEWAY-POLICY'])inspect(s,id);
  assert.equal(command(s,'acknowledgeGuy').ok,true);assert.equal(command(s,'acknowledgeOccupancy').ok,true);
  assert.equal(command(s,'saveDisclosureDraft',{text:'Review Jessica and Tito. Preserve the prototype retrieval distinction.'}).ok,true);
  assert.equal(command(s,'attemptDisclosure').ok,true);assert.equal(command(s,'sendDisclosure').ok,true);
  assert.equal(command(s,'reviewSentCopy').ok,false,'Must inspect what the gateway actually released');
  inspect(s,'GATEWAY-SENT-COPY');assert.equal(command(s,'reviewSentCopy').ok,true);
  assert.equal(command(s,'acknowledgeMedicalNotice').ok,true);assert.equal(command(s,'acknowledgeMedicalNotice').changed,false);
  assert.equal(s.getSnapshot().facts.story.stage,'ended');assert.equal(s.getCompletedCaseIds().length,4);
  assert.equal(s.canInspectEvidence('ASSET-CUSTODY-03'),false,'Temporary private access suspended');
  assert.equal(s.getSnapshot().facts.inferences['E-I2'],undefined);
  const again=createStore({records,cases,progression,storage});assert.equal(again.getWarning(),'');assert.equal(again.getSnapshot().facts.story.stage,'ended');
  again.resetProgress();assert.deepEqual(again.getSnapshot().facts.story,initialStory());
});
test('story commands reject unknown fields, oversized drafts and invalid source definitions',()=>{
  const s=createStore({records,cases,progression,storage:memory()});
  assert.equal(command(s,'saveDisclosureDraft',{text:'x'.repeat(8001)}).ok,false);
  assert.equal(s.dispatch({type:'saveDisclosureDraft',text:'ok',grant:true}).ok,false);
  const d=structuredClone(progression);d.story.guyEvidenceIds.push('UNKNOWN');assert.throws(()=>validateDefinitions(d,cases));
});
test('v5→v6 adds no story acknowledgments or new inspected sources',()=>{
  const storage=memory(),old=read('history/progression-v5'),oldCases=read('history/cases-v5');
  const s=createStore({records,cases:oldCases,progression:old,storage});inspect(s,'OH-008');s.reconcileClaim('CASE-001','OH-008','workEligibility');
  const oldFacts=s.getSnapshot().facts;
  const restored=createStore({records,cases,progression,storage,contentMigrations:[{from:5,to:6,sourceDefinition:old,sourceCases:oldCases,migrate:s=>({...s,contentVersion:6,facts:{...s.facts,story:initialStory()}})}]});
  assert.equal(restored.getWarning(),'');assert.deepEqual(restored.getSnapshot().facts,{...oldFacts,story:initialStory()});
});
