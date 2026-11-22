// Closed, data-only rule language. No DOM, storage, scripts or demo IDs.
import {STORY_FLAGS,STORY_STAGES,validateStoryDefinition} from './story.js';
const idValid = value => typeof value === 'string' && /^[\w][\w.:/-]{0,127}$/.test(value) && !['__proto__','prototype','constructor'].includes(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(`Invalid progression: ${message}`); };
export function exact(value, required, optional = []) {
  if (!object(value) || required.some(key => !Object.hasOwn(value, key)) ||
      Object.keys(value).some(key => ![...required, ...optional].includes(key))) fail('unexpected or missing properties');
}
function ids(values, known) {
  if (!Array.isArray(values) || new Set(values).size !== values.length || values.some(id => !idValid(id) || (known && !known.has(id)))) fail('invalid, duplicate or unknown IDs');
}
function registry(values, label) {
  if (!Array.isArray(values)) fail(`${label} must be an array`);
  const result = new Map();
  for (const value of values) {
    if (!object(value) || !idValid(value.id) || result.has(value.id)) fail(`invalid or duplicate ${label} ID`);
    result.set(value.id, value);
  }
  return result;
}
const byId = (values, id) => values.find(value => value.id === id);
export const INSPECTION_POLICIES = Object.freeze({records:['document-presented'],mail:['message-body-presented','attachment-presented'],footage:['media-frame-presented','media-sequence-presented']});
export const inspectionPolicy = id => id === 'document-open' ? 'document-presented' : id;

export function validateDefinitions(input, cases = []) {
  exact(input, ['schemaVersion','contentVersion','evidence','inferences','determinations','milestoneIds','grants',
    'initialGrantIds','initialCaseIds','caseCompletionPolicies','accessPolicies','availabilityPolicies','presentationPolicies','effects','rules',
    ...(input.schemaVersion === 2 ? ['contentCatalog'] : [])],['story']);
  if (![1,2].includes(input.schemaVersion) || !Number.isSafeInteger(input.contentVersion) || input.contentVersion < 1) fail('unsupported version');
  const d = structuredClone(input);
  registry(cases, 'case');
  const evidence = registry(d.evidence, 'evidence'), inferences = registry(d.inferences, 'inference');
  const determinations = registry(d.determinations, 'determination'), rules = registry(d.rules, 'rule'), effects = registry(d.effects, 'effect');
  ids(d.milestoneIds); ids(d.grants); ids(d.initialGrantIds, new Set(d.grants));
  const caseIds = new Set(cases.map(c => c.id)); ids(d.initialCaseIds, caseIds);
  if(d.story)validateStoryDefinition(d.story,evidence,caseIds);
  const catalog = d.schemaVersion === 2 ? registry(d.contentCatalog,'content') : null;
  if (catalog) {
    const bindings = new Set();
    for (const item of d.contentCatalog) {
      if (item.kind === 'case') {
        exact(item,['id','kind','caseId','requiredGrantIds'],['retired']);
        if (!caseIds.has(item.caseId) || item.id !== item.caseId) fail('invalid case content binding');
      } else {
        exact(item,['id','kind','app','artifactId','artifactType','requiredGrantIds'],['retired']);
        const types = {records:['document'],mail:['thread','message','attachment'],footage:['media']};
        if (item.kind !== 'artifact' || !types[item.app]?.includes(item.artifactType) || !idValid(item.artifactId)) fail('invalid artifact content binding');
      }
      ids(item.requiredGrantIds,new Set(d.grants));
      if (item.retired !== undefined && typeof item.retired !== 'boolean') fail('invalid retired content flag');
      const key = JSON.stringify(item.kind==='case' ? ['case',item.caseId] : [item.app,item.artifactId]);
      if (bindings.has(key)) fail('duplicate content binding'); bindings.add(key);
    }
    if(cases.some(c=>!c.retired && !d.contentCatalog.some(item=>item.kind==='case' && item.caseId===c.id))) fail('missing case content binding');
  }
  const tags = new Set(d.evidence.flatMap(e => e.tags)), departments = new Set(d.evidence.map(e => e.department));
  function condition(value, presentation = false, depth = 0, budget = {nodes:0}) {
    if (depth > 16 || ++budget.nodes > 256 || !object(value) || Object.keys(value).length !== 1) fail('condition bounds or shape');
    const [op, arg] = Object.entries(value)[0];
    if (presentation && !['all','any','milestoneReached'].includes(op)) fail('presentation requires positive milestones');
    if (['all','any'].includes(op)) {
      if (!Array.isArray(arg) || !arg.length) fail('empty boolean condition');
      arg.forEach(child => condition(child, presentation, depth + 1, budget));
    } else if (op === 'not') condition(arg, presentation, depth + 1, budget);
    else if (op === 'evidenceCount') {
      exact(arg, ['filter','distinctBy','atLeast']); exact(arg.filter, [], ['tagsAll','tagsAny','departments']);
      if (!['source','department'].includes(arg.distinctBy) || !Number.isSafeInteger(arg.atLeast) || arg.atLeast < 1) fail('invalid count');
      for (const [key, values] of Object.entries(arg.filter)) {
        if (!Array.isArray(values) || !values.length || new Set(values).size !== values.length || values.some(v => !(key === 'departments' ? departments : tags).has(v))) fail('unknown evidence filter');
      }
    } else if(op==='storyFlag' || op==='storyStage') {
      if(!d.story)fail('story condition without story definition');
      const field=op==='storyFlag'?'flag':'stage';exact(arg,[field]);
      if(!(op==='storyFlag'?STORY_FLAGS:STORY_STAGES).includes(arg[field]))fail('unknown story fact');
    } else {
      const specs = {evidenceInspected:['evidenceId', evidence], inferenceEstablished:['inferenceId',inferences],
        determinationFiled:['determinationId',determinations], milestoneReached:['milestoneId',new Set(d.milestoneIds)], hasAccess:['grantId',new Set(d.grants)]};
      const spec = specs[op]; if (!spec) fail(`unknown operator ${op}`);
      exact(arg, [spec[0]]); if (!spec[1].has(arg[spec[0]])) fail(`unknown ${op} reference`);
    }
  }
  const artifactKeys = new Set(), claims = new Set();
  for (const value of [...d.evidence,...d.inferences,...d.determinations,...d.rules])
    if (value.retired !== undefined && typeof value.retired !== 'boolean') fail('invalid retired flag');
  const legacyCases = new Set();
  for (const e of d.evidence) {
    exact(e, ['id','sourceGroupId','department','tags','artifacts','fields','caseIds','requiredGrantIds'], ['retired']);
    if (!idValid(e.sourceGroupId) || typeof e.department !== 'string' || !e.department || !object(e.fields)) fail('evidence metadata');
    ids(e.tags); ids(e.caseIds, caseIds); ids(e.requiredGrantIds, new Set(d.grants));
    if (!Array.isArray(e.artifacts)) fail('artifacts must be an array');
    for (const a of e.artifacts) {
      exact(a, ['app','artifactId','inspectionPolicyId']);
      if (!['records','mail','footage'].includes(a.app) || !idValid(a.artifactId) || !idValid(a.inspectionPolicyId)) fail('artifact metadata');
      const key = JSON.stringify([a.app,a.artifactId]); if (artifactKeys.has(key)) fail('ambiguous artifact mapping'); artifactKeys.add(key);
      if (catalog) {
        const binding = d.contentCatalog.find(item=>item.kind==='artifact' && item.app===a.app && item.artifactId===a.artifactId);
        if (!binding || !INSPECTION_POLICIES[a.app].includes(a.inspectionPolicyId) || binding.artifactType==='thread' ||
            (a.app==='mail' && a.inspectionPolicyId !== (binding.artifactType==='message' ? 'message-body-presented' : 'attachment-presented'))) fail('unknown or incompatible inspection policy/binding');
      }
    }
  }
  for (const i of d.inferences) {
    exact(i, ['id','supportAlternatives','requires'], ['retired']);
    if (!Array.isArray(i.supportAlternatives) || !i.supportAlternatives.length) fail('inference support');
    for (const alternative of i.supportAlternatives) { ids(alternative, evidence); if (!alternative.length) fail('empty support'); }
    condition(i.requires);
  }
  for (const t of d.determinations) {
    exact(t, ['id','caseId','claimId','field','value','sourceEvidenceIds','provenanceEvidenceIds'], ['requires','legacy','retired']);
    if (!caseIds.has(t.caseId) || !idValid(t.claimId) || !idValid(t.field) || typeof t.value !== 'string') fail('determination metadata');
    const claim = JSON.stringify([t.caseId,t.claimId]); if (claims.has(claim)) fail('competing immutable claims'); claims.add(claim);
    ids(t.sourceEvidenceIds, evidence); ids(t.provenanceEvidenceIds, evidence);
    if (!t.sourceEvidenceIds.length || t.sourceEvidenceIds.some(id => evidence.get(id).fields[t.field] !== t.value || !t.provenanceEvidenceIds.includes(id))) fail('unsupported determination source');
    if (t.requires) condition(t.requires);
    if (t.legacy !== undefined && typeof t.legacy !== 'boolean') fail('invalid legacy flag');
    if (t.legacy) {
      if (legacyCases.has(t.caseId)) fail('ambiguous legacy determination projection');
      legacyCases.add(t.caseId);
    }
  }
  for (const effect of d.effects) {
    exact(effect, ['id','adapter','signal']);
    if (!['dialogue','audio','animation'].includes(effect.adapter) || !idValid(effect.signal)) fail('unknown effect adapter or signal');
  }
  for (const r of d.rules) {
    exact(r, ['id','when','mode','consequences'], ['retired']); condition(r.when);
    if (!['once','onRise'].includes(r.mode) || !Array.isArray(r.consequences) || !r.consequences.length) fail('rule mode/consequences');
    const outputs = new Set();
    for (const c of r.consequences) {
      if (!object(c) || Object.keys(c).length !== 1) fail('consequence shape');
      if (c.reachMilestone) { exact(c.reachMilestone,['milestoneId']); if (!d.milestoneIds.includes(c.reachMilestone.milestoneId)) fail('unknown milestone consequence'); }
      else if (c.emitEffect) { exact(c.emitEffect,['effectId']); if (!effects.has(c.emitEffect.effectId)) fail('unknown effect consequence'); }
      else fail('unknown consequence');
      const key = JSON.stringify(c); if (outputs.has(key)) fail('duplicate consequence'); outputs.add(key);
    }
  }
  for (const key of ['caseCompletionPolicies','accessPolicies','availabilityPolicies','presentationPolicies']) {
    if (!Array.isArray(d[key])) fail(`${key} must be an array`);
    const seen = new Set();
    for (const p of d[key]) {
      const field = {caseCompletionPolicies:'caseId', accessPolicies:'grantId',availabilityPolicies:'contentId',presentationPolicies:'id'}[key];
      exact(p, [field,'when', ...(key === 'presentationPolicies' ? ['distortionLevel'] : [])]);
      if (!idValid(p[field]) || seen.has(p[field])) fail('duplicate policy'); seen.add(p[field]);
      if (key === 'caseCompletionPolicies' && !caseIds.has(p.caseId)) fail('unknown case policy');
      if (key === 'accessPolicies' && !d.grants.includes(p.grantId)) fail('unknown grant policy');
      if (key === 'availabilityPolicies' && catalog && !catalog.has(p.contentId)) fail('unknown availability content target');
      condition(p.when, key === 'presentationPolicies');
      if (key === 'presentationPolicies' && (!Number.isSafeInteger(p.distortionLevel) || p.distortionLevel < 0 || p.distortionLevel > 1)) fail('unsupported distortion level');
    }
  }
  // Dependency nodes: rules produce milestones; policies produce effective grants.
  const graph = new Map();
  const node = key => { if (!graph.has(key)) graph.set(key,new Set()); return graph.get(key); };
  function dependencies(c, target) {
    if (c.all || c.any) (c.all ?? c.any).forEach(child => dependencies(child,target));
    else if (c.not) dependencies(c.not,target);
    else if (c.milestoneReached) node(target).add('m:' + c.milestoneReached.milestoneId);
    else if (c.hasAccess) node(target).add('g:' + c.hasAccess.grantId);
  }
  for (const r of d.rules.filter(r => !r.retired)) {
    const key = 'r:' + r.id; node(key); dependencies(r.when,key);
    for (const c of r.consequences) if (c.reachMilestone) node('m:' + c.reachMilestone.milestoneId).add(key);
  }
  for (const p of d.accessPolicies) { node('g:' + p.grantId); dependencies(p.when,'g:' + p.grantId); }
  const order = [], visiting = new Set(), visited = new Set();
  function visit(key) {
    if (visiting.has(key)) fail(`dependency cycle at ${key}`);
    if (visited.has(key)) return;
    visiting.add(key); for (const dependency of [...node(key)].sort()) visit(dependency);
    visiting.delete(key); visited.add(key); order.push(key);
  }
  for (const key of [...graph.keys()].sort()) visit(key);
  return { ...d, order };
}

export function evaluateCondition(c, state, d, grants = deriveAccess(state,d)) {
  if (!c) return true; // Optional definition prerequisite, never a JSON operator.
  const f = state.facts;
  if (c.all) return c.all.every(child => evaluateCondition(child,state,d,grants));
  if (c.any) return c.any.some(child => evaluateCondition(child,state,d,grants));
  if (c.not) return !evaluateCondition(c.not,state,d,grants);
  if (c.evidenceInspected) return f.inspectedEvidenceIds.includes(c.evidenceInspected.evidenceId);
  if(c.storyFlag)return f.story?.[c.storyFlag.flag]===true;
  if(c.storyStage)return f.story?.stage===c.storyStage.stage;
  if (c.inferenceEstablished) return Object.hasOwn(f.inferences,c.inferenceEstablished.inferenceId);
  if (c.determinationFiled) return Object.hasOwn(f.determinations,c.determinationFiled.determinationId);
  if (c.milestoneReached) return Object.hasOwn(f.milestones,c.milestoneReached.milestoneId);
  if (c.hasAccess) return grants.includes(c.hasAccess.grantId);
  if (c.evidenceCount) {
    const {filter,distinctBy,atLeast} = c.evidenceCount;
    const matches = d.evidence.filter(e => !e.retired && f.inspectedEvidenceIds.includes(e.id) &&
      (!filter.tagsAll || filter.tagsAll.every(tag => e.tags.includes(tag))) &&
      (!filter.tagsAny || filter.tagsAny.some(tag => e.tags.includes(tag))) &&
      (!filter.departments || filter.departments.includes(e.department)));
    return new Set(matches.map(e => distinctBy === 'source' ? e.sourceGroupId : e.department)).size >= atLeast;
  }
  throw new Error('Unvalidated condition');
}

export function deriveAccess(state,d) {
  const grants = [...d.initialGrantIds];
  for (const key of d.order) if (key.startsWith('g:')) {
    const p = d.accessPolicies.find(p => p.grantId === key.slice(2));
    if (p && evaluateCondition(p.when,state,d,grants) && !grants.includes(p.grantId)) grants.push(p.grantId);
  }
  return grants.sort();
}
export const deriveAvailability = (state,d) => d.availabilityPolicies.filter(p => evaluateCondition(p.when,state,d)).map(p => p.contentId).sort();
export const derivePresentation = (state,d) => Math.max(0,...d.presentationPolicies.filter(p => evaluateCondition(p.when,state,d)).map(p => p.distortionLevel));

// One pass in producer-before-consumer order reaches the fixed point of this acyclic language.
export function settleRules(state,d,{restore = false} = {}) {
  const events = [], grants = [...d.initialGrantIds];
  if (d.order.length > d.rules.length + d.milestoneIds.length + d.grants.length) throw new Error('Rule evaluation bounds exceeded');
  for (const key of d.order) {
    if (key.startsWith('g:')) {
      const p = d.accessPolicies.find(p => p.grantId === key.slice(2));
      if (p && evaluateCondition(p.when,state,d,grants) && !grants.includes(p.grantId)) grants.push(p.grantId);
    }
    if (!key.startsWith('r:')) continue;
    const r = byId(d.rules,key.slice(2));
    const receipt = state.ruleReceipts[r.id] ??= {activationCount:0,conditionWasTrue:false};
    const truth = evaluateCondition(r.when,state,d,grants);
    const fire = truth && (r.mode === 'once' ? receipt.activationCount === 0 : !receipt.conditionWasTrue);
    receipt.conditionWasTrue = truth;
    if (!fire) continue;
    receipt.activationCount++;
    for (const consequence of r.consequences) {
      if (consequence.reachMilestone) {
        const id = consequence.reachMilestone.milestoneId;
        if (!Object.hasOwn(state.facts.milestones,id)) {
          state.facts.milestones[id] = {ruleId:r.id};
          events.push(['hilfer:milestone-reached',{milestoneId:id,ruleId:r.id}]);
        }
      } else {
        const effectId = consequence.emitEffect.effectId;
        const occurrenceId = JSON.stringify([r.id,receipt.activationCount,effectId]);
        state.effectReceipts[occurrenceId] = {effectId,ruleId:r.id,activation:receipt.activationCount,status:restore ? 'skipped' : 'pending'};
      }
    }
  }
  return restore ? [] : events;
}
