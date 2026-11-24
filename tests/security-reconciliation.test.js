import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStore} from '../js/core/store.js';
import {renderInvestigationCase} from '../js/apps/investigation-cases.js';
import {evaluateCondition} from '../js/core/rules.js';
const read=n=>JSON.parse(readFileSync(new URL('../data/'+n+'.json',import.meta.url),'utf8'));
const records=read('records'),cases=read('cases'),progression=read('history/progression-v5');
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const inspect=(s,evidenceId)=>assert.equal(s.dispatch({type:'inspectEvidence',evidenceId}).ok,true);
const infer=(s,inferenceId,evidenceIds)=>s.dispatch({type:'establishInference',inferenceId,evidenceIds});
function archive(s,local) {
  inspect(s,'OH-008');assert.equal(s.reconcileClaim('CASE-001','OH-008','workEligibility').ok,true);
  inspect(s,'SEC-INDEX');inspect(s,local);
  assert.equal(infer(s,'E-I1',['SEC-INDEX',local]).ok,true);
  assert.equal(s.dispatch({type:'fileDetermination',determinationId:'CASE-ARCHIVE:via-'+(local==='OPS-TRANSFER'?'operations':'engineering'),sourceEvidenceId:local}).ok,true);
}
const support=['ENG-LOCAL-SEGMENT:association','OPS-TRANSFER:association','CAM-R03:transport-visual'];
const view=s=>renderInvestigationCase(cases.find(c=>c.id==='CASE-REC03-PURPOSE'),s,null,id=>id);
test('association needs both independently inspected records and actual transport, then explicit inference',()=>{
  const s=createStore({records,cases,progression,storage:memory()});archive(s,'ENG-LOCAL-SEGMENT');
  assert.equal(infer(s,'E-I3',support).ok,false);
  inspect(s,'CAM-R03:transport-visual');
  inspect(s,'ENG-LOCAL-SEGMENT:association');
  assert.equal(infer(s,'E-I3',support).ok,false,'Operations check is not optional for temporal association');
  inspect(s,'OPS-TRANSFER:association');
  assert.equal(s.getAccess().includes('security.timeline.verified'),false,'Inspection is not comprehension');
  assert.doesNotMatch(view(s),/PROTOTYPE_RETRIEVAL|ASSET-CUSTODY-03/);
  assert.equal(infer(s,'E-I3',support.slice(0,2)).ok,false);
  assert.equal(infer(s,'E-I3',support).ok,true);
  assert.ok(s.getAccess().includes('security.timeline.verified'));
  assert.ok(s.getSnapshot().facts.milestones['CAM-R03:transport-observed']);
  assert.equal(s.getSnapshot().facts.milestones['CAM-R03:injury-observed'],undefined);
  assert.equal(s.canInspectEvidence('ASSET-CUSTODY-03'),true);
  assert.doesNotMatch(view(s),/PROTOTYPE_RETRIEVAL/,'A grant does not inspect the restricted source');
  assert.equal(infer(s,'E-I3',support).changed,false);
});
for(const local of ['ENG-LOCAL-SEGMENT','OPS-TRANSFER'])test('production J/E/F/G-OPS via '+local+' needs no injury or personal identification',()=>{
  const s=createStore({records,cases,progression,storage:memory()});archive(s,local);
  for(const id of support)inspect(s,id);
  assert.equal(infer(s,'E-I3',support).ok,true);
  for(const id of ['REC-01-02-CLOSEOUT','REC-03-APPROVAL-ROSTER','ASSET-CUSTODY-03','INC-SUMMARY'])inspect(s,id);
  assert.equal(infer(s,'F-I1',['REC-01-02-CLOSEOUT','REC-03-APPROVAL-ROSTER','ASSET-CUSTODY-03']).ok,true);
  assert.equal(s.dispatch({type:'fileDetermination',determinationId:'CASE-REC03-PURPOSE:operationalPurpose',sourceEvidenceId:'ASSET-CUSTODY-03'}).ok,true);
  assert.equal(infer(s,'F-I4',['REC-01-02-CLOSEOUT','INC-SUMMARY','ASSET-CUSTODY-03']).ok,true);
  assert.equal(s.dispatch({type:'fileDetermination',determinationId:'CASE-LINEAGE:recoveryClassification',sourceEvidenceId:'INC-SUMMARY'}).ok,true);
  assert.deepEqual(s.getCompletedCaseIds().sort(),['CASE-001','CASE-ARCHIVE','CASE-LINEAGE','CASE-REC03-PURPOSE']);
  assert.equal(s.getSnapshot().facts.inferences['E-I2'],undefined);
  assert.equal(s.getSnapshot().facts.inspectedEvidenceIds.includes('CAM-R03:injury-visual'),false);
});

test('v4 inspection history does not retrospectively inspect new verification addenda',()=>{
  const storage=memory(),old=read('history/progression-v4'),oldCases=read('history/cases-v4');
  const before=createStore({records:read('history/records-v4'),cases:oldCases,progression:old,storage});
  archive(before,'OPS-TRANSFER');inspect(before,'ENG-LOCAL-SEGMENT');inspect(before,'CAM-R03:transport-visual');
  const saved=before.getSnapshot();
  const contentMigrations=[{from:4,to:5,sourceDefinition:old,sourceCases:oldCases,migrate:s=>({...s,contentVersion:5})}];
  const restored=createStore({records,cases,progression,storage,contentMigrations});
  assert.equal(restored.getWarning(),'');assert.equal(restored.getSnapshot().contentVersion,5);
  assert.deepEqual(restored.getSnapshot().facts,saved.facts);
  assert.equal(restored.getAccess().includes('security.timeline.verified'),false);
  assert.equal(infer(restored,'E-I3',support).ok,false);
  for(const id of support.slice(0,2))inspect(restored,id);
  assert.equal(infer(restored,'E-I3',support).ok,true);
  const again=createStore({records,cases,progression,storage});
  assert.equal(again.getWarning(),'');assert.ok(again.getAccess().includes('security.timeline.verified'));
  assert.equal(again.getSnapshot().ruleReceipts['SEC:verified-transport'].activationCount,1);
  again.resetProgress();assert.deepEqual(again.getSnapshot().facts.inferences,{});
  assert.equal(again.canInspectEvidence('ASSET-CUSTODY-03'),false);
});

test('v5 addenda preserve independent provenance, observed overlay and the unchanged source file',()=>{
  const eng=records.find(r=>r.id==='ENG-LOCAL-SEGMENT:association');
  const ops=records.find(r=>r.id==='OPS-TRANSFER:association');
  assert.equal(eng.sourceGroupId,records.find(r=>r.id==='ENG-LOCAL-SEGMENT').sourceGroupId);
  assert.equal(ops.sourceGroupId,records.find(r=>r.id==='OPS-TRANSFER').sourceGroupId);
  assert.notEqual(eng.sourceGroupId,ops.sourceGroupId);
  assert.match(eng.body,/14\.375/);assert.match(eng.body,/TCR 10-09 18:37:11/);
  assert.match(ops.body,/own corridor movement log/);
  for(const source of [eng,ops])assert.doesNotMatch(source.body,/PROTOTYPE_RETRIEVAL|ASSET-CUSTODY-03/);
  assert.doesNotMatch(eng.body,/OPS-TRANSFER:association/,'A 29 October check must not cite the 30 October addendum');
  assert.equal(progression.initialGrantIds.includes('security.timeline.verified'),false);
});

test('pre-v4 saves reach v5 without receiving new documentary knowledge',()=>{
  const migrations=[1,2,3,4].map(from=>({from,to:from+1,sourceDefinition:read('history/progression-v'+from),
    sourceCases:read('history/cases-v'+from),migrate:s=>({...s,contentVersion:from+1})}));
  for(const version of [1,2,3]) {
    const storage=memory();
    const old=createStore({records:read('history/records-v4'),cases:read('history/cases-v'+version),progression:read('history/progression-v'+version),storage});
    inspect(old,'OH-008');assert.equal(old.reconcileClaim('CASE-001','OH-008','workEligibility').ok,true);
    const restored=createStore({records,cases,progression,storage,contentMigrations:migrations});
    assert.equal(restored.getWarning(),'');assert.equal(restored.getSnapshot().contentVersion,5);
    assert.deepEqual(restored.getSnapshot().facts.inspectedEvidenceIds,['OH-008']);
    assert.equal(restored.getSnapshot().facts.inferences['E-I3'],undefined);
    assert.equal(restored.canInspectEvidence('ASSET-CUSTODY-03'),false);
  }
  const legacy=memory();
  legacy.setItem('hilfer:save:v1',JSON.stringify({version:1,discoveredEvidenceIds:['HR-014','OH-008'],attachedEvidence:{'CASE-001':['HR-014','OH-008']},
    resolutions:{'CASE-001':{field:'workEligibility',value:'NOT_CLEARED',sourceId:'OH-008'}}}));
  const migrated=createStore({records,cases,progression,storage:legacy,contentMigrations:migrations});
  assert.equal(migrated.getWarning(),'');assert.equal(migrated.getSnapshot().contentVersion,5);
  assert.ok(migrated.getCompletedCaseIds().includes('CASE-001'));
  assert.deepEqual(migrated.getSnapshot().facts.inspectedEvidenceIds,[]);
});

test('a verification addendum is not counted as a second independent origin',()=>{
  const s=createStore({records,cases,progression,storage:memory()});archive(s,'ENG-LOCAL-SEGMENT');
  inspect(s,'ENG-LOCAL-SEGMENT:association');
  assert.equal(evaluateCondition({evidenceCount:{filter:{departments:['Systems Integrity']},distinctBy:'source',atLeast:2}},s.getSnapshot(),s.getDefinitions()),false);
});
