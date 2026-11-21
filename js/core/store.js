import { validateResolution, createLegacyDefinition, projectLegacy } from './progression.js';
import { initialSnapshot, loadSnapshot, saveSnapshot, validateSnapshot } from './persistence.js';
import { validateDefinitions, evaluateCondition, settleRules, deriveAccess, deriveAvailability, derivePresentation, exact } from './rules.js';

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const success = (message = '',extra = {}) => ({ok:true,changed:false,code:'OK',message,...extra});
const reject = (message,code = 'REJECTED') => ({ok:false,changed:false,code,message});
const sameSet = (a,b) => a.length === b.length && a.every(id=>b.includes(id));

export function createStore({records = [],cases = [],storage,progression = createLegacyDefinition(records,cases),contentMigrations = []}) {
  records = freeze(structuredClone(records)); cases = freeze(structuredClone(cases));
  const definition = freeze(validateDefinitions(progression,cases));
  let {state,warning,locked,restored} = loadSnapshot(storage,definition,cases,records,contentMigrations);
  settleRules(state,definition,{restore:true});
  const subscribers = new Set(), eventSubscribers = new Set(), engineSubscribers = new Set(), queue = [];
  let publishing = false;
  const getRecord = id => records.find(r=>r.id===id);
  const evidence = id => definition.evidence.find(e=>e.id===id);
  const evidenceForRecord = id => definition.evidence.find(e=>e.artifacts.some(a=>a.app==='records' && a.artifactId===id));
  const recordForEvidence = id => evidence(id)?.artifacts.find(a=>a.app==='records')?.artifactId;
  const access = s => deriveAccess(s,definition);
  const available = s => deriveAvailability(s,definition);
  const unlocked = (s,id) => definition.initialCaseIds.includes(id) || available(s).includes(id);
  const completed = s => definition.caseCompletionPolicies.filter(p=>evaluateCondition(p.when,s,definition)).map(p=>p.caseId);
  const legacy = s => {
    const view = projectLegacy(s,definition,cases,{availability:{content:available(s),completed:completed(s)},distortionLevel:derivePresentation(s,definition)});
    // Preserve historical empty-list normalization without changing canonical saved facts.
    if (restored) for (const c of cases) view.attachedEvidence[c.id] ??= [];
    return view;
  };
  const getState = () => legacy(state);
  const canInspect = (s,id) => {
    const e = evidence(id); return e && !e.retired && e.requiredGrantIds.every(grant=>access(s).includes(grant));
  };
  function register(draft,id,events) {
    if (draft.facts.registeredEvidenceIds.includes(id)) return;
    draft.facts.registeredEvidenceIds.push(id);
    const recordId = recordForEvidence(id);
    if (recordId) events.push(['hilfer:evidence-discovered',{recordId}]);
  }
  function attach(draft,caseId,id,events) {
    register(draft,id,events);
    const list = draft.facts.attachedEvidence[caseId] ??= [];
    if (!list.includes(id)) { list.push(id); const recordId = recordForEvidence(id); if (recordId) events.push(['hilfer:evidence-attached',{caseId,recordId}]); }
  }
  function file(draft,t,sourceId,origin,events,provenance = t.provenanceEvidenceIds) {
    for (const id of provenance) register(draft,id,events);
    draft.facts.determinations[t.id] = {caseId:t.caseId,claimId:t.claimId,field:t.field,value:t.value,
      sourceEvidenceId:sourceId,provenanceEvidenceIds:[...provenance],origin};
    events.push(['hilfer:determination-filed',{determinationId:t.id,caseId:t.caseId,sourceEvidenceId:sourceId}]);
  }
  function transition(draft,c,events) {
    const f = draft.facts;
    if (c.type === 'inspectEvidence') {
      exact(c,['type','evidenceId']);
      if (!canInspect(draft,c.evidenceId)) return reject('Evidence is unavailable.');
      if (f.inspectedEvidenceIds.includes(c.evidenceId)) return success();
      register(draft,c.evidenceId,events); f.inspectedEvidenceIds.push(c.evidenceId);
      events.push(['hilfer:evidence-inspected',{evidenceId:c.evidenceId}]); return success();
    }
    if (c.type === 'establishInference') {
      exact(c,['type','inferenceId','evidenceIds']);
      const i = definition.inferences.find(i=>i.id===c.inferenceId);
      if (!i || i.retired || !Array.isArray(c.evidenceIds) || new Set(c.evidenceIds).size !== c.evidenceIds.length) return reject('Unknown inference or invalid support.');
      if (Object.hasOwn(f.inferences,i.id)) return sameSet(f.inferences[i.id].evidenceIds,c.evidenceIds) ? success() : reject('This inference is already established with different support.');
      if (!i.supportAlternatives.some(a=>sameSet(a,c.evidenceIds)) || !c.evidenceIds.every(id=>f.inspectedEvidenceIds.includes(id) && canInspect(draft,id)) || !evaluateCondition(i.requires,draft,definition))
        return reject('Inspect and supply an authorized support alternative before establishing this inference.');
      f.inferences[i.id] = {evidenceIds:[...c.evidenceIds].sort()}; events.push(['hilfer:inference-established',{inferenceId:i.id,evidenceIds:[...c.evidenceIds].sort()}]); return success();
    }
    if (c.type === 'fileDetermination') {
      exact(c,['type','determinationId','sourceEvidenceId']);
      const t = definition.determinations.find(t=>t.id===c.determinationId);
      if (!t || t.retired) return reject('Unknown determination.');
      if (Object.hasOwn(f.determinations,t.id)) return f.determinations[t.id].sourceEvidenceId === c.sourceEvidenceId ? success('',{alreadyCompleted:true}) : reject('Filed determinations are immutable.');
      if (!unlocked(draft,t.caseId) || !t.sourceEvidenceIds.includes(c.sourceEvidenceId) || !f.inspectedEvidenceIds.includes(c.sourceEvidenceId) ||
          !t.provenanceEvidenceIds.every(id=>canInspect(draft,id)) || !evaluateCondition(t.requires,draft,definition)) return reject('Inspect an authorized supporting source before filing.');
      if (t.legacy) {
        const caseDef = cases.find(c=>c.id===t.caseId), baseline = caseDef.provisional;
        const source = getRecord(recordForEvidence(c.sourceEvidenceId)), base = getRecord(baseline?.sourceId);
        if (!base || baseline.field !== t.field || base.fields[t.field] !== baseline.value || !base.caseIds.includes(t.caseId)) return reject('The existing entry has no valid source provenance.');
        if (source?.id === baseline.sourceId) return reject('This is already the provisional source. Compare another record.');
        const linked = [evidenceForRecord(baseline.sourceId)?.id,c.sourceEvidenceId];
        const ids = [...new Set([...(f.attachedEvidence[t.caseId] ?? []),...linked])];
        const error = validateResolution(caseDef,ids.map(recordForEvidence),{field:t.field,value:source?.fields[t.field],sourceId:source?.id},getRecord);
        if (error) return reject(error);
        for (const id of linked) attach(draft,t.caseId,id,events);
        file(draft,t,c.sourceEvidenceId,'claim',events,[...f.attachedEvidence[t.caseId]]);
      } else {
        if (!t.provenanceEvidenceIds.every(id=>id===c.sourceEvidenceId || f.inspectedEvidenceIds.includes(id) || (f.attachedEvidence[t.caseId] ?? []).includes(id))) return reject('Missing supporting provenance.');
        file(draft,t,c.sourceEvidenceId,'claim',events);
      }
      return success('Consolidated entry updated.');
    }
    if (['attachEvidence','removeEvidence','submitResolution'].includes(c.type)) {
      exact(c,['type','caseId', c.type === 'submitResolution' ? 'resolution' : 'recordId']);
      const caseDef = cases.find(d=>d.id===c.caseId);
      if (!caseDef || caseDef.placeholder || !unlocked(draft,c.caseId)) return reject('This case is locked, unknown or does not accept evidence.');
      if (completed(draft).includes(c.caseId)) return c.type === 'submitResolution' ? success('This determination is already committed.',{alreadyCompleted:true}) : reject('Committed evidence is read-only.');
      if (c.type === 'submitResolution') {
        const ids = (f.attachedEvidence[c.caseId] ?? []).map(recordForEvidence);
        const error = validateResolution(caseDef,ids,c.resolution,getRecord); if (error) return reject(error);
        const t = definition.determinations.find(t=>t.legacy && t.caseId===c.caseId);
        if (!t || t.retired || !t.provenanceEvidenceIds.every(id=>canInspect(draft,id))) return reject('Determination sources are unavailable.');
        if (!evaluateCondition(t.requires,draft,definition)) return reject('Determination prerequisites are not satisfied.');
        file(draft,t,t.sourceEvidenceIds[0],'legacy-api',events,[...f.attachedEvidence[c.caseId]]); return success('Resolution committed.');
      }
      const e = evidenceForRecord(c.recordId);
      if (!e || !canInspect(draft,e.id) || !e.caseIds.includes(c.caseId)) return reject('Unknown, inaccessible or irrelevant record ID.');
      const list = f.attachedEvidence[c.caseId] ?? [];
      if (c.type === 'attachEvidence') {
        if (list.includes(e.id)) return reject('This record is already attached.');
        attach(draft,c.caseId,e.id,events);
      } else if (list.includes(e.id)) f.attachedEvidence[c.caseId] = list.filter(id=>id!==e.id);
      return success();
    }
    if (c.type === 'ackEffect') {
      exact(c,['type','occurrenceId','status']); const r = draft.effectReceipts[c.occurrenceId];
      if (!r || !['claimed','delivered','skipped'].includes(c.status)) return reject('Unknown occurrence or status.');
      if (r.status === c.status) return success();
      if (!(r.status === 'pending' && ['claimed','skipped'].includes(c.status)) && !(r.status === 'claimed' && ['delivered','skipped'].includes(c.status))) return reject('Invalid effect acknowledgment transition.');
      r.status = c.status; return success();
    }
    return reject('Unknown command.','INVALID_COMMAND');
  }
  function execute(c) {
    if (locked && c?.type !== 'resetProgress') return reject(warning,'SAVE_BLOCKED');
    const before = getState(), beforeAccess = access(state), beforeAvailable = available(state);
    const draft = c?.type === 'resetProgress' ? initialSnapshot(definition) : structuredClone(state);
    const events = [];
    let result, ruleEvents;
    try {
      if (c?.type === 'resetProgress') { exact(c,['type']); result = success(); events.push(['hilfer:progress-reset',{}]); }
      else result = transition(draft,c,events);
      if (!result.ok) return result;
      if (c.type !== 'resetProgress' && JSON.stringify(draft) === JSON.stringify(state)) return result;
      ruleEvents = settleRules(draft,definition,{restore:c.type === 'resetProgress'});
      validateSnapshot(draft,definition,cases);
    } catch (error) { return reject(error.message,'INVALID_COMMAND'); }
    const after = legacy(draft);
    if (c.type !== 'resetProgress') {
      for (const caseId of after.completedCaseIds.filter(id=>!before.completedCaseIds.includes(id))) {
        const resolution = after.resolutions[caseId];
        events.push(['hilfer:case-reconciled',{caseId,...(resolution ? {resolution} : {})}]);
      }
      for (const caseId of after.unlockedCaseIds.filter(id=>!before.unlockedCaseIds.includes(id))) {
        const byCaseId = after.completedCaseIds.find(id=>!before.completedCaseIds.includes(id));
        events.push(['hilfer:case-unlocked',{caseId,...(byCaseId ? {byCaseId} : {})}]);
      }
      if (after.distortionLevel !== before.distortionLevel) events.push(['hilfer:distortion-changed',{previousLevel:before.distortionLevel,level:after.distortionLevel}]);
    }
    const changes = (a,b) => ({added:b.filter(id=>!a.includes(id)),removed:a.filter(id=>!b.includes(id))});
    const grants = changes(beforeAccess,access(draft)), content = changes(beforeAvailable,available(draft));
    if (grants.added.length || grants.removed.length) ruleEvents.push(['hilfer:access-changed',{addedGrantIds:grants.added,removedGrantIds:grants.removed}]);
    if (content.added.length || content.removed.length) ruleEvents.push(['hilfer:availability-changed',{addedContentIds:content.added,removedContentIds:content.removed}]);
    const saveWarning = saveSnapshot(storage,draft);
    if (c.type === 'ackEffect' && c.status === 'claimed' && saveWarning) { warning = saveWarning; return reject(saveWarning,'SAVE_FAILED'); }
    state = draft; warning = saveWarning; locked = false;
    if (c.type === 'resetProgress') restored = false;
    publishing = true;
    try {
      for (const fn of subscribers) { try { fn(getState()); } catch (error) { console.error(error); } }
      const isLegacy = type => ['hilfer:evidence-discovered','hilfer:evidence-attached','hilfer:case-reconciled',
        'hilfer:case-unlocked','hilfer:distortion-changed','hilfer:progress-reset'].includes(type);
      for (const [type,detail] of [...events,...ruleEvents]) {
        const listeners = [...engineSubscribers, ...(isLegacy(type) ? eventSubscribers : [])];
        for (const fn of listeners) { try { fn({type,detail:structuredClone(detail)}); } catch (error) { console.error(error); } }
      }
    } finally { publishing = false; }
    while (queue.length) execute(queue.shift());
    return {...result,changed:true};
  }
  function dispatch(command) {
    if (publishing) { queue.push(structuredClone(command)); return success('Command queued.',{code:'QUEUED'}); }
    return execute(command);
  }
  return {
    getRecord,getRecords:()=>records,getCases:()=>cases,getState,getSnapshot:()=>structuredClone(state),getWarning:()=>warning,
    getAccess:()=>access(state),getAvailability:()=>available(state),getDefinitions:()=>definition,
    getCompletedCaseIds:()=>completed(state),
    evidenceForArtifact(app,artifactId) { return definition.evidence.find(e=>!e.retired && e.artifacts.some(a=>a.app===app && a.artifactId===artifactId))?.id ?? null; },
    subscribe(fn) { subscribers.add(fn); return ()=>subscribers.delete(fn); },
    onEvent(fn) { eventSubscribers.add(fn); return ()=>eventSubscribers.delete(fn); },
    onEngineEvent(fn) { engineSubscribers.add(fn); return ()=>engineSubscribers.delete(fn); },
    dispatch,
    discover(recordId) { const e = evidenceForRecord(recordId); return e ? dispatch({type:'inspectEvidence',evidenceId:e.id}) : reject('Unknown record ID.'); },
    attachEvidence:(caseId,recordId)=>dispatch({type:'attachEvidence',caseId,recordId}),
    removeEvidence:(caseId,recordId)=>dispatch({type:'removeEvidence',caseId,recordId}),
    submitResolution:(caseId,resolution)=>dispatch({type:'submitResolution',caseId,resolution}),
    reconcileClaim(caseId,recordId,field) {
      const e = evidenceForRecord(recordId), t = definition.determinations.find(t=>t.legacy && t.caseId===caseId && t.field===field);
      if (!e || !t) return reject('Inspect a relevant source claim before revising this entry.');
      return dispatch({type:'fileDetermination',determinationId:t.id,sourceEvidenceId:e.id});
    },
    resetProgress:()=>dispatch({type:'resetProgress'})
  };
}
