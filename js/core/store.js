import { initialState, validateResolution, applyCompletion } from './progression.js';
import { loadProgress, saveProgress } from './persistence.js';

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function createStore({ records, cases, storage }) {
  records = freeze(structuredClone(records));
  cases = freeze(structuredClone(cases));
  let { state, warning } = loadProgress(storage, cases, records);
  const subscribers = new Set();
  const eventSubscribers = new Set();
  const getRecord = id => records.find(r => r.id === id);
  const getState = () => structuredClone(state);
  function publish(events = []) {
    warning = saveProgress(storage, state);
    for (const fn of subscribers) fn(getState());
    for (const [type, detail] of events) for (const fn of eventSubscribers) fn({ type, detail: structuredClone(detail) });
  }
  function discover(recordId) {
    if (!getRecord(recordId)) return { ok: false, message: 'Unknown record ID.' };
    if (state.discoveredEvidenceIds.includes(recordId)) return { ok: true };
    state.discoveredEvidenceIds.push(recordId);
    publish([['hilfer:evidence-discovered', { recordId }]]);
    return { ok: true };
  }
  return {
    getRecord, getRecords: () => records, getCases: () => cases, getState, getWarning: () => warning,
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    onEvent(fn) { eventSubscribers.add(fn); return () => eventSubscribers.delete(fn); },
    discover,
    attachEvidence(caseId, recordId) {
      const definition = cases.find(c => c.id === caseId);
      if (!definition || !state.unlockedCaseIds.includes(caseId)) return { ok: false, message: 'This case is locked or unknown.' };
      if (definition.placeholder || state.completedCaseIds.includes(caseId)) return { ok: false, message: 'This case does not accept evidence.' };
      const record = getRecord(recordId);
      if (!record) return { ok: false, message: 'Unknown record ID.' };
      if (!record.caseIds.includes(caseId)) return { ok: false, message: 'This record is not relevant to the selected case.' };
      const attached = state.attachedEvidence[caseId] ??= [];
      if (attached.includes(recordId)) return { ok: false, message: 'This record is already attached.' };
      const events = [];
      if (!state.discoveredEvidenceIds.includes(recordId)) {
        state.discoveredEvidenceIds.push(recordId);
        events.push(['hilfer:evidence-discovered', { recordId }]);
      }
      attached.push(recordId);
      events.push(['hilfer:evidence-attached', { caseId, recordId }]);
      publish(events);
      return { ok: true, message: `${recordId} attached. A formal determination is still required.` };
    },
    removeEvidence(caseId, recordId) {
      const definition = cases.find(c => c.id === caseId);
      if (!definition || definition.placeholder || !state.unlockedCaseIds.includes(caseId)) return { ok: false, message: 'This case does not accept evidence.' };
      if (state.completedCaseIds.includes(caseId)) return { ok: false, message: 'Committed evidence is read-only.' };
      state.attachedEvidence[caseId] = (state.attachedEvidence[caseId] ?? []).filter(id => id !== recordId);
      publish();
      return { ok: true, message: `${recordId} removed.` };
    },
    submitResolution(caseId, resolution) {
      if (state.completedCaseIds.includes(caseId)) return { ok: true, alreadyCompleted: true, message: 'This determination is already committed.' };
      if (!state.unlockedCaseIds.includes(caseId)) return { ok: false, message: 'This case is locked or unknown.' };
      const definition = cases.find(c => c.id === caseId);
      const error = validateResolution(definition, state.attachedEvidence[caseId] ?? [], resolution, getRecord);
      if (error) return { ok: false, message: error };
      // Persist only the small canonical determination, never caller-supplied extra fields.
      const events = applyCompletion(state, definition, definition.resolution);
      publish(events);
      return { ok: true, message: 'Resolution committed. Consolidated work eligibility updated. Next assignment released.' };
    },

    // The player selects a claim inside Records, then approves it against the report's
    // existing provisional source. No separate drag, dropdown, or Commit step.
    reconcileClaim(caseId, recordId, field) {
      const definition = cases.find(c => c.id === caseId);
      if (!definition || definition.placeholder || !state.unlockedCaseIds.includes(caseId))
        return { ok: false, message: 'This case is not available.' };
      if (state.completedCaseIds.includes(caseId))
        return { ok: true, alreadyCompleted: true, message: 'This report entry is already filed.' };
      const source = getRecord(recordId);
      if (!source || !state.discoveredEvidenceIds.includes(recordId) ||
          !source.caseIds.includes(caseId) || field !== definition.resolution?.field)
        return { ok: false, message: 'Inspect a relevant source claim before revising this entry.' };
      const baseline = definition.provisional;
      const baselineRecord = getRecord(baseline?.sourceId);
      if (!baselineRecord || baseline.field !== field ||
          baselineRecord.fields[field] !== baseline.value || !baselineRecord.caseIds.includes(caseId))
        return { ok: false, message: 'The existing entry has no valid source provenance.' };
      if (recordId === baseline.sourceId)
        return { ok: false, message: 'This is already the provisional source. Compare another record.' };
      const candidate = { field, value: source.fields[field], sourceId: recordId };
      const linkedIds = [baseline.sourceId, recordId];
      const ids = [...new Set([...(state.attachedEvidence[caseId] ?? []), ...linkedIds])];
      const error = validateResolution(definition, ids, candidate, getRecord);
      if (error) return { ok: false, message: error };
      // The initial entry is an official source already present in the report.
      // File only the two compared sources. Other required evidence must
      // already be linked; a comparison cannot invent supporting records.
      const attached = state.attachedEvidence[caseId] ??= [];
      const events = [];
      for (const id of linkedIds) {
        if (!state.discoveredEvidenceIds.includes(id)) {
          // The baseline is part of the displayed report; filing it makes
          // its provenance available for inspection and consistent on reload.
          state.discoveredEvidenceIds.push(id);
          events.push(['hilfer:evidence-discovered', { recordId: id }]);
        }
        if (!attached.includes(id)) {
          attached.push(id);
          events.push(['hilfer:evidence-attached', { caseId, recordId: id }]);
        }
      }
      events.push(...applyCompletion(state, definition, candidate));
      publish(events);
      return { ok: true, message: 'Consolidated entry updated from ' + recordId + '.' };
    },
    resetProgress() { state = initialState(cases); publish([['hilfer:progress-reset', {}]]); }
  };
}
