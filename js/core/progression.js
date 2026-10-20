export function initialState(cases) {
  return { version: 1, discoveredEvidenceIds: [], attachedEvidence: {}, resolutions: {},
    completedCaseIds: [], unlockedCaseIds: cases.filter(c => c.initiallyUnlocked).map(c => c.id), distortionLevel: 0 };
}

export function validateResolution(definition, attachedIds, resolution, getRecord) {
  if (!definition || definition.placeholder || !definition.resolution) return 'This assignment is not playable.';
  if (!definition.requiredEvidence.every(id => attachedIds.includes(id))) return 'Attach all required evidence before committing.';
  const rule = definition.resolution;
  if (!resolution || resolution.field !== rule.field || resolution.value !== rule.value || resolution.sourceId !== rule.sourceId)
    return 'Unsupported determination. Review the clearance and its authoritative source.';
  const source = getRecord(resolution.sourceId);
  if (!attachedIds.includes(resolution.sourceId) || source?.fields[rule.field] !== resolution.value)
    return 'The attached authoritative source does not support this determination.';
  return null;
}

// Mutates runtime state only. Caller validates first and publishes returned milestone events.
export function applyCompletion(state, definition, resolution) {
  if (state.completedCaseIds.includes(definition.id)) return [];
  state.resolutions[definition.id] = { ...resolution };
  state.completedCaseIds.push(definition.id);
  const events = [['hilfer:case-reconciled', { caseId: definition.id, resolution: { ...resolution } }]];
  for (const caseId of definition.progression?.unlockCaseIds ?? []) {
    if (!state.unlockedCaseIds.includes(caseId)) {
      state.unlockedCaseIds.push(caseId);
      events.push(['hilfer:case-unlocked', { caseId, byCaseId: definition.id }]);
    }
  }
  const level = Math.max(state.distortionLevel, definition.progression?.distortionLevel ?? 0);
  if (level !== state.distortionLevel) {
    const previousLevel = state.distortionLevel;
    state.distortionLevel = level;
    events.push(['hilfer:distortion-changed', { previousLevel, level }]);
  }
  return events;
}
