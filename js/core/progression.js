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

// Compatibility compiler for callers using the original records/cases contract.
// Production loads an explicit JSON definition; neither engine module knows demo IDs.
export function createLegacyDefinition(records, cases) {
  const playable = cases.filter(c => c.resolution && !c.placeholder);
  const milestone = c => `${c.id}:filed`;
  const filed = c => ({milestoneReached:{milestoneId:milestone(c)}});
  return {
    schemaVersion:1, contentVersion:1,
    evidence:records.map(r => ({id:r.id,sourceGroupId:r.id,department:r.department ?? 'Unspecified',tags:[],
      artifacts:[{app:'records',artifactId:r.id,inspectionPolicyId:'document-open'}],fields:r.fields ?? {},
      caseIds:r.caseIds ?? [],requiredGrantIds:[]})),
    inferences:[],
    determinations:playable.map(c => ({id:`${c.id}:${c.resolution.field}`,caseId:c.id,claimId:c.resolution.field,
      field:c.resolution.field,value:c.resolution.value,sourceEvidenceIds:[c.resolution.sourceId],
      provenanceEvidenceIds:[...c.requiredEvidence],legacy:true})),
    milestoneIds:playable.map(milestone), grants:[], initialGrantIds:[],
    initialCaseIds:cases.filter(c => c.initiallyUnlocked).map(c => c.id),
    caseCompletionPolicies:playable.map(c => ({caseId:c.id,when:{determinationFiled:{determinationId:`${c.id}:${c.resolution.field}`}}})),
    accessPolicies:[],
    availabilityPolicies:cases.flatMap(c => {
      const producers = playable.filter(p => p.progression?.unlockCaseIds?.includes(c.id));
      return producers.length ? [{contentId:c.id,when:{any:producers.map(filed)}}] : [];
    }),
    presentationPolicies:playable.filter(c => c.progression?.distortionLevel).map(c => ({id:`${c.id}:appearance`,when:filed(c),distortionLevel:c.progression.distortionLevel})),
    effects:[],
    rules:playable.map(c => ({id:`${c.id}:completion`,mode:'once',when:{determinationFiled:{determinationId:`${c.id}:${c.resolution.field}`}},
      consequences:[{reachMilestone:{milestoneId:milestone(c)}}]}))
  };
}

export function projectLegacy(state, definition, cases, {availability,distortionLevel}) {
  const recordId = evidenceId => definition.evidence.find(e => e.id === evidenceId)?.artifacts.find(a => a.app === 'records')?.artifactId;
  const resolutions = {};
  for (const t of definition.determinations.filter(t => t.legacy)) {
    const fact = state.facts.determinations[t.id];
    if (fact) resolutions[t.caseId] = {field:fact.field,value:fact.value,sourceId:recordId(fact.sourceEvidenceId)};
  }
  return {
    version:1,
    discoveredEvidenceIds:state.facts.registeredEvidenceIds.map(recordId).filter(Boolean),
    attachedEvidence:Object.fromEntries(Object.entries(state.facts.attachedEvidence).map(([id,values]) => [id,values.map(recordId).filter(Boolean)])),
    resolutions,
    completedCaseIds:cases.filter(c => {
      const policy = definition.caseCompletionPolicies.find(p => p.caseId === c.id);
      return policy && availability.completed.includes(c.id);
    }).map(c => c.id),
    unlockedCaseIds:cases.filter(c => definition.initialCaseIds.includes(c.id) || availability.content.includes(c.id)).map(c => c.id),
    distortionLevel
  };
}
