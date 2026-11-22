import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSequenceProof} from '../js/apps/media-observation.js';
import {validateSecurityCatalog} from '../js/apps/security-catalog.js';
import {createStore} from '../js/core/store.js';
import {createArtifacts} from '../js/core/artifacts.js';
import {createMailModel} from '../js/apps/emails.js';
import {presentationPolicies} from '../js/apps/inspection.js';
const read=n=>JSON.parse(readFileSync(new URL('../data/'+n+'.json',import.meta.url),'utf8'));
// Preserve PR #12's v4 contracts, including its deliberately unissued timeline grant.
const records=read('history/records-v4'),cases=read('history/cases-v4'),progression=read('history/progression-v4'),media=read('footage');
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const inspect=(s,evidenceId)=>assert.equal(s.dispatch({type:'inspectEvidence',evidenceId}).ok,true);
function archive(s,source='ENG-LOCAL-SEGMENT') {
  inspect(s,'OH-008'); assert.equal(s.reconcileClaim('CASE-001','OH-008','workEligibility').ok,true);
  inspect(s,'SEC-INDEX');inspect(s,source);
  assert.equal(s.dispatch({type:'establishInference',inferenceId:'E-I1',evidenceIds:['SEC-INDEX',source]}).ok,true);
  assert.equal(s.dispatch({type:'fileDetermination',determinationId:'CASE-ARCHIVE:via-'+(source==='OPS-TRANSFER'?'operations':'engineering'),sourceEvidenceId:source}).ok,true);
}
test('Security catalog has bounded source-specific observation windows',()=>{
  assert.equal(validateSecurityCatalog(media),media);
  for(const mutate of [m=>m.push(m[0]),m=>m[2].observation.end=27,m=>m[2].clipId='missing',m=>m[1].src='https://example.com/untrusted.mp4']) {
    const invalid=structuredClone(media);mutate(invalid);assert.throws(()=>validateSecurityCatalog(invalid));
  }
});
test('presentation callers cannot replace trusted observation metadata or mutate it',async()=>{
  const s=createStore({records,cases,progression,storage:memory()});archive(s);
  const footage=structuredClone(media),emails=read('emails'),mail=createMailModel(emails,{grants:s.getAccess()});
  let received,receivedClip;
  const artifacts=createArtifacts({store:s,records,emails,mail,footage,
    policies:{...presentationPolicies,'media-sequence-presented':p=>{received=p.source;receivedClip=p.clipSource;return false;}}});
  footage[2].observation.start=999;
  const result=await artifacts.present('viewer','footage','CAM-R03-TRANSPORT',{source:{observation:{start:0,end:0.01,minFrames:1}}});
  assert.equal(result.ok,false);assert.equal(received.observation.start,2);
  assert.equal(receivedClip.src,'assets/footage/recovered-review.mp4');
  assert.ok(Object.isFrozen(received));assert.ok(Object.isFrozen(received.observation));
  assert.equal(s.getSnapshot().facts.inspectedEvidenceIds.includes('CAM-R03:transport-visual'),false);
  artifacts.dispose();
});
test('sequence proof requires continuous natural decoded frames, not a seek or timer',()=>{
  const config=media[2].observation;
  const run=(mutate=()=>{})=>{const proof=createSequenceProof(config);let ok=false;for(let i=0;i<=85;i++) {
    const sample={time:2+i/24,now:1000+i*1000/24,frames:100+i,valid:true};mutate(sample,i);ok=proof.push(sample)||ok;
  }return ok;};
  assert.equal(run(),true);
  assert.equal(run((s,i)=>{s.time=5+i/24;}),false);
  assert.equal(run((s,i)=>{if(i===40)s.valid=false;}),false);
  assert.equal(run((s,i)=>{if(i>=40)s.time+=1;}),false);
  assert.equal(run(s=>s.frames=100),false);
  assert.equal(run(s=>s.now=1000),false);
  assert.throws(()=>createSequenceProof({start:5,end:2,minFrames:1}));
});
test('separate visual observations cannot assert canonical identity or unlock custody',()=>{
  const s=createStore({records,cases,progression,storage:memory()});
  assert.equal(s.isArtifactAvailable('footage','CAM-R03'),false);
  assert.equal(s.dispatch({type:'inspectEvidence',evidenceId:'CAM-R03:transport-visual'}).ok,false);
  archive(s);
  assert.equal(s.isArtifactAvailable('footage','CAM-R03'),true);
  inspect(s,'CAM-R03:transport-visual');
  assert.equal(s.getSnapshot().facts.inspectedEvidenceIds.includes('CAM-R03:injury-visual'),false);
  inspect(s,'CAM-R03:injury-visual');
  assert.equal(s.getSnapshot().facts.milestones['CAM-R03:transport-observed'],undefined);
  assert.equal(s.getSnapshot().facts.milestones['CAM-R03:injury-observed'],undefined);
  assert.equal(s.canInspectEvidence('ASSET-CUSTODY-03'),false);
  assert.equal(s.getAccess().includes('security.timeline.verified'),false);
});
test('a synthetic approved timeline activates two independent one-time milestones',()=>{
  const d=structuredClone(progression);d.initialGrantIds.push('security.timeline.verified');
  const s=createStore({records,cases,progression:d,storage:memory()});archive(s,'OPS-TRANSFER');
  inspect(s,'CAM-R03:transport-visual');
  assert.ok(s.getSnapshot().facts.milestones['CAM-R03:transport-observed']);
  assert.equal(s.getSnapshot().facts.milestones['CAM-R03:injury-observed'],undefined);
  assert.equal(s.canInspectEvidence('ASSET-CUSTODY-03'),true);
  inspect(s,'CAM-R03:injury-visual');inspect(s,'CAM-R03:injury-visual');
  assert.equal(s.getSnapshot().ruleReceipts['SEC:verified-injury'].activationCount,1);
  for(const id of ['REC-01-02-CLOSEOUT','REC-03-APPROVAL-ROSTER','ASSET-CUSTODY-03','INC-SUMMARY'])inspect(s,id);
  for(const [inferenceId,evidenceIds] of [
    ['F-I1',['REC-01-02-CLOSEOUT','REC-03-APPROVAL-ROSTER','ASSET-CUSTODY-03']],
    ['F-I4',['REC-01-02-CLOSEOUT','INC-SUMMARY','ASSET-CUSTODY-03']]
  ])assert.equal(s.dispatch({type:'establishInference',inferenceId,evidenceIds}).ok,true);
  assert.equal(s.dispatch({type:'fileDetermination',determinationId:'CASE-REC03-PURPOSE:operationalPurpose',sourceEvidenceId:'ASSET-CUSTODY-03'}).ok,true);
  assert.equal(s.dispatch({type:'fileDetermination',determinationId:'CASE-LINEAGE:recoveryClassification',sourceEvidenceId:'INC-SUMMARY'}).ok,true);
  assert.ok(s.getCompletedCaseIds().includes('CASE-LINEAGE'),'G-OPS needs no optional Medical/Comms inference');
  s.resetProgress();assert.deepEqual(s.getSnapshot().facts.inspectedEvidenceIds,[]);
});
test('actual v3 saves migrate to v4 retaining Jessica/E and no invented observations',()=>{
  const storage=memory(),old=read('history/progression-v3');
  const s=createStore({records,cases,progression:old,storage});archive(s);
  const before=s.getSnapshot();
  const contentMigrations=[{from:3,to:4,sourceDefinition:old,sourceCases:read('history/cases-v3'),migrate:s=>({...s,contentVersion:4})}];
  const loaded=createStore({records,cases,progression,storage,contentMigrations});
  assert.equal(loaded.getWarning(),'');assert.equal(loaded.getSnapshot().contentVersion,4);
  assert.deepEqual(loaded.getSnapshot().facts,before.facts);
  assert.equal(loaded.canInspectEvidence('ASSET-CUSTODY-03'),false);
  loaded.resetProgress();assert.equal(loaded.isArtifactAvailable('footage','CAM-R03'),false);
});

test('the full historical migration chain preserves v1, v2 and v3 Jessica saves',()=>{
  const migrations=[1,2,3].map(from=>({from,to:from+1,sourceDefinition:read('history/progression-v'+from),
    sourceCases:read('history/cases-v'+from),migrate:s=>({...s,contentVersion:from+1})}));
  for(const version of [1,2,3]) {
    const storage=memory();
    const old=createStore({records,cases:read('history/cases-v'+version),progression:read('history/progression-v'+version),storage});
    inspect(old,'OH-008');assert.equal(old.reconcileClaim('CASE-001','OH-008','workEligibility').ok,true);
    const after=createStore({records,cases,progression,storage,contentMigrations:migrations});
    assert.equal(after.getWarning(),'');assert.equal(after.getSnapshot().contentVersion,4);
    assert.deepEqual(after.getSnapshot().facts.inspectedEvidenceIds,['OH-008']);
    assert.ok(after.getCompletedCaseIds().includes('CASE-001'));
    assert.equal(after.canInspectEvidence('ASSET-CUSTODY-03'),false);
  }
  const storage=memory();
  storage.setItem('hilfer:save:v1',JSON.stringify({version:1,discoveredEvidenceIds:['HR-014','OH-008'],attachedEvidence:{'CASE-001':['HR-014','OH-008']},
    resolutions:{'CASE-001':{field:'workEligibility',value:'NOT_CLEARED',sourceId:'OH-008'}}}));
  const migrated=createStore({records,cases,progression,storage,contentMigrations:migrations});
  assert.equal(migrated.getWarning(),'');assert.ok(migrated.getCompletedCaseIds().includes('CASE-001'));
  assert.deepEqual(migrated.getSnapshot().facts.inspectedEvidenceIds,[]);
});
