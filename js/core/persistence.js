import { initialState, validateResolution, applyCompletion } from './progression.js';
import { validateDefinitions, exact, settleRules, evaluateCondition } from './rules.js';
import {initialStory,validateStorySnapshot} from './story.js';
export const SAVE_KEY = 'hilfer:save:v1';
export const V2_SAVE_KEY = 'hilfer:save:v2';

export function loadProgress(storage, cases, records) {
  const state = initialState(cases);
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { state, warning: '' };
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !Array.isArray(saved.discoveredEvidenceIds) ||
        !saved.attachedEvidence || typeof saved.attachedEvidence !== 'object' ||
        !saved.resolutions || typeof saved.resolutions !== 'object') throw new Error('Incompatible save');
    const getRecord = id => records.find(r => r.id === id);
    state.discoveredEvidenceIds = [...new Set(saved.discoveredEvidenceIds.filter(id => getRecord(id)))];
    // Restore only known, relevant attachments; replay valid resolutions to derive progression.
    for (const definition of cases) {
      const ids = saved.attachedEvidence[definition.id];
      state.attachedEvidence[definition.id] = Array.isArray(ids)
        ? [...new Set(ids.filter(id => getRecord(id)?.caseIds.includes(definition.id)))] : [];
    }
    let advanced;
    do {
      advanced = false;
      for (const definition of cases) {
        if (!state.unlockedCaseIds.includes(definition.id) || state.completedCaseIds.includes(definition.id)) continue;
        const resolution = saved.resolutions[definition.id];
        if (!validateResolution(definition, state.attachedEvidence[definition.id], resolution, getRecord)) {
          applyCompletion(state, definition, resolution);
          advanced = true;
        }
      }
    } while (advanced);
    for (const definition of cases) {
      if (!state.unlockedCaseIds.includes(definition.id)) state.attachedEvidence[definition.id] = [];
    }
    state.discoveredEvidenceIds = [...new Set([...state.discoveredEvidenceIds, ...Object.values(state.attachedEvidence).flat()])];
    return { state, warning: '' };
  } catch {
    return { state, warning: 'Saved progress could not be loaded. A clean session is active.' };
  }
}

export function saveProgress(storage, state) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(state)); return ''; }
  catch { return 'Progress cannot be saved in this browser. Keep this session open or enable local storage.'; }
}

export function initialSnapshot(definition) {
  return {version:2,contentVersion:definition.contentVersion,
    facts:{registeredEvidenceIds:[],inspectedEvidenceIds:[],attachedEvidence:{},inferences:{},determinations:{},milestones:{},...(definition.story?{story:initialStory()}: {})},
    ruleReceipts:{},effectReceipts:{}};
}

const mapObject = value => value && typeof value === 'object' && !Array.isArray(value);
const check = (truth,message) => { if (!truth) throw new Error(message); };
function knownIds(values,known) {
  check(Array.isArray(values) && new Set(values).size === values.length && values.every(id => known.includes(id)), 'Unknown or duplicate saved IDs');
}

// Validate accepted history against its versioned definitions, not current access/conditions.
export function validateSnapshot(input,d,cases) {
  exact(input,['version','contentVersion','facts','ruleReceipts','effectReceipts']);
  check(input.version === 2 && input.contentVersion === d.contentVersion,'Incompatible save version');
  const s = structuredClone(input), f = s.facts;
  exact(f,['registeredEvidenceIds','inspectedEvidenceIds','attachedEvidence','inferences','determinations','milestones',...(d.story?['story']:[])]);
  if(d.story)validateStorySnapshot(f.story,d.story,f,d.caseCompletionPolicies.filter(p=>evaluateCondition(p.when,s,d)).map(p=>p.caseId));
  const evidenceIds = d.evidence.map(e=>e.id);
  knownIds(f.registeredEvidenceIds,evidenceIds); knownIds(f.inspectedEvidenceIds,f.registeredEvidenceIds);
  for (const key of ['attachedEvidence','inferences','determinations','milestones']) check(mapObject(f[key]),'Malformed saved facts');
  for (const [caseId,values] of Object.entries(f.attachedEvidence)) {
    check(cases.some(c=>c.id===caseId),'Unknown saved case'); knownIds(values,evidenceIds);
    check(values.every(id=>d.evidence.find(e=>e.id===id).caseIds.includes(caseId) && f.registeredEvidenceIds.includes(id)),'Invalid saved attachment');
  }
  for (const [id,fact] of Object.entries(f.inferences)) {
    const def = d.inferences.find(i=>i.id===id); check(def,'Unknown saved inference'); exact(fact,['evidenceIds']); knownIds(fact.evidenceIds,f.inspectedEvidenceIds);
    check(def.supportAlternatives.some(a=>a.length===fact.evidenceIds.length && a.every(id=>fact.evidenceIds.includes(id))),'Unsupported saved inference');
  }
  for (const [id,fact] of Object.entries(f.determinations)) {
    const def = d.determinations.find(t=>t.id===id); check(def,'Unknown saved determination');
    exact(fact,['caseId','claimId','field','value','sourceEvidenceId','provenanceEvidenceIds','origin']);
    check(['caseId','claimId','field','value'].every(key=>fact[key]===def[key]) && def.sourceEvidenceIds.includes(fact.sourceEvidenceId),'Unsupported saved determination');
    knownIds(fact.provenanceEvidenceIds,f.registeredEvidenceIds);
    check(fact.provenanceEvidenceIds.includes(fact.sourceEvidenceId) && def.provenanceEvidenceIds.every(id=>fact.provenanceEvidenceIds.includes(id)),'Missing saved provenance');
    check(['claim','legacy-api','migration-v1'].includes(fact.origin),'Unknown determination origin');
    if (fact.origin === 'claim') check(f.inspectedEvidenceIds.includes(fact.sourceEvidenceId),'Missing source inspection');
  }
  check(mapObject(s.ruleReceipts) && mapObject(s.effectReceipts),'Malformed receipts');
  for (const [id,receipt] of Object.entries(s.ruleReceipts)) {
    check(d.rules.some(r=>r.id===id),'Unknown saved rule'); exact(receipt,['activationCount','conditionWasTrue']);
    check(Number.isSafeInteger(receipt.activationCount) && receipt.activationCount >= 0 && typeof receipt.conditionWasTrue === 'boolean','Malformed rule receipt');
    check(d.rules.find(r=>r.id===id).mode !== 'once' || receipt.activationCount <= 1,'Invalid once receipt');
  }
  for (const [id,fact] of Object.entries(f.milestones)) {
    exact(fact,['ruleId']); check(d.milestoneIds.includes(id),'Unknown saved milestone');
    check(d.rules.some(r=>r.id===fact.ruleId && r.consequences.some(c=>c.reachMilestone?.milestoneId===id)) && s.ruleReceipts[fact.ruleId]?.activationCount > 0,'Invalid milestone provenance');
  }
  for (const [id,receipt] of Object.entries(s.effectReceipts)) {
    exact(receipt,['effectId','ruleId','activation','status']);
    check(id === JSON.stringify([receipt.ruleId,receipt.activation,receipt.effectId]) && Number.isSafeInteger(receipt.activation) && receipt.activation > 0,'Invalid occurrence identity');
    check(d.effects.some(e=>e.id===receipt.effectId) && d.rules.some(r=>r.id===receipt.ruleId && r.consequences.some(c=>c.emitEffect?.effectId===receipt.effectId)), 'Unknown saved effect');
    check(receipt.activation <= (s.ruleReceipts[receipt.ruleId]?.activationCount ?? 0) && ['pending','claimed','delivered','skipped'].includes(receipt.status),'Invalid effect receipt');
  }
  return s;
}

export function saveSnapshot(storage,state) {
  try {
    const raw = JSON.stringify(state); storage.setItem(V2_SAVE_KEY,raw);
    if (storage.getItem(V2_SAVE_KEY) !== raw) throw new Error('Save verification failed');
    return '';
  } catch { return 'Progress cannot be saved in this browser. Keep this session open or enable local storage.'; }
}

// Migrations are trusted repo functions, but may not accidentally erase accepted facts/receipts.
function validateMigrationHistory(before,after,step,source) {
  const maps = step.ids ?? {};
  exact(maps,[],['evidence','inferences','determinations','milestones','rules','effects','cases','claims','fields']);
  const collections = {evidence:source.evidence.map(e=>e.id),inferences:source.inferences.map(i=>i.id),
    determinations:source.determinations.map(t=>t.id),milestones:source.milestoneIds,rules:source.rules.map(r=>r.id),
    effects:source.effects.map(e=>e.id),cases:step.sourceCases.map(c=>c.id),claims:source.determinations.map(t=>t.claimId),fields:source.determinations.map(t=>t.field)};
  const mapped = (kind,id) => maps[kind]?.[id] ?? id;
  for (const [kind,mapping] of Object.entries(maps)) {
    check(mapObject(mapping),'Invalid ID migration map');
    const original = [...new Set(collections[kind])];
    check(Object.keys(mapping).every(id=>original.includes(id)) && Object.values(mapping).every(id=>typeof id==='string' && id.length>0),'Unknown ID migration mapping');
    const targets = original.map(id=>mapped(kind,id));
    check(new Set(targets).size === targets.length,'Migration ID collision');
  }
  const sameIds = (a,b) => Array.isArray(a) && Array.isArray(b) && a.length===b.length && a.every(id=>b.includes(id));
  const f = before.facts, target = after.facts;
  if(f.story)check(JSON.stringify(f.story)===JSON.stringify(target?.story),'Migration lost story history');
  check(target && sameIds(f.inspectedEvidenceIds.map(id=>mapped('evidence',id)),target.inspectedEvidenceIds),'Migration lost or invented inspection history');
  check(f.registeredEvidenceIds.every(id=>target.registeredEvidenceIds?.includes(mapped('evidence',id))),'Migration lost registered history');
  for (const [caseId,values] of Object.entries(f.attachedEvidence)) check(values.every(id=>target.attachedEvidence?.[mapped('cases',caseId)]?.includes(mapped('evidence',id))),'Migration lost attachments');
  for (const [id,fact] of Object.entries(f.inferences)) check(sameIds(fact.evidenceIds.map(id=>mapped('evidence',id)),target.inferences?.[mapped('inferences',id)]?.evidenceIds),'Migration lost inference history');
  for (const [id,fact] of Object.entries(f.determinations)) {
    const next = target.determinations?.[mapped('determinations',id)];
    check(next && next.caseId===mapped('cases',fact.caseId) && next.claimId===mapped('claims',fact.claimId) && next.field===mapped('fields',fact.field) && next.value===fact.value && next.origin===fact.origin &&
      next.sourceEvidenceId===mapped('evidence',fact.sourceEvidenceId) && sameIds(fact.provenanceEvidenceIds.map(id=>mapped('evidence',id)),next.provenanceEvidenceIds),'Migration lost or changed accepted determination');
  }
  for (const [id,fact] of Object.entries(f.milestones)) check(target.milestones?.[mapped('milestones',id)]?.ruleId===mapped('rules',fact.ruleId),'Migration lost milestone history');
  for (const [id,receipt] of Object.entries(before.ruleReceipts)) {
    const next = after.ruleReceipts?.[mapped('rules',id)];
    check(next && next.activationCount===receipt.activationCount && next.conditionWasTrue===receipt.conditionWasTrue,'Migration lost rule receipt');
  }
  for (const receipt of Object.values(before.effectReceipts)) {
    const id = JSON.stringify([mapped('rules',receipt.ruleId),receipt.activation,mapped('effects',receipt.effectId)]);
    check(after.effectReceipts?.[id]?.status===receipt.status,'Migration lost or reactivated effect receipt');
  }
}

function preserveBackup(storage,version,raw) {
  let suffix=0;
  for (;;) {
    const key = `${V2_SAVE_KEY}:backup:${version}${suffix ? ':'+suffix : ''}`;
    const previous = storage.getItem(key);
    if (previous===raw) return;
    if (previous==null) { storage.setItem(key,raw); check(storage.getItem(key)===raw,'Could not verify original save backup'); return; }
    suffix++;
  }
}

function upgradeContent(parsed,d,cases,steps) {
  while (parsed.contentVersion < d.contentVersion) {
    const candidates = steps.filter(m=>m.from===parsed.contentVersion);
    check(candidates.length === 1,'Missing or ambiguous content migration');
    const step = candidates[0];
    check(step.to===step.from+1 && typeof step.migrate==='function','Invalid content migration');
    const source = validateDefinitions(step.sourceDefinition,step.sourceCases);
    check(source.contentVersion === step.from,'Migration source version mismatch');
    const accepted = validateSnapshot(parsed,source,step.sourceCases);
    const migrated = step.migrate(structuredClone(accepted));
    check(migrated?.version === 2 && migrated.contentVersion === step.to,'Migration did not advance exactly one version');
    validateMigrationHistory(accepted,migrated,step,source);
    parsed = migrated;
  }
  return validateSnapshot(parsed,d,cases);
}

function fromV1(legacy,d,cases) {
  const s = initialSnapshot(d), f = s.facts;
  const evidenceId = id => d.evidence.find(e=>e.artifacts.some(a=>a.app==='records' && a.artifactId===id))?.id;
  f.registeredEvidenceIds = [...new Set(legacy.discoveredEvidenceIds.map(evidenceId).filter(Boolean))];
  for (const c of cases) f.attachedEvidence[c.id] = [...new Set((legacy.attachedEvidence[c.id] ?? []).map(evidenceId).filter(Boolean))];
  for (const [caseId,resolution] of Object.entries(legacy.resolutions)) {
    const def = d.determinations.find(t=>t.legacy && t.caseId===caseId);
    check(def && def.sourceEvidenceIds.includes(evidenceId(resolution.sourceId)) && def.field===resolution.field && def.value===resolution.value,'v1 determination has no compatible mapping');
    f.determinations[def.id] = {caseId,claimId:def.claimId,field:def.field,value:def.value,sourceEvidenceId:evidenceId(resolution.sourceId),
      provenanceEvidenceIds:[...f.attachedEvidence[caseId]],origin:'migration-v1'};
  }
  settleRules(s,d,{restore:true});
  return validateSnapshot(s,d,cases);
}

export function loadSnapshot(storage,d,cases,records,contentMigrations = []) {
  const clean = () => initialSnapshot(d);
  let raw;
  try { raw = storage.getItem(V2_SAVE_KEY); }
  catch { return {state:clean(),warning:'Saved progress is unavailable; this session is in memory.',locked:false}; }
  if (raw !== null && raw !== undefined) {
    try {
      const parsed = JSON.parse(raw);
      check(parsed?.version === 2 && Number.isSafeInteger(parsed.contentVersion) && parsed.contentVersion <= d.contentVersion,'Unsupported save/content version');
      const originalVersion = parsed.contentVersion;
      const state = upgradeContent(parsed,d,cases,contentMigrations);
      for (const receipt of Object.values(state.effectReceipts)) if (['pending','claimed'].includes(receipt.status)) receipt.status = 'skipped';
      settleRules(state,d,{restore:true});
      if (originalVersion !== d.contentVersion) {
        try {
          preserveBackup(storage,originalVersion,raw);
        } catch { return {state,locked:true,warning:'Content migration could not preserve the original save. Progress writes are blocked.'}; }
      }
      return {state,warning:saveSnapshot(storage,state),locked:false,restored:true};
    } catch (error) {
      return {state:clean(),locked:true,warning:`Saved progress preserved; writes are blocked: ${error.message}`};
    }
  }
  let legacyRaw;
  try { legacyRaw = storage.getItem(SAVE_KEY); }
  catch { return {state:clean(),locked:false,warning:'Saved progress is unavailable; this session is in memory.'}; }
  if (!legacyRaw) return {state:clean(),warning:'',locked:false};
  try {
    // A v1 file predates contentVersion. Always validate it against content 1,
    // then use the same audited migration chain as a v2 content-1 save.
    const origin = d.contentVersion === 1 ? {definition:d,cases,records} : (() => {
      const first = contentMigrations.find(m=>m.from===1);
      check(first,'Missing original content definitions for v1 migration');
      const source = validateDefinitions(first.sourceDefinition,first.sourceCases);
      check(source.contentVersion===1,'Invalid v1 migration source');
      const historicalRecords = source.evidence.flatMap(e=>e.artifacts.filter(a=>a.app==='records').map(a=>({id:a.artifactId,fields:e.fields,caseIds:e.caseIds})));
      return {definition:source,cases:first.sourceCases,records:historicalRecords};
    })();
    const legacy = loadProgress(storage,origin.cases,origin.records);
    if (legacy.warning) return {state:clean(),warning:legacy.warning,locked:false};
    const state = upgradeContent(fromV1(legacy.state,origin.definition,origin.cases),d,cases,contentMigrations);
    settleRules(state,d,{restore:true});
    return {state,warning:saveSnapshot(storage,state),locked:false};
  } catch (error) { return {state:clean(),locked:true,warning:`Original v1 progress preserved; writes are blocked: ${error.message}`}; }
}
