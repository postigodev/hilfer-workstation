import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDefinitions,evaluateCondition,settleRules,deriveAccess,derivePresentation} from '../js/core/rules.js';
import {createStore} from '../js/core/store.js';
import {investigation,memory} from './fixtures/investigation.js';
import {readFileSync} from 'node:fs';

const blank = () => ({version:2,contentVersion:1,facts:{registeredEvidenceIds:[],inspectedEvidenceIds:[],attachedEvidence:{},inferences:{},determinations:{},milestones:{}},ruleReceipts:{},effectReceipts:{}});
const validated = () => { const f = investigation(); return validateDefinitions(f.progression,f.cases); };

test('closed definitions reject malformed shapes, unsupported references and cycles', () => {
  const mutations = [
    d => d.rules[0].when = {javascript:'true'},
    d => d.rules[0].when = {all:[]},
    d => d.rules[0].when = {evidenceInspected:{evidenceId:'UNKNOWN'}},
    d => d.rules[0].when.evidenceCount.atLeast = -1,
    d => d.rules[0].when.evidenceCount.filter.tagsAll = ['UNKNOWN'],
    d => d.rules[0].when = {hasAccess:{grantId:'test.archive'}},
    d => d.rules[0].when = {not:{milestoneReached:{milestoneId:'TEST-CROSS-DEPARTMENT'}}},
    d => d.rules[0].consequences.push({establishInference:{inferenceId:'TEST-PRESENCE'}}),
    d => d.presentationPolicies[0].when = {evidenceInspected:{evidenceId:'TEST-HR'}},
    d => d.determinations[1].claimId = 'staffing',
    d => d.evidence[1].artifacts = d.evidence[0].artifacts,
    d => d.rules.push(structuredClone(d.rules[0]))
  ];
  for (const mutate of mutations) { const f = investigation(); mutate(f.progression); assert.throws(() => validateDefinitions(f.progression,f.cases),/Invalid progression/); }
});

test('counts filter inspected sources by tags, departments, and source groups', () => {
  const d = validated(), s = blank();
  s.facts.registeredEvidenceIds = d.evidence.map(e => e.id);
  const count = (filter,distinctBy,atLeast) => evaluateCondition({evidenceCount:{filter,distinctBy,atLeast}},s,d);
  assert.equal(count({},'source',1),false);
  s.facts.inspectedEvidenceIds = [...s.facts.registeredEvidenceIds];
  assert.equal(count({tagsAll:['incident'],tagsAny:['camera','staffing'],departments:['HR','Security']},'source',2),true);
  assert.equal(count({departments:['HR']},'source',2),false);
  d.evidence[1].sourceGroupId = d.evidence[0].sourceGroupId;
  assert.equal(count({},'source',4),false);
  assert.equal(count({},'department',4),true);
});

test('acyclic chained rules and grants settle once independent of definition order', () => {
  const f = investigation();
  f.progression.rules.push({id:'AAA-CHAIN',mode:'once',when:{hasAccess:{grantId:'test.archive'}},consequences:[{reachMilestone:{milestoneId:'TEST-UNDERSTOOD'}}]});
  f.progression.rules.reverse();
  const d = validateDefinitions(f.progression,f.cases), s = blank(); s.facts.inspectedEvidenceIds = d.evidence.map(e=>e.id);
  assert.equal(settleRules(s,d).length,2); assert.ok(s.facts.milestones['TEST-UNDERSTOOD']);
  assert.deepEqual(deriveAccess(s,d),['test.archive']);
  assert.deepEqual(settleRules(s,d),[]); assert.equal(s.ruleReceipts['AAA-CHAIN'].activationCount,1);
  assert.equal(derivePresentation(s,d),0);
});

const permutations = values => values.length ? values.flatMap((v,i) => permutations(values.filter((_,j)=>i!==j)).map(rest=>[v,...rest])) : [[]];
test('all 24 orders separate inspection, explicit relationships, and administrative filing', () => {
  let expected;
  for (const order of permutations(investigation().progression.evidence.map(e=>e.id))) {
    const store = createStore({...investigation(),storage:memory()});
    for (const evidenceId of order) assert.equal(store.dispatch({type:'inspectEvidence',evidenceId}).ok,true);
    assert.deepEqual(store.getSnapshot().facts.inferences,{});
    assert.deepEqual(store.getSnapshot().facts.determinations,{});
    for (const [inferenceId,evidenceIds] of [['TEST-PRESENCE',['TEST-CAMERA','TEST-HR']],['TEST-PURPOSE',['TEST-MAINTENANCE','TEST-RECOVERY']]])
      assert.equal(store.dispatch({type:'establishInference',inferenceId,evidenceIds}).ok,true);
    assert.equal(store.dispatch({type:'fileDetermination',determinationId:'TEST-AUTHORIZATION',sourceEvidenceId:'TEST-HR'}).ok,true);
    assert.deepEqual(store.getState().completedCaseIds,[]);
    assert.equal(store.dispatch({type:'fileDetermination',determinationId:'TEST-OPERATION',sourceEvidenceId:'TEST-RECOVERY'}).ok,true);
    assert.deepEqual(store.getState().completedCaseIds,['TEST-CASE']);
    assert.equal(Object.keys(store.getSnapshot().facts.determinations).length,2);
    assert.equal(store.getState().distortionLevel,1);
    assert.equal(Object.hasOwn(store.getSnapshot().facts.inferences,'death'),false);
    const normalized=store.getSnapshot();
    normalized.facts.inspectedEvidenceIds.sort(); normalized.facts.registeredEvidenceIds.sort();
    expected ??= normalized; assert.deepEqual(normalized,expected);
  }
});

test('a separate investigation runs entirely from JSON through public APIs', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/calibration.json',import.meta.url),'utf8'));
  const store = createStore({...fixture,storage:memory()});
  assert.equal(store.evidenceForArtifact('mail','ordinary-email'),null);
  assert.equal(store.evidenceForArtifact('footage','CAM-R03'),null);
  const evidenceId = store.evidenceForArtifact('mail','BENCH-ATTACHMENT');
  assert.equal(evidenceId,store.evidenceForArtifact('records','BENCH-ARTIFACT'));
  assert.equal(store.dispatch({type:'inspectEvidence',evidenceId}).changed,true);
  assert.equal(store.dispatch({type:'inspectEvidence',evidenceId}).changed,false);
  assert.equal(store.getSnapshot().facts.inspectedEvidenceIds.length,1);
  assert.equal(store.dispatch({type:'fileDetermination',determinationId:'TEST-CALIBRATION-ENTRY',sourceEvidenceId:evidenceId}).ok,true);
  assert.deepEqual(store.getCompletedCaseIds(),['TEST-CALIBRATION']);
  assert.ok(store.getSnapshot().facts.milestones['TEST-BENCH-ACCEPTED']);
});

test('invalid commands leave snapshot and both event streams untouched', () => {
  const store = createStore({...investigation(),storage:memory()}), events = [];
  store.onEngineEvent(e=>events.push(e)); store.onEvent(e=>events.push(e));
  const before = store.getSnapshot();
  for (const c of [null,{}, {type:'evaluate',javascript:'true'}, {type:'inspectEvidence',evidenceId:'UNKNOWN'},
    {type:'inspectEvidence',evidenceId:'TEST-CAMERA',extra:true},
    {type:'establishInference',inferenceId:'TEST-PRESENCE',evidenceIds:['TEST-CAMERA','TEST-HR']},
    {type:'establishInference',inferenceId:'TEST-PRESENCE',evidenceIds:['TEST-CAMERA','TEST-CAMERA']},
    {type:'fileDetermination',determinationId:'TEST-AUTHORIZATION',sourceEvidenceId:'TEST-HR'}]) assert.equal(store.dispatch(c).ok,false);
  assert.deepEqual(store.getSnapshot(),before); assert.deepEqual(events,[]);
});

test('explicit inference and immutable filing are idempotent without duplicate signals', () => {
  const store = createStore({...investigation(),storage:memory()}), events = []; store.onEngineEvent(e=>events.push(e));
  for (const evidenceId of ['TEST-CAMERA','TEST-HR']) store.dispatch({type:'inspectEvidence',evidenceId});
  const infer = {type:'establishInference',inferenceId:'TEST-PRESENCE',evidenceIds:['TEST-HR','TEST-CAMERA']};
  assert.equal(store.dispatch(infer).changed,true); const count = events.length;
  assert.equal(store.dispatch({...infer,evidenceIds:infer.evidenceIds.toReversed()}).changed,false);
  assert.equal(events.length,count);
  assert.equal(store.dispatch({...infer,evidenceIds:['TEST-HR']}).ok,false);
  const file = {type:'fileDetermination',determinationId:'TEST-AUTHORIZATION',sourceEvidenceId:'TEST-HR'};
  assert.equal(store.dispatch(file).changed,true); const filedCount = events.length;
  assert.equal(store.dispatch(file).changed,false);
  assert.equal(store.dispatch({...file,sourceEvidenceId:'TEST-CAMERA'}).ok,false);
  assert.equal(events.length,filedCount);
});

test('permissions are reversible while facts, inference and milestones persist', () => {
  const f = investigation(); f.progression.initialGrantIds = ['test.archive'];
  // Initial grants cannot be revoked by policies; use a derived temporary grant instead.
  f.progression.initialGrantIds = [];
  f.progression.accessPolicies[0].when = {not:{evidenceInspected:{evidenceId:'TEST-RECOVERY'}}};
  f.progression.evidence[0].requiredGrantIds = ['test.archive'];
  const store = createStore({...f,storage:memory()});
  assert.deepEqual(store.getAccess(),['test.archive']);
  store.dispatch({type:'inspectEvidence',evidenceId:'TEST-CAMERA'});
  store.dispatch({type:'inspectEvidence',evidenceId:'TEST-HR'});
  store.dispatch({type:'establishInference',inferenceId:'TEST-PRESENCE',evidenceIds:['TEST-CAMERA','TEST-HR']});
  store.dispatch({type:'inspectEvidence',evidenceId:'TEST-MAINTENANCE'});
  store.dispatch({type:'inspectEvidence',evidenceId:'TEST-RECOVERY'});
  assert.deepEqual(store.getAccess(),[]); assert.deepEqual(store.getAvailability(),[]);
  assert.equal(store.dispatch({type:'inspectEvidence',evidenceId:'TEST-CAMERA'}).ok,false);
  assert.ok(store.getSnapshot().facts.inferences['TEST-PRESENCE']);
  assert.ok(store.getSnapshot().facts.milestones['TEST-CROSS-DEPARTMENT']);
  assert.ok(store.getSnapshot().facts.inspectedEvidenceIds.includes('TEST-CAMERA'));
});

test('a genuinely inaccessible source cannot be inspected, filed or inferred', () => {
  const f = investigation(); f.progression.evidence[1].requiredGrantIds = ['test.archive'];
  const store = createStore({...f,storage:memory()});
  assert.equal(store.dispatch({type:'inspectEvidence',evidenceId:'TEST-HR'}).ok,false);
  assert.equal(store.dispatch({type:'fileDetermination',determinationId:'TEST-AUTHORIZATION',sourceEvidenceId:'TEST-HR'}).ok,false);
  assert.deepEqual(store.getSnapshot().facts.registeredEvidenceIds,[]);
});

test('onRise fires only on a stabilized false-to-true transition, once survives false', () => {
  const d = validated();
  d.rules = [{id:'TEST-RISE',mode:'onRise',when:{evidenceInspected:{evidenceId:'TEST-CAMERA'}},consequences:[{emitEffect:{effectId:'TEST-CUE'}}]}];
  // Revalidate a definition without cached dependency order.
  const {order,...plain} = d, f = investigation(); const compiled = validateDefinitions(plain,f.cases);
  const s = blank(); settleRules(s,compiled);
  s.facts.inspectedEvidenceIds = ['TEST-CAMERA']; settleRules(s,compiled); settleRules(s,compiled);
  assert.equal(s.ruleReceipts['TEST-RISE'].activationCount,1);
  s.facts.inspectedEvidenceIds = []; settleRules(s,compiled);
  s.facts.inspectedEvidenceIds = ['TEST-CAMERA']; settleRules(s,compiled);
  assert.equal(s.ruleReceipts['TEST-RISE'].activationCount,2);
  assert.equal(Object.keys(s.effectReceipts).length,2);
  const once = validated(), history = blank();
  history.facts.determinations['TEST-AUTHORIZATION'] = {};
  settleRules(history,once); delete history.facts.determinations['TEST-AUTHORIZATION']; settleRules(history,once);
  history.facts.determinations['TEST-AUTHORIZATION'] = {}; settleRules(history,once);
  assert.equal(history.ruleReceipts['TEST-FILING'].activationCount,1);
  assert.equal(Object.keys(history.effectReceipts).length,1);
});

test('alternative routes activate the same persistent milestone without inspecting both routes', () => {
  for (const evidenceId of ['TEST-CAMERA','TEST-HR']) {
    const f=investigation();
    f.progression.rules[0].when={any:[{evidenceInspected:{evidenceId:'TEST-CAMERA'}},{evidenceInspected:{evidenceId:'TEST-HR'}}]};
    const store=createStore({...f,storage:memory()});
    store.dispatch({type:'inspectEvidence',evidenceId});
    assert.ok(store.getSnapshot().facts.milestones['TEST-CROSS-DEPARTMENT']);
    assert.equal(store.getSnapshot().facts.inspectedEvidenceIds.length,1);
  }
});

test('indirect cycles and negated grant cycles fail at definition load', () => {
  for (const negated of [false,true]) {
    const f=investigation();
    const dep={milestoneReached:{milestoneId:'TEST-FILED'}};
    f.progression.rules[0].when=negated ? {not:dep} : dep;
    f.progression.rules[2].when={hasAccess:{grantId:'test.archive'}};
    assert.throws(()=>createStore({...f,storage:memory()}),/cycle/);
  }
});

test('reentrant commands wait until all listeners see the same committed transition', () => {
  const store = createStore({...investigation(),storage:memory()}), observed = [];
  store.onEngineEvent(e=>{
    if (e.type === 'hilfer:evidence-inspected' && e.detail.evidenceId === 'TEST-CAMERA')
      assert.equal(store.dispatch({type:'inspectEvidence',evidenceId:'TEST-HR'}).code,'QUEUED');
  });
  store.onEngineEvent(e=>{ if (e.type==='hilfer:evidence-inspected') observed.push([...store.getSnapshot().facts.inspectedEvidenceIds]); });
  store.dispatch({type:'inspectEvidence',evidenceId:'TEST-CAMERA'});
  assert.deepEqual(observed,[['TEST-CAMERA'],['TEST-CAMERA','TEST-HR']]);
});

test('strict bounds include nested conditions, unknown departments, effects and duplicate claims', () => {
  const mutations = [
    d=>{let c={evidenceInspected:{evidenceId:'TEST-HR'}}; for(let i=0;i<17;i++) c={not:c}; d.rules[0].when=c;},
    d=>d.rules[0].when={all:Array.from({length:256},()=>({evidenceInspected:{evidenceId:'TEST-HR'}}))},
    d=>d.rules[0].when.evidenceCount.filter.departments=['Nonexistent'],
    d=>d.rules[0].consequences=[{emitEffect:{effectId:'UNKNOWN'}}],
    d=>d.effects[0].adapter='javascript',
    d=>d.rules[0].when={evidenceInspected:{evidenceId:'TEST-HR'},not:{evidenceInspected:{evidenceId:'TEST-HR'}}}
  ];
  for(const mutate of mutations){const f=investigation();mutate(f.progression);assert.throws(()=>validateDefinitions(f.progression,f.cases));}
});
