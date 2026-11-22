import { escapeHTML as h, displayField, displayValue, displayDate } from './shared.js';
import { deriveReport, renderReport } from './report.js';
import { renderInvestigationCase } from './investigation-cases.js';

// Reconciliation is a document you revise with source claims, not a form or a file tray.
export function mountReconciliation(root, store, { openRecord = () => {}, artifacts } = {}) {
  const cases = store.getCases();
  let selectedCaseId = cases[0]?.id;
  let view = 'report';
  let pendingClaim = null;
  let feedback = '';
  let feedbackTone = 'neutral';

  const canOpenRecord = id => !artifacts || artifacts.canOpen('records',id);
  const getVisibleRecord = id => canOpenRecord(id) ? store.getRecord(id) : null;
  const sourceLink = (id, text = id) => canOpenRecord(id) ? '<button type="button" class="source-reference" data-open-record="' + h(id) + '">' + h(text) + '</button>' : '<span>Source unavailable</span>';
  function showCase(definition, state) {
    if (!definition) return '<p>No assigned cases.</p>';
    if (definition.investigation) return renderInvestigationCase(definition,store,artifacts,sourceLink);
    const done = state.completedCaseIds.includes(definition.id);
    const unlocked = state.unlockedCaseIds.includes(definition.id);
    const current = done ? state.resolutions[definition.id] : definition.provisional;
    const source = current ? getVisibleRecord(current.sourceId) : null;
    const candidateRecord = pendingClaim && pendingClaim.caseId === definition.id
      ? getVisibleRecord(pendingClaim.recordId) : null;
    const candidateValue = candidateRecord?.fields?.[pendingClaim?.field];
    const alreadyCurrent = candidateRecord?.id === current?.sourceId;
    let comparison = '';
    if (candidateRecord && candidateValue !== undefined && !done) {
      comparison = '<section class="claim-compare" tabindex="-1" aria-label="Compare source claims">' +
        '<table class="claim-table"><caption>Source comparison</caption><thead><tr><th scope="col">Source</th><th scope="col">Issued</th><th scope="col">Work status</th></tr></thead><tbody>' +
          '<tr><th scope="row">' + h(source?.department ?? 'Source unavailable') + '<small>CURRENT REPORT · ' + sourceLink(current?.sourceId ?? '') + '</small></th><td>' + h(displayDate(source?.date, true)) + '</td><td><strong>' + h(displayValue(current?.value ?? '—')) + '</strong></td></tr>' +
          '<tr><th scope="row">' + h(candidateRecord.department) + '<small>NEW SOURCE · ' + sourceLink(candidateRecord.id) + '</small></th><td>' + h(displayDate(candidateRecord.date, true)) + '</td><td><strong>' + h(displayValue(candidateValue)) + '</strong></td></tr>' +
        '</tbody></table>' +
        (alreadyCurrent
          ? '<p class="claim-hint">This is the existing source. Examine another record to verify the entry.</p>'
          : '<div class="claim-choice"><button type="button" data-dismiss-claim>Continue reviewing</button><button type="button" class="claim-apply" data-use-claim="' + h(candidateRecord.id) + '">Update report</button></div>') +
        '</section>';
    }
    return '<div class="claim-case-view">' +
      '<div class="case-metadata"><div><small>CASE</small><b>' + h(definition.id) + '</b></div><div><small>SUBJECT</small><span>' + h(definition.subjectId ?? '—') + '</span></div><div><small>STATE</small><span>' + (done ? 'RECONCILED' : unlocked ? 'OPEN' : 'LOCKED') + '</span></div></div>' +
      '<h1>' + h(source?.employee ? source.employee + ' — ' + displayField(current.field) : definition.category ?? definition.title) + '</h1>' +
      (!unlocked ? '<p>Assignment locked.</p>' : definition.placeholder ? '<p>Records not yet released.</p>' :
        (comparison ? '' : '<div class="claim-existing"><div class="pane-label">' + (done ? 'FILED DETERMINATION' : 'CURRENT REPORT ENTRY / UNVERIFIED') + '</div>' +
          '<div class="claim-existing-row"><span>' + h(displayField(current?.field ?? definition.resolution.field)) + '</span><strong>' + h(displayValue(current?.value ?? '—')) + '</strong></div>' +
          '<div class="claim-existing-source">Source ' + (current ? sourceLink(current.sourceId, source?.department ?? current.sourceId) : '—') + '</div></div>') +
        (done
          ? '<p class="claim-hint">Determination filed.</p><button type="button" class="claim-open-report" data-view-entry="' + h(definition.id) + '">View report entry</button>'
          : comparison || '<div class="claim-next"><span>Select a determination in Records to compare sources.</span><button type="button" data-open="records">Open Records</button></div>')) +
      '</div>';
  }

  function render() {
    const previousFocus = root.contains(document.activeElement) ? document.activeElement.id : '';
    const scroll = root.querySelector('.report-scroll')?.scrollTop ?? 0;
    const openDetails = [...root.querySelectorAll('[data-audit-id][open]')].map(el => el.dataset.auditId);
    const state = store.getState();
    const visibleCases = cases.filter(c=>!artifacts || artifacts.caseVisible(c.id));
    const defs=store.getDefinitions(), facts=store.getSnapshot().facts;
    const formalFindings={};
    for (const fact of Object.values(facts.determinations)) {
      if(fact.origin==='migration-v1'||fact.caseId==='CASE-001')continue;
      const ev=defs.evidence.find(e=>e.id===fact.sourceEvidenceId);
      const recordId=ev?.artifacts.find(a=>a.app==='records')?.artifactId;
      if(recordId)formalFindings[fact.caseId]={field:fact.field,value:fact.value,sourceId:recordId};
    }
    const report = deriveReport(visibleCases, state, getVisibleRecord,{getSourceForValidation:store.getRecord,formalFindings});
    const selected = visibleCases.find(c => c.id === selectedCaseId);
    root.innerHTML =
      '<div class="app-toolbar"><span>Reconciliation</span><div class="application-actions"><button data-open="records">Records</button><button data-arrange>Arrange</button></div></div>' +
      '<div class="reconciliation-tabs" role="tablist" aria-label="Reconciliation views">' +
      '<button id="report-tab" role="tab" aria-controls="reconciliation-panel" data-view="report" aria-selected="' + (view === 'report') + '" tabindex="' + (view === 'report' ? '0' : '-1') + '">Consolidated Report</button>' +
      '<button id="register-tab" role="tab" aria-controls="reconciliation-panel" data-view="register" aria-selected="' + (view === 'register') + '" tabindex="' + (view === 'register' ? '0' : '-1') + '">Case Register</button></div>' +
      '<div id="reconciliation-panel" role="tabpanel" aria-labelledby="' + (view === 'report' ? 'report-tab' : 'register-tab') + '">' +
      (view === 'report' ? renderReport(report,{canOpenRecord}) :
        '<div class="reconciliation-layout"><nav class="case-list" aria-label="Cases"><div class="pane-label">CASE REGISTER</div>' +
          visibleCases.map(c => '<button type="button" data-case="' + h(c.id) + '" aria-pressed="' + (selectedCaseId === c.id) + '"><b>' + h(c.id) + '</b><span>' + h(c.title) + '</span><small>' + (state.completedCaseIds.includes(c.id) ? 'FILED' : !state.unlockedCaseIds.includes(c.id) ? 'LOCKED' : c.placeholder ? 'RESERVED' : 'OPEN') + '</small></button>').join('') +
        '</nav><div class="case-detail">' + showCase(selected, state) + '</div></div>') +
      '</div><div class="feedback status-bar" data-tone="' + h(feedbackTone) + '" role="status" aria-live="polite"><span class="status-bar-field">' +
      h(feedback || (view === 'report' ? 'Report / work in progress' : 'Select a source in Records to amend an entry.')) + '</span></div>';
    root.querySelectorAll('[data-audit-id]').forEach(el => { el.open = openDetails.includes(el.dataset.auditId); });
    if (previousFocus) root.querySelector('#' + previousFocus)?.focus({ preventScroll: true });
    if (view === 'report') root.querySelector('.report-scroll').scrollTop = scroll;
  }

  function presentClaim(recordId, field) {
    const record = getVisibleRecord(recordId);
    const definition = cases.find(c => c.initiallyUnlocked && c.resolution?.field === field && record?.caseIds?.includes(c.id))
      ?? cases.find(c => c.resolution?.field === field && record?.caseIds?.includes(c.id));
    if (!record || !definition || !store.getState().unlockedCaseIds.includes(definition.id))
      return { ok: false, message: 'No available report entry matches this claim.' };
    if(artifacts && !artifacts.caseVisible(definition.id)) return {ok:false,message:'Content unavailable.'};
    if (store.getState().completedCaseIds.includes(definition.id))
      return { ok: false, message: 'This report entry is already filed.' };
    const evidenceId = store.evidenceForArtifact('records', recordId);
    if (!store.getSnapshot().facts.inspectedEvidenceIds.includes(evidenceId))
      return { ok: false, message: 'Inspect this source in Records before comparing its claim.' };
    selectedCaseId = definition.id;
    pendingClaim = { caseId: definition.id, recordId, field };
    view = 'register';
    feedbackTone = 'neutral';
    feedback = 'Review the source comparison.';
    render();
    root.querySelector('.claim-compare')?.scrollIntoView({ block: 'nearest' });
    return { ok: true };
  }

  root.addEventListener('keydown', event => {
    if (!event.target.matches('[role="tab"]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    view = event.key === 'Home' ? 'report' : event.key === 'End' ? 'register' : view === 'report' ? 'register' : 'report';
    render(); root.querySelector('#' + view + '-tab')?.focus();
  });
  root.addEventListener('click', event => {
    const inferButton=event.target.closest('[data-inference-id]');
    if(inferButton){
      const inference=store.getDefinitions().inferences.find(i=>i.id===inferButton.dataset.inferenceId);
      const sources=inference?.supportAlternatives[Number(inferButton.dataset.inferenceAlt)];
      const result=sources?store.dispatch({type:'establishInference',inferenceId:inference.id,evidenceIds:sources}):
        {ok:false,message:'Unknown evidence route.'};
      feedbackTone=result.ok?'success':'error'; feedback=result.message|| (result.ok?'Relationship established.':'Relationship not supported.');
      render();return;
    }
    const fileButton=event.target.closest('[data-file-determination]');
    if(fileButton){
      const result=store.dispatch({type:'fileDetermination',determinationId:fileButton.dataset.fileDetermination,sourceEvidenceId:fileButton.dataset.sourceEvidence});
      feedbackTone=result.ok?'success':'error';feedback=result.message||(result.ok?'Determination filed.':'Source review incomplete.');
      if(result.ok)view='report';
      render();return;
    }
    const tab = event.target.closest('[data-view]');
    if (tab) {
      view = tab.dataset.view; render(); root.querySelector('#' + view + '-tab')?.focus(); return;
    }
    const reference = event.target.closest('[data-open-record]');
    if (reference) { event.stopPropagation(); openRecord(reference.dataset.openRecord); return; }
    const choice = event.target.closest('[data-case], [data-report-case]');
    if (choice) {
      selectedCaseId = choice.dataset.case ?? choice.dataset.reportCase;
      pendingClaim = null; view = 'register'; feedback = ''; render(); return;
    }
    if (event.target.closest('[data-dismiss-claim]')) {
      pendingClaim = null; feedback = 'Existing entry retained; review continues.'; render(); return;
    }
    const use = event.target.closest('[data-use-claim]');
    if (use && pendingClaim) {
      const result = store.reconcileClaim(pendingClaim.caseId, pendingClaim.recordId, pendingClaim.field);
      feedbackTone = result.ok ? 'success' : 'error';
      feedback = result.message;
      if (result.ok) { pendingClaim = null; view = 'report'; }
      render();
      if (result.ok) {
        const section = root.querySelector('[data-report-section="' + selectedCaseId + '"]');
        section?.scrollIntoView({ block: 'nearest' });
        section?.focus({ preventScroll: true });
      }
      return;
    }
    const entry = event.target.closest('[data-view-entry]');
    if (entry) {
      view = 'report'; render();
      root.querySelector('[data-report-section="' + entry.dataset.viewEntry + '"]')?.scrollIntoView({ block: 'nearest' });
    }
  });
  store.subscribe(render);
  artifacts?.subscribe(render);
  store.onEvent(({ type }) => {
    if (type === 'hilfer:progress-reset') {
      selectedCaseId = cases[0]?.id; pendingClaim = null; view = 'report';
      feedback = 'Session reset.'; feedbackTone = 'neutral'; render();
    }
  });
  render();
  return {
    getActiveCaseId: () => selectedCaseId,
    presentClaim,
    focusComparison() { root.querySelector('.claim-compare')?.focus({ preventScroll: true }); },
    showReport() { view = 'report'; render(); }
  };
}
