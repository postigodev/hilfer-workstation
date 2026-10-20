import { escapeHTML as h, label, RECORD_MIME } from './shared.js';
import { deriveReport, renderReport } from './report.js';
export function mountReconciliation(root, store, { openRecord = () => {} } = {}) {
  let selectedCaseId = store.getCases()[0].id;
  let message = '';
  let view = 'register';
  let draft = { value: '', sourceId: '' };

  function render() {
    const focusedId = root.contains(document.activeElement) ? document.activeElement.id : '';
    const reportScroll = root.querySelector('.report-scroll')?.scrollTop ?? 0;
    const state = store.getState();
    const report = deriveReport(store.getCases(), state, store.getRecord);
    const definition = store.getCases().find(c => c.id === selectedCaseId);
    const attached = state.attachedEvidence[selectedCaseId] ?? [];
    const completed = state.completedCaseIds.includes(selectedCaseId);
    const unlocked = state.unlockedCaseIds.includes(selectedCaseId);
    const playable = !definition.placeholder && unlocked;
    const resolution = completed ? state.resolutions[selectedCaseId] : draft;
    root.innerHTML = `<div class="app-toolbar"><span>HILFER / DATA RECONCILIATION</span><span>Operator 04</span></div>
      <div class="reconciliation-tabs" role="tablist" aria-label="Reconciliation views"><button id="register-tab" role="tab" aria-selected="${view === 'register'}" aria-controls="reconciliation-panel" tabindex="${view === 'register' ? 0 : -1}" data-view="register">Case Register</button><button id="report-tab" role="tab" aria-selected="${view === 'report'}" aria-controls="reconciliation-panel" tabindex="${view === 'report' ? 0 : -1}" data-view="report">Consolidated Report <span class="tab-progress">${report.completed}</span></button></div>
      <div id="reconciliation-panel" role="tabpanel" aria-labelledby="${view === 'report' ? 'report-tab' : 'register-tab'}">${view === 'report' ? renderReport(report) : `<div class="reconciliation-layout"><nav class="case-list" aria-label="Cases"><div class="pane-label">Case register</div>${store.getCases().map(c => `<button data-case="${h(c.id)}" aria-pressed="${c.id === selectedCaseId}"><b>${h(c.id)}</b><span>${h(c.title)}</span><small>${state.completedCaseIds.includes(c.id) ? 'RECONCILED' : !state.unlockedCaseIds.includes(c.id) ? 'LOCKED' : c.placeholder ? 'AVAILABLE · PLACEHOLDER' : 'OPEN'}</small></button>`).join('')}</nav>
      <div class="case-detail"><div class="case-metadata"><b>${h(definition.id)}</b><span>${h(definition.subjectId ?? '—')}</span><span>${completed ? 'RECONCILED' : unlocked ? 'OPEN' : 'LOCKED'}</span></div>
        <h1>${h(definition.category ?? definition.title)}</h1><p class="case-notice">${h(definition.description)}</p>
        ${playable ? `<section class="source-records"><h2>${completed ? 'Filed references' : 'Associated records'} <span class="association-state">${completed ? 'FILED' : 'PROVISIONAL'}</span></h2><div class="source-columns"><span>Reference</span><span>Document</span></div>
          <div id="evidence-tray" class="evidence-tray" aria-label="Evidence drop zone">${attached.map(id => `<div class="evidence-card"><button type="button" class="source-reference" data-open-record="${h(id)}" aria-label="Open record ${h(id)}">${h(id)}</button><span>${h(store.getRecord(id).title)}</span>${completed ? '<small>FILED</small>' : `<button data-remove="${h(id)}" aria-label="Remove ${h(id)}">×</button>`}</div>`).join('')}<div class="drop-caption">${completed ? 'Consolidated record / read-only' : 'Drop additional records here'}</div></div>
          ${!completed ? `<form id="attach-form" class="attach-form"><label for="record-id">Reference</label><input id="record-id" name="recordId" aria-label="Record reference" required autocomplete="off"><button>Attach</button></form>` : ''}</section>
          <section class="determination"><h2>Consolidated entry <span class="association-state">${completed ? 'RECORDED' : 'AWAITING COMMIT'}</span></h2><form id="resolution-form"><fieldset ${completed ? 'disabled' : ''}>
            <label for="status-value">${h(label(definition.resolution.field))}</label><select id="status-value" name="value" required><option value="">Select…</option>${definition.statusOptions.map(value => `<option value="${h(value)}" ${value === resolution.value ? 'selected' : ''}>${h(value)}</option>`).join('')}</select>
            <label for="source-id">Source of authority</label><select id="source-id" name="sourceId" required><option value="">Select…</option>${attached.map(id => `<option value="${h(id)}" ${id === resolution.sourceId ? 'selected' : ''}>${h(id)} — ${h(store.getRecord(id).department)}</option>`).join('')}</select>
            <button class="commit-button" ${completed ? 'disabled' : ''}>${completed ? 'Resolution committed' : 'Commit Resolution'}</button></fieldset></form>${completed ? `<button type="button" class="view-entry" data-view-entry="${h(selectedCaseId)}">View consolidated entry →</button>` : ''}</section>`
          : `<div class="placeholder-notice">${unlocked ? 'Assignment released. Content pending; placeholder.' : 'Locked. Complete the preceding assignment to release this placeholder.'}</div>`}
        </div></div>`}</div><p class="feedback" role="status" aria-live="polite">${h(message)}</p>`;
    if (focusedId) root.querySelector(`#${focusedId}`)?.focus({ preventScroll: true });
    if (view === 'report') root.querySelector('.report-scroll').scrollTop = reportScroll;
    const tray = root.querySelector('#evidence-tray');
    tray?.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; tray.classList.add('drag-over'); });
    tray?.addEventListener('dragleave', () => tray.classList.remove('drag-over'));
    tray?.addEventListener('drop', event => {
      event.preventDefault();
      const id = event.dataTransfer.getData(RECORD_MIME) || event.dataTransfer.getData('text/plain');
      attach(id.trim());
    });
    root.querySelector('#attach-form')?.addEventListener('submit', event => {
      event.preventDefault(); attach(new FormData(event.target).get('recordId').trim());
    });
    root.querySelector('#resolution-form')?.addEventListener('change', event => { draft[event.target.name] = event.target.value; });
    root.querySelector('#resolution-form')?.addEventListener('submit', event => {
      event.preventDefault();
      const fields = new FormData(event.target);
      const result = store.submitResolution(selectedCaseId, { field: definition.resolution.field, value: fields.get('value'), sourceId: fields.get('sourceId') });
      message = result.ok ? 'Resolution committed. Consolidated entry updated.' : result.message;
      render();
    });
  }
  function attach(id) {
    const result = store.attachEvidence(selectedCaseId, id);
    message = result.ok ? `${id} associated · provisional.` : result.message;
    render();
  }
  root.addEventListener('keydown', event => {
    if (!event.target.matches('[role="tab"]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    view = event.key === 'Home' ? 'register' : event.key === 'End' ? 'report' : view === 'register' ? 'report' : 'register';
    render(); root.querySelector(`#${view === 'report' ? 'report' : 'register'}-tab`).focus();
  });
  root.addEventListener('click', event => {
    const tab = event.target.closest('[data-view]');
    if (tab) { view = tab.dataset.view; render(); root.querySelector(`#${view === 'report' ? 'report' : 'register'}-tab`).focus(); }
    const entry = event.target.closest('[data-view-entry]');
    if (entry) {
      view = 'report'; render();
      const section = root.querySelector(`[data-report-section="${entry.dataset.viewEntry}"]`);
      section?.scrollIntoView({ block: 'nearest' }); section?.focus({ preventScroll: true });
    }
    const reportCase = event.target.closest('[data-report-case]');
    if (reportCase) {
      if (selectedCaseId !== reportCase.dataset.reportCase) draft = { value: '', sourceId: '' };
      selectedCaseId = reportCase.dataset.reportCase; view = 'register'; message = ''; render();
      root.querySelector(`[data-case="${selectedCaseId}"]`)?.focus();
    }
    const source = event.target.closest('[data-open-record]');
    if (source) openRecord(source.dataset.openRecord);
    const choice = event.target.closest('[data-case]');
    if (choice) { selectedCaseId = choice.dataset.case; draft = { value: '', sourceId: '' }; message = ''; render(); }
    const remove = event.target.closest('[data-remove]');
    if (remove) { message = store.removeEvidence(selectedCaseId, remove.dataset.remove).message; draft.sourceId = ''; render(); }
  });
  store.subscribe(render);
  store.onEvent(({ type }) => {
    if (type === 'hilfer:progress-reset') {
      selectedCaseId = store.getCases()[0].id; draft = { value: '', sourceId: '' }; message = 'Session reset.'; render();
    }
  });
  document.addEventListener('dragstart', event => {
    if (event.dataTransfer?.types.includes(RECORD_MIME)) root.classList.add('record-drag-active');
  });
  for (const type of ['dragend', 'drop']) document.addEventListener(type, () => root.classList.remove('record-drag-active'));
  render();
  return { getActiveCaseId: () => selectedCaseId };
}
