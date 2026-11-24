import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDefinitions} from '../js/core/rules.js';
import {createStore} from '../js/core/store.js';
import {validateMailCorpus} from '../js/apps/emails.js';
import {renderRecord} from '../js/apps/records-fixture.js';
import {renderInvestigationCase} from '../js/apps/investigation-cases.js';

const read=name=>JSON.parse(readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
// Preserve the PR #10 content-v3 contract verbatim; v4 is covered by security.test.js.
const records=read('history/records-v4'),cases=read('history/cases-v3'),emails=read('emails'),progression=read('history/progression-v3');
const memory=()=>{
  const data=new Map();
  return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
};
const fixture=(simulateFinishedFootage=false)=>{
  const def=structuredClone(progression);
  if(simulateFinishedFootage)def.rules.push({
    id:'TEST-ONLY:observed-transport',mode:'once',
    when:{milestoneReached:{milestoneId:'CASE-ARCHIVE:filed'}},
    consequences:[{reachMilestone:{milestoneId:'CAM-R03:transport-observed'}}]
  });
  return createStore({records,cases,storage:memory(),progression:def});
};
const act=(store,type,props)=>store.dispatch({type,...props});
const inspect=(store,id)=>{
  const result=act(store,'inspectEvidence',{evidenceId:id});
  assert.equal(result.ok,true,JSON.stringify({id,result}));
};
function jessica(store){
  inspect(store,'HR-014');inspect(store,'OH-008');
  assert.equal(store.reconcileClaim('CASE-001','OH-008','workEligibility').ok,true);
}
function archive(store,localId){
  inspect(store,'SEC-INDEX');inspect(store,localId);
  assert.equal(act(store,'establishInference',{inferenceId:'E-I1',evidenceIds:['SEC-INDEX',localId]}).ok,true);
  const determination=localId==='ENG-LOCAL-SEGMENT'?'CASE-ARCHIVE:via-engineering':'CASE-ARCHIVE:via-operations';
  assert.equal(act(store,'fileDetermination',{determinationId:determination,sourceEvidenceId:localId}).ok,true);
  assert.ok(store.getCompletedCaseIds().includes('CASE-ARCHIVE'));
}
function recovery(store){
  for(const id of ['REC-01-02-CLOSEOUT','REC-03-APPROVAL-ROSTER','ASSET-CUSTODY-03'])inspect(store,id);
  assert.equal(act(store,'establishInference',{inferenceId:'F-I1',evidenceIds:['REC-01-02-CLOSEOUT','REC-03-APPROVAL-ROSTER','ASSET-CUSTODY-03']}).ok,true);
  assert.equal(act(store,'fileDetermination',{determinationId:'CASE-REC03-PURPOSE:operationalPurpose',sourceEvidenceId:'ASSET-CUSTODY-03'}).ok,true);
}
function finishOps(store){
  inspect(store,'INC-SUMMARY');
  assert.equal(act(store,'establishInference',{inferenceId:'F-I4',evidenceIds:['REC-01-02-CLOSEOUT','INC-SUMMARY','ASSET-CUSTODY-03']}).ok,true);
  assert.equal(act(store,'fileDetermination',{determinationId:'CASE-LINEAGE:recoveryClassification',sourceEvidenceId:'INC-SUMMARY'}).ok,true);
}

test('schema-v2/content-v3 includes all 19 documents and six new mail messages',()=>{
  assert.doesNotThrow(()=>validateDefinitions(progression,cases));
  assert.equal(records.length,18);
  assert.equal(emails.threads.length,8);
  assert.equal(validateMailCorpus(emails,id=>records.find(r=>r.id===id)).messages,18);
  assert.equal(new Set(records.map(r=>r.id)).size,records.length);
  assert.equal(new Set(progression.evidence.map(e=>e.sourceGroupId)).size>=19,true);
  assert.equal(progression.contentVersion,3);
  assert.equal(progression.schemaVersion,2);
});

test('generic Records show actual full text without exposing undefined employee/period',()=>{
  for(const r of records.slice(2)){
    const html=renderRecord(r);
    assert.ok(html.includes(r.id),r.id);
    assert.ok(html.includes(r.body.split('\n')[0]),r.id);
    assert.ok(!html.includes('undefined'),r.id);
  }
});

test('P1 source search is locked before Jessica and late sources stay gated',()=>{
  const s=fixture();
  assert.equal(s.isArtifactAvailable('records','SEC-INDEX'),false);
  assert.equal(s.isArtifactAvailable('mail','MAIL-013'),false);
  jessica(s);
  assert.equal(s.isArtifactAvailable('records','SEC-INDEX'),true);
  assert.equal(s.isArtifactAvailable('mail','MAIL-013'),true);
  for(const id of ['ASSET-CUSTODY-03','GUY-UNFINISHED-DRAFT','OH-LOSURDO'])
    assert.equal(s.isArtifactAvailable('records',id),false,id);
});

test('E requires actually inspected central index and one authorized independent verifier',()=>{
  const s=fixture();jessica(s);
  inspect(s,'SEC-INDEX');
  assert.equal(act(s,'establishInference',{inferenceId:'E-I1',evidenceIds:['SEC-INDEX','ENG-LOCAL-SEGMENT']}).ok,false);
  assert.equal(s.isArtifactAvailable('records','ASSET-CUSTODY-03'),false);
  inspect(s,'ENG-LOCAL-SEGMENT');
  assert.equal(act(s,'establishInference',{inferenceId:'E-I1',evidenceIds:['SEC-INDEX','ENG-LOCAL-SEGMENT']}).ok,true);
  assert.equal(act(s,'fileDetermination',{determinationId:'CASE-ARCHIVE:via-engineering',sourceEvidenceId:'ENG-LOCAL-SEGMENT'}).ok,true);
  assert.equal(s.isArtifactAvailable('records','ASSET-CUSTODY-03'),false,'no fictional media observation');
  assert.equal(s.getSnapshot().facts.milestones['CAM-R03:transport-observed'],undefined);
});

test('both E source paths and G-OPS work given a separately supplied video observation in a TEST fixture',()=>{
 for(const source of ['ENG-LOCAL-SEGMENT','OPS-TRANSFER']){
   const s=fixture(true);jessica(s);archive(s,source);
   assert.equal(s.isArtifactAvailable('records','ASSET-CUSTODY-03'),true);
   recovery(s);finishOps(s);
   assert.ok(s.getCompletedCaseIds().includes('CASE-LINEAGE'));
   assert.ok(s.getSnapshot().facts.milestones['ARCHIVE:unlocked']);
 }
});

test('the optional C-Medical route files G without requiring the F-I4 inference',()=>{
 const s=fixture(true);jessica(s);archive(s,'ENG-LOCAL-SEGMENT');recovery(s);
 for(const id of ['OH-SIX-REVIEW','MAIL-015','INC-SUMMARY'])inspect(s,id);
 assert.equal(act(s,'establishInference',{inferenceId:'C-I1',evidenceIds:['OH-SIX-REVIEW','MAIL-015','INC-SUMMARY']}).ok,true);
 assert.equal(act(s,'fileDetermination',{determinationId:'CASE-LINEAGE:medicalCountScope',sourceEvidenceId:'INC-SUMMARY'}).ok,true);
 assert.ok(s.getSnapshot().facts.milestones['ARCHIVE:unlocked']);
 assert.equal(s.getSnapshot().facts.inferences['F-I4'],undefined);
});

test('no P1 human-authored artifact discloses the prototype in its body',()=>{
 const restricted=new Set(['ASSET-CUSTODY-03','GUY-UNFINISHED-DRAFT','OH-LOSURDO']);
 for(const r of records.slice(2)){
   if(restricted.has(r.id))continue;
   assert.doesNotMatch(r.body,/\b(?:PROTOTYPE_RETRIEVAL|ASSET-PROTO-01)\b/);
 }
});

test('pre-existing email IDs retained; only handoff dates shift to Nov 6',()=>{
 const messages=emails.threads.flatMap(t=>t.messages);
 for(let i=1;i<=12;i++)assert.ok(messages.some(m=>m.id==='MAIL-'+String(i).padStart(3,'0')));
 for(const m of messages.filter(m=>/^MAIL-00[1-7]$/.test(m.id)))assert.ok(m.sentAt.startsWith('1998-11-06'));
 for(const m of messages.filter(m=>/^MAIL-0(?:08|09)$/.test(m.id)))assert.ok(m.sentAt.startsWith('1998-10-13'));
});

test('no player route can inspect synthetic CAM-R03 media before actual asset integration',()=>{
 const s=fixture();jessica(s);archive(s,'OPS-TRANSFER');
 assert.equal(s.getDefinitions().contentCatalog.some(c=>c.artifactId==='CAM-R03'),false);
 assert.equal(s.isArtifactAvailable('records','ASSET-CUSTODY-03'),false);
 assert.equal(act(s,'fileDetermination',{determinationId:'CASE-REC03-PURPOSE:operationalPurpose',sourceEvidenceId:'ASSET-CUSTODY-03'}).ok,false);
});

test('Communications lineage is an independent G completion route',()=>{
 const s=fixture(true);jessica(s);archive(s,'OPS-TRANSFER');recovery(s);
 for(const id of ['OH-SIX-REVIEW','MAIL-015','MAIL-016','INC-SUMMARY'])inspect(s,id);
 assert.equal(act(s,'establishInference',{inferenceId:'C-I2',evidenceIds:['OH-SIX-REVIEW','MAIL-015','MAIL-016','INC-SUMMARY']}).ok,true);
 assert.equal(act(s,'fileDetermination',{determinationId:'CASE-LINEAGE:approvedLanguageLevel',sourceEvidenceId:'INC-SUMMARY'}).ok,true);
 assert.ok(s.getSnapshot().facts.milestones['ARCHIVE:unlocked']);
 assert.equal(s.getSnapshot().facts.inferences['F-I4'],undefined);
});

test('an actual saved content-v2 Jessica determination migrates to v3 without invented inspection',()=>{
 const oldRecords=read('history/records-v2'),oldCases=read('history/cases-v2'),oldProgression=read('history/progression-v2');
 const storage=memory();
 const old=createStore({records:oldRecords,cases:oldCases,storage,progression:oldProgression});
 inspect(old,'HR-014');inspect(old,'OH-008');
 assert.equal(old.reconcileClaim('CASE-001','OH-008','workEligibility').ok,true);
 const previous=old.getSnapshot();
 assert.equal(previous.contentVersion,2);
 const upgraded=createStore({records,cases,storage,progression,contentMigrations:[
   {from:2,to:3,sourceDefinition:oldProgression,sourceCases:oldCases,migrate:s=>({...s,contentVersion:3})}
 ]});
 assert.equal(upgraded.getWarning(),'');
 const now=upgraded.getSnapshot();
 assert.equal(now.contentVersion,3);
 assert.deepEqual(now.facts.inspectedEvidenceIds,previous.facts.inspectedEvidenceIds);
 assert.equal(now.facts.determinations['CASE-001:workEligibility'].value,'NOT_CLEARED');
 assert.ok(now.facts.milestones['CASE-001:filed']);
 assert.ok(upgraded.getState().unlockedCaseIds.includes('CASE-ARCHIVE'));
 assert.equal(now.facts.inferences['E-I1'],undefined,'no retroactive inference created');
});

test('Reconciliation never serializes a candidate value before its source is inspected',()=>{
 const byId=id=>cases.find(c=>c.id===id);
 const render=(store,id)=>renderInvestigationCase(byId(id),store,null,ref=>'<span>'+ref+'</span>');
 const s=fixture();
 jessica(s);
 let html=render(s,'CASE-ARCHIVE');
 assert.doesNotMatch(html,/PARTIAL_LOCAL_VERIFIED/);
 assert.doesNotMatch(html,/data-source-evidence/);
 assert.match(html,/Pending source review/);

 archive(s,'ENG-LOCAL-SEGMENT');
 html=render(s,'CASE-REC03-PURPOSE');
 assert.match(html,/Pending source review/);
 assert.doesNotMatch(html,/PROTOTYPE_RETRIEVAL/);
 assert.doesNotMatch(html,/ASSET-CUSTODY-03/);
 assert.doesNotMatch(html,/data-source-evidence/);
 assert.equal(s.isArtifactAvailable('records','ASSET-CUSTODY-03'),false);
});

test('Even after the media grant, a source must be inspected before its determination appears',()=>{
 const s=fixture(true);
 jessica(s); archive(s,'OPS-TRANSFER');
 const c=cases.find(x=>x.id==='CASE-REC03-PURPOSE');
 const render=()=>renderInvestigationCase(c,s,null,id=>'<span>'+id+'</span>');
 assert.equal(s.isArtifactAvailable('records','ASSET-CUSTODY-03'),true);
 const before=render();
 assert.doesNotMatch(before,/PROTOTYPE_RETRIEVAL/);
 assert.doesNotMatch(before,/data-source-evidence/);
 inspect(s,'ASSET-CUSTODY-03');
 const after=render();
 assert.match(after,/PROTOTYPE_RETRIEVAL/);
 assert.match(after,/data-source-evidence="ASSET-CUSTODY-03"/);
 assert.match(after,/disabled>Update report/,'Other source provenance is still required');
});
