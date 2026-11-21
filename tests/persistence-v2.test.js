import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStore} from '../js/core/store.js';
import {SAVE_KEY,V2_SAVE_KEY,initialSnapshot,validateSnapshot} from '../js/core/persistence.js';
import {validateDefinitions} from '../js/core/rules.js';
import {drainEffects} from '../js/core/effects.js';
import {investigation,memory} from './fixtures/investigation.js';

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
// These PR 1 migration fixtures intentionally retain original content-1 definitions.
const demo = () => ({records:read('records'),cases:read('cases'),progression:read('history/progression-v1')});
function inspected(storage=memory()) {
  const store = createStore({...investigation(),storage});
  for(const evidenceId of ['TEST-CAMERA','TEST-HR','TEST-MAINTENANCE','TEST-RECOVERY']) store.dispatch({type:'inspectEvidence',evidenceId});
  store.dispatch({type:'establishInference',inferenceId:'TEST-PRESENCE',evidenceIds:['TEST-CAMERA','TEST-HR']});
  return {store,storage};
}
function filed(storage=memory()) {
  const {store} = inspected(storage);
  assert.equal(store.dispatch({type:'fileDetermination',determinationId:'TEST-AUTHORIZATION',sourceEvidenceId:'TEST-HR'}).ok,true);
  return {store,storage};
}

test('v1 partial progress migrates registration and attachments, never retrospective inspection', () => {
  const storage=memory();
  const original=JSON.stringify({version:1,discoveredEvidenceIds:['OH-008'],attachedEvidence:{'CASE-001':['HR-014']},resolutions:{}});
  storage.setItem(SAVE_KEY,original);
  const store=createStore({...demo(),storage});
  assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,[]);
  assert.deepEqual(store.getSnapshot().facts.registeredEvidenceIds,['OH-008','HR-014']);
  assert.deepEqual(store.getState().attachedEvidence['CASE-001'],['HR-014']);
  assert.equal(store.reconcileClaim('CASE-001','OH-008','workEligibility').ok,false);
  assert.equal(storage.getItem(SAVE_KEY),original); assert.ok(storage.getItem(V2_SAVE_KEY));
});

test('v1 completed Jessica preserves provenance, solution, milestones, unread receipts and appearance', () => {
  const storage=memory(), data=demo();
  const original=JSON.stringify({version:1,discoveredEvidenceIds:['OH-008'],attachedEvidence:{'CASE-001':['HR-014','OH-008']},resolutions:{'CASE-001':data.cases[0].resolution},distortionLevel:999});
  storage.setItem(SAVE_KEY,original); storage.setItem('hilfer:assistant-delivery:v1','original-receipt');
  const store=createStore({...data,storage});
  assert.deepEqual(store.getState().resolutions['CASE-001'],data.cases[0].resolution);
  assert.equal(store.getState().distortionLevel,1); assert.deepEqual(store.getSnapshot().facts.inspectedEvidenceIds,[]);
  const t=store.getSnapshot().facts.determinations['CASE-001:workEligibility'];
  assert.equal(t.origin,'migration-v1'); assert.deepEqual(t.provenanceEvidenceIds,['HR-014','OH-008']);
  assert.equal(storage.getItem('hilfer:assistant-delivery:v1'),'original-receipt');
  assert.equal(storage.getItem(SAVE_KEY),original);
  assert.equal(createStore({...data,storage}).getState().distortionLevel,1);
});

test('v1 arriving after a content update uses retained original validators before migration', () => {
  const storage=memory(), original=demo(), updated=demo(); updated.progression.contentVersion=2;
  const raw=JSON.stringify({version:1,discoveredEvidenceIds:['OH-008'],attachedEvidence:{'CASE-001':['HR-014','OH-008']},resolutions:{'CASE-001':original.cases[0].resolution}});
  storage.setItem(SAVE_KEY,raw);
  // A new prerequisite must not retroactively invalidate an accepted v1 filing.
  updated.cases[0].requiredEvidence.push('TEST-NEW-SUPPORT');
  updated.progression.evidence.push({id:'TEST-NEW-SUPPORT',sourceGroupId:'TEST-NEW-SUPPORT',department:'Test Department',tags:[],fields:{},caseIds:['CASE-001'],requiredGrantIds:[],artifacts:[]});
  const store=createStore({...updated,storage,contentMigrations:[{from:1,to:2,sourceDefinition:original.progression,sourceCases:original.cases,migrate:s=>({...s,contentVersion:2})}]});
  assert.equal(store.getWarning(),''); assert.deepEqual(store.getState().resolutions['CASE-001'],original.cases[0].resolution);
  assert.equal(storage.getItem(SAVE_KEY),raw); assert.equal(store.getSnapshot().contentVersion,2);
});

test('v2 round trip retains accepted facts without replaying transient effects', () => {
  const {store,storage}=filed(), before=store.getSnapshot();
  const occurrence=Object.keys(before.effectReceipts)[0]; assert.equal(before.effectReceipts[occurrence].status,'pending');
  const reload=createStore({...investigation(),storage}), after=reload.getSnapshot();
  assert.deepEqual(after.facts,before.facts); assert.deepEqual(after.ruleReceipts,before.ruleReceipts);
  assert.equal(after.effectReceipts[occurrence].status,'skipped'); assert.equal(reload.getState().distortionLevel,1);
  assert.equal(reload.dispatch({type:'inspectEvidence',evidenceId:'TEST-HR'}).changed,false);
  assert.equal(after.ruleReceipts['TEST-FILING'].activationCount,1);
});

test('effects claim durably before delivery, acknowledge once, and skip interrupted claims', async () => {
  const {store,storage}=filed(), occurrence=Object.keys(store.getSnapshot().effectReceipts)[0]; let calls=0;
  await drainEffects(store,{animation:async effect=>{
    calls++; assert.equal(effect.signal,'test.cue');
    assert.equal(JSON.parse(storage.getItem(V2_SAVE_KEY)).effectReceipts[occurrence].status,'claimed'); return true;
  }});
  await drainEffects(store,{animation:()=>{calls++;return true;}}); assert.equal(calls,1);
  assert.equal(store.getSnapshot().effectReceipts[occurrence].status,'delivered');
  assert.equal(store.dispatch({type:'ackEffect',occurrenceId:occurrence,status:'claimed'}).ok,false);
  const interrupted=filed();
  interrupted.store.dispatch({type:'ackEffect',occurrenceId:occurrence,status:'claimed'});
  const restored=createStore({...investigation(),storage:interrupted.storage});
  await drainEffects(restored,{animation:()=>{calls++;return true;}}); assert.equal(calls,1);
});

test('failed effect adapters cannot reverse filing or retry automatically', async () => {
  const {store}=filed(); let calls=0;
  await drainEffects(store,{animation:()=>{calls++;throw Error('Unavailable');}});
  await drainEffects(store,{animation:()=>{calls++;return true;}});
  assert.equal(calls,1); assert.ok(store.getSnapshot().facts.determinations['TEST-AUTHORIZATION']);
  assert.equal(Object.values(store.getSnapshot().effectReceipts)[0].status,'skipped');
});

test('blocked storage supports gameplay but never delivers an unpersisted effect claim', async () => {
  const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  const {store}=filed(storage); let calls=0;
  await drainEffects(store,{animation:()=>{calls++;return true;}});
  assert.equal(calls,0); assert.ok(store.getWarning()); assert.equal(store.getState().distortionLevel,1);
});

test('future, malformed or unsupported v2 blocks writes without falling back to old v1', () => {
  for(const original of ['{broken',JSON.stringify({version:9}),JSON.stringify({version:2,contentVersion:99})]) {
    const storage=memory(); storage.setItem(V2_SAVE_KEY,original); storage.setItem(SAVE_KEY,JSON.stringify({version:1,discoveredEvidenceIds:[],attachedEvidence:{},resolutions:{}}));
    const store=createStore({...demo(),storage});
    assert.equal(store.discover('OH-008').code,'SAVE_BLOCKED'); assert.equal(storage.getItem(V2_SAVE_KEY),original);
    assert.match(store.getWarning(),/preserved/);
    assert.equal(store.resetProgress().ok,true); assert.equal(JSON.parse(storage.getItem(V2_SAVE_KEY)).version,2);
    assert.deepEqual(createStore({...demo(),storage}).getState().completedCaseIds,[]);
  }
});

test('content identity migrations preserve facts and suppress newly satisfied effects', () => {
  const {store,storage}=filed(), f=investigation(); f.progression.contentVersion=2;
  f.progression.rules.push({id:'TEST-NEW-RULE',mode:'once',when:{evidenceInspected:{evidenceId:'TEST-HR'}},consequences:[{emitEffect:{effectId:'TEST-CUE'}}]});
  const original=storage.getItem(V2_SAVE_KEY);
  const contentMigrations=[{from:1,to:2,sourceDefinition:investigation().progression,sourceCases:f.cases,migrate:s=>({...s,contentVersion:2})}];
  const reload=createStore({...f,storage,contentMigrations});
  assert.equal(reload.getWarning(),''); assert.deepEqual(reload.getSnapshot().facts,store.getSnapshot().facts);
  assert.equal(reload.getSnapshot().ruleReceipts['TEST-NEW-RULE'].activationCount,1);
  assert.ok(Object.values(reload.getSnapshot().effectReceipts).every(r=>r.status==='skipped'));
  assert.equal(storage.getItem(`${V2_SAVE_KEY}:backup:1`),original);
});

test('content rename migrates evidence, inference, determination, milestone, rule and effect receipts', () => {
  const {storage}=filed();
  const ids={evidence:{'TEST-HR':'TEST-PERSONNEL'},inferences:{'TEST-PRESENCE':'TEST-LINK'},determinations:{'TEST-AUTHORIZATION':'TEST-STAFFING'},milestones:{'TEST-FILED':'TEST-ACCEPTED'},rules:{'TEST-FILING':'TEST-FILING-V2'},effects:{'TEST-CUE':'TEST-CUE-V2'}};
  const rename = value => {
    let text=JSON.stringify(value);
    for(const mapping of Object.values(ids)) for(const [from,to] of Object.entries(mapping)) text=text.replaceAll(from,to);
    return JSON.parse(text);
  };
  const f=rename(investigation()); f.progression.contentVersion=2;
  const migrations=[{from:1,to:2,ids,sourceDefinition:investigation().progression,sourceCases:investigation().cases,migrate:s=>({...rename(s),contentVersion:2})}];
  const store=createStore({...f,storage,contentMigrations:migrations});
  assert.equal(store.getWarning(),'');
  assert.ok(store.getSnapshot().facts.inferences['TEST-LINK']); assert.ok(store.getSnapshot().facts.determinations['TEST-STAFFING']);
  assert.ok(store.getSnapshot().facts.milestones['TEST-ACCEPTED']);
  assert.equal(store.getSnapshot().ruleReceipts['TEST-FILING-V2'].activationCount,1);
  assert.ok(Object.values(store.getSnapshot().effectReceipts).every(r=>r.status==='skipped'));
});

test('retired history remains accepted; changed prerequisites govern future actions only', () => {
  const {storage}=filed(), f=investigation(); f.progression.contentVersion=2;
  f.progression.evidence[0].retired=true; f.progression.inferences[0].retired=true; f.progression.rules[2].retired=true;
  f.progression.determinations[0].requires={inferenceEstablished:{inferenceId:'TEST-PURPOSE'}};
  const store=createStore({...f,storage,contentMigrations:[{from:1,to:2,sourceDefinition:investigation().progression,sourceCases:f.cases,migrate:s=>({...s,contentVersion:2})}]});
  assert.equal(store.getWarning(),''); assert.ok(store.getSnapshot().facts.inferences['TEST-PRESENCE']);
  assert.ok(store.getSnapshot().facts.determinations['TEST-AUTHORIZATION']); assert.equal(store.getState().distortionLevel,1);
  assert.equal(store.dispatch({type:'inspectEvidence',evidenceId:'TEST-CAMERA'}).ok,false);
});

test('missing, invalid or lossy content migrations preserve the original and block writes', () => {
  for(const mode of ['missing','bad-target','lost-facts','collision']) {
    const {storage}=filed(), f=investigation(); f.progression.contentVersion=2; const original=storage.getItem(V2_SAVE_KEY);
    const step={from:1,to:2,sourceDefinition:investigation().progression,sourceCases:f.cases,migrate:s=>({...s,contentVersion:mode==='bad-target'?3:2})};
    if(mode==='lost-facts') step.migrate=()=>initialSnapshot(f.progression);
    if(mode==='collision') step.ids={evidence:{'TEST-HR':'TEST-CAMERA'}};
    const store=createStore({...f,storage,contentMigrations:mode==='missing'?[]:[step]});
    assert.equal(store.dispatch({type:'inspectEvidence',evidenceId:'TEST-HR'}).code,'SAVE_BLOCKED',mode);
    assert.equal(storage.getItem(V2_SAVE_KEY),original);
  }
});

test('snapshot validation rejects forged references, source values and malformed receipts', () => {
  const {store}=filed(), f=investigation(), d=validateDefinitions(f.progression,f.cases);
  const mutations=[
    s=>s.facts.inspectedEvidenceIds.push('UNKNOWN'),
    s=>s.facts.determinations['TEST-AUTHORIZATION'].value='DEAD',
    s=>s.facts.milestones['TEST-FILED'].ruleId='TEST-COUNT',
    s=>s.ruleReceipts['TEST-FILING'].activationCount=3,
    s=>s.effectReceipts.fake={effectId:'TEST-CUE',ruleId:'TEST-FILING',activation:1,status:'pending'}
  ];
  for(const mutate of mutations){const s=store.getSnapshot();mutate(s);assert.throws(()=>validateSnapshot(s,d,f.cases));}
});

test('reset persists fresh facts and permits a new playthrough without resurrecting v1', () => {
  const {store,storage}=filed(); storage.setItem(SAVE_KEY,'old-v1');
  store.resetProgress(); const reload=createStore({...investigation(),storage});
  assert.deepEqual(reload.getSnapshot().facts.determinations,{}); assert.deepEqual(reload.getSnapshot().facts.inspectedEvidenceIds,[]);
  assert.equal(reload.getState().distortionLevel,0); assert.deepEqual(reload.getSnapshot().effectReceipts,{});
  assert.equal(reload.dispatch({type:'inspectEvidence',evidenceId:'TEST-HR'}).ok,true);
  assert.equal(reload.dispatch({type:'fileDetermination',determinationId:'TEST-AUTHORIZATION',sourceEvidenceId:'TEST-HR'}).ok,true);
});

test('old asynchronous effect completion cannot acknowledge a new post-reset occurrence', async () => {
  const {store}=filed(); let finish;
  const delivery=drainEffects(store,{animation:()=>new Promise(resolve=>{finish=resolve;})});
  await Promise.resolve();
  store.resetProgress(); store.dispatch({type:'inspectEvidence',evidenceId:'TEST-HR'});
  store.dispatch({type:'fileDetermination',determinationId:'TEST-AUTHORIZATION',sourceEvidenceId:'TEST-HR'});
  const occurrence=Object.keys(store.getSnapshot().effectReceipts)[0]; store.dispatch({type:'ackEffect',occurrenceId:occurrence,status:'claimed'});
  finish(true); await delivery;
  assert.equal(store.getSnapshot().effectReceipts[occurrence].status,'claimed');
});

test('a delivery requested by a store subscriber claims after publication and delivers once', async () => {
  const {store}=inspected(); const pending=[]; let calls=0;
  const unsubscribe=store.subscribe(()=>pending.push(drainEffects(store,{animation:()=>{calls++;return true;}})));
  store.dispatch({type:'fileDetermination',determinationId:'TEST-AUTHORIZATION',sourceEvidenceId:'TEST-HR'});
  await Promise.all(pending); unsubscribe();
  assert.equal(calls,1); assert.equal(Object.values(store.getSnapshot().effectReceipts)[0].status,'delivered');
});

test('revocation cancellation skips an in-flight engine effect without acknowledging delivery',async()=>{
  const {store}=filed(),controller=new AbortController();let finish;
  const pending=drainEffects(store,{animation:()=>new Promise(resolve=>{finish=resolve;})},{signal:controller.signal});
  await Promise.resolve();controller.abort();finish(true);await pending;
  assert.equal(Object.values(store.getSnapshot().effectReceipts)[0].status,'skipped');
});
