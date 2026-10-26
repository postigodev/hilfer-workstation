import { escapeHTML as h, label } from './shared.js';
import { deriveReport, renderReport } from './report.js';

// Reconciliation is a document you revise with source claims, not a form or a file tray.
export function mountReconciliation(root, store, { openRecord = () => {} } = {}) {
  const cases = store.getCases();
  let selectedCaseId = cases[0]?.id;
  let view = 'report';
  let pendingClaim = null;
  let feedback = '';
  let feedbackTone = 'neutral';

  const sourceLink = id => '<button type="button" class="source-reference" data-open-record="' + h(id) + '">' + h(id) + '</button>';
  function showCase(definition, state) {
    if (!definition) return '<p>No assigned cases.</p>';
    const done = state.completedCaseIds.includes(definition.id);
    const unlocked = state.unlockedCaseIds.includes(definition.id);
    const current = done ? state.resolutions[definition.id] : definition.provisional;
    const source = current ? store.getRecord(current.sourceId) : null;
    const candidateRecord = pendingClaim && pendingClaim.caseId === definition.id
      ? store.getRecord(pendingClaim.recordId) : null;
    const candidateValue = candidateRecord?.fields?.[pendingClaim?.field];
    const alreadyCurrent = candidateRecord?.id === current?.sourceId;
    let comparison = '';
    if (candidateRecord && candidateValue !== undefined && !done) {
      comparison = '<section class="claim-compare" aria-label="Compare source claims">' +
        '<div class="pane-label">SOURCE COMPARISON</div>' +
        '<div class="claim-columns">' +
          '<div class="claim-option claim-current"><small>EXISTING ENTRY</small><strong>' + h(current?.value ?? '—') + '</strong><span>' + sourceLink(current?.sourceId ?? '') + '</span><time>' + h(source?.date?.slice(0, 10) ?? '') + '</time></div>' +
          '<div class="claim-option claim-candidate"><small>INSPECTED SOURCE</small><strong>' + h(candidateValue) + '</strong><span>' + sourceLink(candidateRecord.id) + '</span><time>' + h(candidateRecord.date?.slice(0, 10) ?? '') + '</time></div>' +
        '</div>' +
        (alreadyCurrent
          ? '<p class="claim-hint">This is the existing source. Examine another record to verify the entry.</p>'
          : '<div class="claim-choice"><button type="button" data-dismiss-claim>Keep existing</button><button type="button" class="claim-apply" data-use-claim="' + h(candidateRecord.id) + '">Use ' + h(candidateRecord.id) + ' in report</button></div>') +
        '</section>';
    }
    return '<div class="claim-case-view">' +
      '<div class="case-metadata"><div><small>CASE</small><b>' + h(definition.id) + '</b></div><div><small>SUBJECT</small><span>' + h(definition.subjectId ?? '—') + '</span></div><div><small>STATE</small><span>' + (done ? 'RECONCILED' : unlocked ? 'OPEN' : 'LOCKED') + '</span></div></div>' +
      '<h1>' + h(definition.category ?? definition.title) + '</h1>' +
      (!unlocked ? '<p>Assignment locked.</p>' : definition.placeholder ? '<p>Records not yet released.</p>' :
        '<div class="claim-existing"><div class="pane-label">' + (done ? 'FILED DETERMINATION' : 'CURRENT REPORT ENTRY / UNVERIFIED') + '</div>' +
          '<div class="claim-existing-row"><span>' + h(label(current?.field ?? definition.resolution.field)) + '</span><strong>' + h(current?.value ?? '—') + '</strong></div>' +
          '<div class="claim-existing-source">Source ' + (current ? sourceLink(current.sourceId) : '—') + '</div></div>' +
        (done
          ? '<p class="claim-hint">Determination filed. The report retains the source and its context.</p><button type="button" class="claim-open-report" data-view-entry="' + h(definition.id) + '">View report entry</button>'
          : comparison || '<div class="claim-next"><span class="file-symbol" aria-hidden="true"></span><span>Review departmental records. Select the relevant determination in a document.</span><button type="button" data-open="records">Open Records</button></div>')) +
      '</div>';
  }

  function render() {
    const previousFocus = root.contains(document.activeElement) ? document.activeElement.id : '';
    const scroll = root.querySelector('.report-scroll')?.scrollTop ?? 0;
    const state = store.getState();
    const report = deriveReport(cases, state, store.getRecord);
    const selected = cases.find(c => c.id === selectedCaseId);
    root.innerHTML =
      '<div class="app-toolbar"><span>HILFER / DATA RECONCILIATION</span><div class="application-actions"><button data-open="records">Records</button><button data-arrange>Arrange</button></div></div>' +
      '<div class="reconciliation-tabs" role="tablist" aria-label="Reconciliation views">' +
      '<button id="report-tab" role="tab" data-view="report" aria-selected="' + (view === 'report') + '" tabindex="' + (view === 'report' ? '0' : '-1') + '">Consolidated Report <span class="tab-progress">' + report.completed + '</span></button>' +
      '<button id="register-tab" role="tab" data-view="register" aria-selected="' + (view === 'register') + '" tabindex="' + (view === 'register' ? '0' : '-1') + '">Case Register</button></div>' +
      '<div id="reconciliation-panel" role="tabpanel" aria-labelledby="' + (view === 'report' ? 'report-tab' : 'register-tab') + '">' +
      (view === 'report' ? renderReport(report) :
        '<div class="reconciliation-layout"><nav class="case-list" aria-label="Cases"><div class="pane-label">CASE REGISTER</div>' +
          cases.map(c => '<button type="button" data-case="' + h(c.id) + '" aria-pressed="' + (selectedCaseId === c.id) + '"><b>' + h(c.id) + '</b><span>' + h(c.title) + '</span><small>' + (state.completedCaseIds.includes(c.id) ? 'FILED' : !state.unlockedCaseIds.includes(c.id) ? 'LOCKED' : c.placeholder ? 'RESERVED' : 'OPEN') + '</small></button>').join('') +
        '</nav><div class="case-detail">' + showCase(selected, state) + '</div></div>') +
      '</div><p class="feedback" data-tone="' + h(feedbackTone) + '" role="status" aria-live="polite">' +
      h(feedback || (view === 'report' ? 'Controlled internal record / work in progress' : 'Select a source in Records to amend an entry.')) + '</p>';
    if (previousFocus) root.querySelector('#' + previousFocus)?.focus({ preventScroll: true });
    if (view === 'report') root.querySelector('.report-scroll').scrollTop = scroll;
  }

  function presentClaim(recordId, field) {
    const record = store.getRecord(recordId);
    const definition = cases.find(c => c.initiallyUnlocked && c.resolution?.field === field && record?.caseIds?.includes(c.id))
      ?? cases.find(c => c.resolution?.field === field && record?.caseIds?.includes(c.id));
    if (!record || !definition || !store.getState().unlockedCaseIds.includes(definition.id))
      return { ok: false, message: 'No available report entry matches this claim.' };
    if (store.getState().completedCaseIds.includes(definition.id))
      return { ok: false, message: 'This report entry is already filed.' };
    store.discover(recordId);
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
    const tab = event.target.closest('[data-view]');
    if (tab) {
      view = tab.dataset.view; render(); root.querySelector('#' + view + '-tab')?.focus(); return;
    }
    const reference = event.target.closest('[data-open-record]');
    if (reference) { openRecord(reference.dataset.openRecord); return; }
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
      if (result.ok) root.querySelector('[data-report-section="' + selectedCaseId + '"]')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    const entry = event.target.closest('[data-view-entry]');
    if (entry) {
      view = 'report'; render();
      root.querySelector('[data-report-section="' + entry.dataset.viewEntry + '"]')?.scrollIntoView({ block: 'nearest' });
    }
  });
  store.subscribe(render);
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
    showReport() { view = 'report'; render(); }
  };
}
