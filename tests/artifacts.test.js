import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStore} from '../js/core/store.js';
import {validateDefinitions,inspectionPolicy} from '../js/core/rules.js';
import {createArtifacts} from '../js/core/artifacts.js';
import {createMailModel} from '../js/apps/emails.js';
import {memory} from './fixtures/investigation.js';
import {SAVE_KEY,V2_SAVE_KEY} from '../js/core/persistence.js';
import {applicationFixture} from './fixtures/application.js';
import {deriveReport,renderReport} from '../js/apps/report.js';
import {presentationPolicies} from '../js/apps/inspection.js';

const read = name=>JSON.parse(readFileSync(new URL('../data/'+(['records','cases','emails','progression'].includes(name)?'history/'+name+'-v2':name)+'.json',import.meta.url),'utf8'));
function fixture() {
  const progression=read('progression'),records=read('records'),cases=read('cases'),emails=read('emails');
  progression.grants.push('test.read');
  progression.accessPolicies.push({grantId:'test.read',when:{not:{evidenceInspected:{evidenceId:'HR-014'}}}});
  // Use the approved real document only as an inspection-based switch in a synthetic definition.
  progression.evidence[1].requiredGrantIds=['test.read'];
  return {progression,records,cases,emails};
}
function setup(f=fixture(),policies={'document-presented':()=>true}) {
  const store=createStore({...f,storage:memory()});
  const mail=createMailModel(f.emails,{grants:store.getAccess(),isAvailable:id=>store.isArtifactAvailable('mail',id)});
  const artifacts=createArtifacts({...f,store,mail,policies,footage:[{id:'CAM4-PREVIEW'}]});
  return {store,mail,artifacts};
}

test('schema 2 rejects nonexistent availability targets, policies, catalog mappings and bindings',()=>{
  for(const mutate of [
    d=>d.availabilityPolicies[0].contentId='CASE-TYPO',
    d=>d.evidence[0].artifacts[0].inspectionPolicyId='document-open',
    d=>d.contentCatalog.push({...d.contentCatalog[2],id:'duplicate-binding'}),
    d=>d.contentCatalog=d.contentCatalog.filter(c=>c.artifactId!=='OH-008'),
    d=>d.evidence[0].artifacts[0]={app:'mail',artifactId:'THREAD-ROSTER',inspectionPolicyId:'message-body-presented'}
  ]) {const f=fixture();mutate(f.progression);assert.throws(()=>validateDefinitions(f.progression,f.cases),/Invalid progression/);}
  const f=fixture(); f.progression.contentCatalog.find(c=>c.artifactId==='OH-008').artifactId='NOT-IN-SOURCES';
  f.progression.evidence[1].artifacts[0].artifactId='NOT-IN-SOURCES';
  assert.throws(()=>setup(f),/Unknown.*source/);
});

test('schema 1 and omitted definitions retain explicit document-open compatibility',async()=>{
  assert.equal(inspectionPolicy('document-open'),'document-presented');
  const records=read('records'),cases=read('cases');
  const store=createStore({records,cases,storage:memory()});
  assert.equal(store.getDefinitions().schemaVersion,1);
  const artifacts=createArtifacts({store,records,policies:{'document-presented':()=>true}});
  assert.equal((await artifacts.present('records','records','OH-008',{})).ok,true);
  assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,['OH-008']);
});

test('presentation credits only after successful policy, never from listing or announcements',async()=>{
  let resolve; const {artifacts,store}=setup(fixture(),{'document-presented':()=>new Promise(r=>resolve=r)});
  assert.equal(artifacts.listRecords().length,2);assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,[]);
  const result=artifacts.present('records','records','OH-008',{});
  assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,[]);
  resolve(true);assert.equal((await result).ok,true);
  assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,['OH-008']);
});

test('revocation then regrant never revives an old async completion; fresh opening works',async()=>{
  const f=fixture();
  // Grant starts true, becomes false on HR inspection, then a synthetic independent source restores it.
  const extra=structuredClone(f.records[0]);extra.id='TEST-REGRANT-DOC';extra.caseIds=[];f.records.push(extra);
  const extraEvidence={...structuredClone(f.progression.evidence[0]),id:'TEST-REGRANT',sourceGroupId:'TEST-REGRANT',caseIds:[],artifacts:[{app:'records',artifactId:extra.id,inspectionPolicyId:'document-presented'}]};
  f.progression.evidence.push(extraEvidence);f.progression.contentCatalog.push({id:'record:'+extra.id,kind:'artifact',app:'records',artifactId:extra.id,artifactType:'document',requiredGrantIds:[]});
  f.progression.accessPolicies[0].when={any:[{not:{evidenceInspected:{evidenceId:'HR-014'}}},{evidenceInspected:{evidenceId:'TEST-REGRANT'}}]};
  let finish; const {artifacts,store}=setup(f,{'document-presented':()=>new Promise(r=>finish=r)});
  const old=artifacts.present('records','records','OH-008',{});
  store.discover('HR-014'); assert.equal(artifacts.canOpen('records','OH-008'),false);
  store.discover(extra.id);assert.equal(artifacts.canOpen('records','OH-008'),true);
  assert.equal(store.getSnapshot().facts.inspectedEvidenceIds.includes('OH-008'),false);
  finish(true);assert.equal((await old).ok,false);
  const fresh=artifacts.present('records','records','OH-008',{});finish(true);assert.equal((await fresh).ok,true);
  assert.ok(store.getSnapshot().facts.inspectedEvidenceIds.includes('OH-008'));
});

test('close, selection change, replacement and reset cancel pending inspections irreversibly',async()=>{
  for(const mode of ['close','selection','replacement','reset']) {
    let finish;const {store,artifacts}=setup(fixture(),{'document-presented':()=>new Promise(r=>finish=r)});
    const old=artifacts.present('records','records','OH-008',{});
    if(mode==='close') artifacts.cancel('records');
    if(mode==='selection') artifacts.begin('records','records','HR-014');
    if(mode==='replacement') artifacts.begin('records','records','OH-008');
    if(mode==='reset') store.resetProgress();
    finish(true);assert.equal((await old).ok,false,mode);assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,[]);
  }
});

test('availability loss cancels pending inspection even when grants are unchanged',async()=>{
  const f=fixture();f.progression.evidence[1].requiredGrantIds=[];f.progression.accessPolicies=[];
  f.progression.availabilityPolicies.push({contentId:'record:OH-008',when:{not:{evidenceInspected:{evidenceId:'HR-014'}}}});
  let finish;const {store,artifacts}=setup(f,{'document-presented':()=>new Promise(r=>finish=r)});
  const result=artifacts.present('records','records','OH-008',{});store.discover('HR-014');finish(true);
  assert.equal((await result).ok,false);assert.equal(artifacts.get('records','OH-008'),null);
});

test('Mail threads are containers: only explicitly presented individual messages count',async()=>{
  const f=fixture();f.progression.evidence[1].requiredGrantIds=[];
  const message=f.emails.threads[0].messages[0], e=structuredClone(f.progression.evidence[0]);
  e.id='TEST-MAIL-EVIDENCE';e.sourceGroupId=e.id;e.caseIds=[];e.artifacts=[{app:'mail',artifactId:message.id,inspectionPolicyId:'message-body-presented'}];
  f.progression.evidence.push(e);
  const {store,artifacts}=setup(f,{'document-presented':()=>true,'message-body-presented':({expanded})=>expanded});
  assert.equal((await artifacts.present('reader','mail',f.emails.threads[0].id,{})).inspected,false);
  assert.equal((await artifacts.present('body','mail',message.id,{expanded:false})).ok,false);
  assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,[]);
  assert.equal((await artifacts.present('body','mail',message.id,{expanded:true})).ok,true);
  assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,['TEST-MAIL-EVIDENCE']);
});

test('schema/content upgrade preserves original v1 and accepted content-1 inspections/receipts',()=>{
  const records=read('records'),cases=read('cases'),sourceDefinition=read('history/progression-v1');
  const contentMigrations=[{from:1,to:2,sourceDefinition,sourceCases:read('history/cases-v1'),migrate:s=>({...s,contentVersion:2})}];
  for(const legacy of [true,false]) {
    const storage=memory();
    if(legacy) storage.setItem(SAVE_KEY,JSON.stringify({version:1,discoveredEvidenceIds:['OH-008'],attachedEvidence:{},resolutions:{}}));
    else createStore({records,cases,storage,progression:sourceDefinition}).discover('OH-008');
    const store=createStore({records,cases,storage,progression:read('progression'),contentMigrations});
    assert.equal(store.getWarning(),''); assert.equal(store.getSnapshot().contentVersion,2);
    assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,legacy?[]:['OH-008']);
    assert.equal(JSON.parse(storage.getItem(V2_SAVE_KEY)).version,2);
  }
});

test('attachment presentation is independent of its parent message and returns only attachment content',async()=>{
  const f=applicationFixture(),{store,artifacts}=setup(f,{'document-presented':()=>true,'message-body-presented':()=>true,'attachment-presented':()=>true,'media-frame-presented':()=>true});
  await artifacts.present('message','mail','TEST-MESSAGE-A',{});
  assert.ok(!store.getSnapshot().facts.inspectedEvidenceIds.includes('TEST-ATTACHMENT-EVIDENCE'));
  assert.equal(artifacts.get('mail','TEST-ATTACHMENT').body,'Separate attachment body');
  await artifacts.present('attachment','mail','TEST-ATTACHMENT',{});
  assert.ok(store.getSnapshot().facts.inspectedEvidenceIds.includes('TEST-ATTACHMENT-EVIDENCE'));
});

test('failed presentation cannot inspect; a new successful presentation can',async()=>{
  let fail=true;
  const {store,artifacts}=setup(fixture(),{'document-presented':()=>{if(fail)throw Error('Render failed');return true;}});
  assert.equal((await artifacts.present('record','records','OH-008',{})).ok,false);
  assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,[]);
  fail=false;assert.equal((await artifacts.present('record','records','OH-008',{})).ok,true);
});

test('hidden sources retain official determinations without leaking source labels or links',()=>{
  const records=read('records'),cases=read('cases'),store=createStore({records,cases,storage:memory()});
  store.discover('OH-008');store.reconcileClaim('CASE-001','OH-008','workEligibility');
  const report=deriveReport(cases,store.getState(),()=>null,{getSourceForValidation:store.getRecord});
  assert.equal(report.sections[0].determination.value,'NOT_CLEARED');
  const html=renderReport(report,{canOpenRecord:()=>false});
  assert.match(html,/Source unavailable/);assert.doesNotMatch(html,/data-open-record|Occupational Health|Human Resources|Jessica Occupational/);
  store.resetProgress();const provisional=deriveReport(cases,store.getState(),()=>null,{getSourceForValidation:store.getRecord});
  assert.equal(provisional.sections[0].provisional.value,'AVAILABLE');
});

test('case-level restrictions prevent hidden case discovery and filing',()=>{
  const f=fixture();f.progression.contentCatalog.find(c=>c.id==='CASE-001').requiredGrantIds=['test.read'];
  const {store,artifacts}=setup(f);store.discover('OH-008');store.discover('HR-014');
  assert.equal(artifacts.caseVisible('CASE-001'),false);
  assert.ok(!store.getState().unlockedCaseIds.includes('CASE-001'));
  assert.equal(store.reconcileClaim('CASE-001','OH-008','workEligibility').ok,false);
  assert.equal(artifacts.caseVisible('CASE-002'),true,'authored placeholder retains its existing locked label');
});

test('Mail applies content availability before message search, counts, lookups and attachments',()=>{
  const f=applicationFixture();f.progression.availabilityPolicies.push({contentId:'mail:TEST-MESSAGE-A',when:{evidenceInspected:{evidenceId:'HR-014'}}});
  const {store,artifacts,mail}=setup(f,{'document-presented':()=>true,'message-body-presented':()=>true,'attachment-presented':()=>true,'media-frame-presented':()=>true});
  assert.equal(mail.getThread('TEST-THREAD').messages.length,1);
  mail.setQuery('Synthetic body A');assert.deepEqual(mail.listThreads(),[]);
  assert.equal(mail.openMessage('TEST-MESSAGE-A').ok,false);assert.equal(artifacts.get('mail','TEST-ATTACHMENT'),null);
  store.discover('HR-014');assert.equal(mail.getThread('TEST-THREAD').messages.length,2);
  assert.equal(mail.listThreads().length,1);assert.ok(artifacts.get('mail','TEST-ATTACHMENT'));
});

test('a future locked placeholder is hidden while the CASE-002 compatibility label is preserved',()=>{
  const f=fixture();
  f.cases.push({id:'TEST-LOCKED-PLACEHOLDER',title:'Synthetic reserved title',description:'Synthetic private metadata',placeholder:true});
  f.progression.contentCatalog.push({id:'TEST-LOCKED-PLACEHOLDER',kind:'case',caseId:'TEST-LOCKED-PLACEHOLDER',requiredGrantIds:[]});
  f.progression.availabilityPolicies.push({contentId:'TEST-LOCKED-PLACEHOLDER',when:{evidenceInspected:{evidenceId:'HR-014'}}});
  const {store,artifacts}=setup(f);
  assert.equal(artifacts.caseVisible('CASE-002'),true);
  assert.equal(artifacts.caseVisible('TEST-LOCKED-PLACEHOLDER'),false);
  assert.deepEqual(store.getCases().filter(c=>artifacts.caseVisible(c.id)).map(c=>c.id),['CASE-001','CASE-002']);
  store.discover('HR-014');assert.equal(artifacts.caseVisible('TEST-LOCKED-PLACEHOLDER'),true);
  const legacy=createStore({records:f.records,cases:f.cases,storage:memory()});
  const legacyArtifacts=createArtifacts({store:legacy,records:f.records,policies:presentationPolicies});
  assert.equal(legacyArtifacts.caseVisible('CASE-002'),true);
  assert.equal(legacyArtifacts.caseVisible('TEST-LOCKED-PLACEHOLDER'),false);
});

test('attachment inspection requires completed presentation and nonempty visible content',async()=>{
  const {store,artifacts}=setup(applicationFixture(),{...presentationPolicies});
  function node(state,text) {
    const content={isConnected:true,textContent:text,getClientRects:()=>[{}],closest:()=>null};
    return {isConnected:true,dataset:{attachmentId:'TEST-ATTACHMENT',attachmentState:state},getClientRects:()=>[{}],closest:()=>null,
      querySelector:selector=>selector==='[data-attachment-content]'?content:null};
  }
  for(const [state,text] of [['loading','Loading…'],['error','Load failed'],['ready','   ']]) {
    assert.equal((await artifacts.present('attachment','mail','TEST-ATTACHMENT',{node:node(state,text)})).ok,false,state);
    assert.ok(!store.getSnapshot().facts.inspectedEvidenceIds.includes('TEST-ATTACHMENT-EVIDENCE'));
  }
  assert.equal((await artifacts.present('attachment','mail','TEST-ATTACHMENT',{node:node('ready','Separate attachment body')})).ok,true);
  assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,['TEST-ATTACHMENT-EVIDENCE']);
});
