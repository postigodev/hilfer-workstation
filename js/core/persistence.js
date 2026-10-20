import { initialState, validateResolution, applyCompletion } from './progression.js';
export const SAVE_KEY = 'hilfer:save:v1';

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
