import { escapeHTML as h } from './shared.js';
import { RECORD_MIME } from './shared.js';
export function mountReconciliation(root, store) {
  let selectedCaseId = store.getCases()[0].id;
  let message = 'Assignment received. Inspect departmental records and attach supporting evidence.';
  let draft = { value: '', sourceId: '' };
  function render() {
    const state = store.getState();
    const definition = store.getCases().find(c => c.id === selectedCaseId);
    const attached = state.attachedEvidence[selectedCaseId] ?? [];
    const completed = state.completedCaseIds.includes(selectedCaseId);
    const playable = !definition.placeholder && state.unlockedCaseIds.includes(selectedCaseId);
    root.innerHTML = `<div class="app-toolbar">Post-Incident Data Reconciliation <span>Operator 04</span></div><div class="reconciliation-layout"><nav class="case-list" aria-label="Cases"><div class="section-label">ASSIGNMENT REGISTER</div>${store.getCases().map(c => `<button data-case="${h(c.id)}" aria-pressed="${c.id === selectedCaseId}"><b>${h(c.id)}</b><span>${h(c.title)}</span><small>${state.completedCaseIds.includes(c.id) ? 'RECONCILED' : !state.unlockedCaseIds.includes(c.id) ? 'LOCKED' : c.placeholder ? 'AVAILABLE · PLACEHOLDER' : 'AVAILABLE'}</small></button>`).join('')}</nav><div class="case-detail"><div class="section-label">${h(definition.id)} / ${completed ? 'CONSOLIDATED' : 'DEPARTMENTAL REVIEW'}</div><h1>${h(definition.title)}</h1><p>${h(definition.description)}</p>${playable ? `<p class="scope">${h(definition.scope)}</p><h2>01 / Supporting records</h2><p>Required: ${definition.requiredEvidence.map(h).join(', ')} · ${attached.length} attached</p><div id="evidence-tray" class="evidence-tray" aria-label="Evidence drop zone"><span>Drop record IDs here</span>${attached.map(id => `<div class="evidence-card"><div><b>${h(id)}</b><br>${h(store.getRecord(id).title)}</div>${completed ? '<small>FILED</small>' : `<button data-remove="${h(id)}" aria-label="Remove ${h(id)}">Remove</button>`}</div>`).join('')}</div>${!completed ? `<form id="attach-form" class="attach-form"><label for="record-id">Attach by ID</label><input id="record-id" name="recordId" placeholder="e.g. HR-014" required><button>Attach</button></form>` : ''}<h2>02 / Consolidated determination</h2><form id="resolution-form"><fieldset ${completed ? 'disabled' : ''}><label for="status-value">Authoritative work eligibility</label><select id="status-value" name="value" required><option value="">Select classification…</option>${definition.statusOptions.map(value => `<option value="${h(value)}" ${value === (completed ? state.resolutions[selectedCaseId].value : draft.value) ? 'selected' : ''}>${h(value)}</option>`).join('')}</select><label for="source-id">Authoritative source</label><select id="source-id" name="sourceId" required><option value="">Select attached source…</option>${attached.map(id => `<option value="${h(id)}" ${id === (completed ? state.resolutions[selectedCaseId].sourceId : draft.sourceId) ? 'selected' : ''}>${h(id)} — ${h(store.getRecord(id).department)}</option>`).join('')}</select><button class="commit-button" ${completed ? 'disabled' : ''}>${completed ? 'Resolution committed' : 'Commit Resolution'}</button></fieldset></form>` : `<div class="placeholder-notice">${state.unlockedCaseIds.includes(selectedCaseId) ? 'Assignment released. Content pending; no further action is required in this demo.' : 'Locked. Complete the preceding assignment to release this placeholder.'}</div>`}<p class="feedback" role="status" aria-live="polite">${h(message)}</p></div></div>`;
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
      message = result.message; render();
    });
  }
  function attach(id) { message = store.attachEvidence(selectedCaseId, id).message; render(); }
  root.addEventListener('click', event => {
    const choice = event.target.closest('[data-case]');
    if (choice) { selectedCaseId = choice.dataset.case; draft = { value: '', sourceId: '' }; message = ''; render(); }
    const remove = event.target.closest('[data-remove]');
    if (remove) { message = store.removeEvidence(selectedCaseId, remove.dataset.remove).message; draft.sourceId = ''; render(); }
  });
  store.subscribe(render);
  store.onEvent(({ type }) => {
    if (type === 'hilfer:progress-reset') {
      selectedCaseId = store.getCases()[0].id; draft = { value: '', sourceId: '' };
      message = 'Demo progress reset. Assignment received.'; render();
    }
  });
  render();
  return { getActiveCaseId: () => selectedCaseId };
}
