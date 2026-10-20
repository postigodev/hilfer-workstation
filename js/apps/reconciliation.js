import { escapeHTML as h, label, RECORD_MIME } from './shared.js';
export function mountReconciliation(root, store) {
  let selectedCaseId = store.getCases()[0].id;
  let message = '';
  let draft = { value: '', sourceId: '' };

  function render() {
    const state = store.getState();
    const definition = store.getCases().find(c => c.id === selectedCaseId);
    const attached = state.attachedEvidence[selectedCaseId] ?? [];
    const completed = state.completedCaseIds.includes(selectedCaseId);
    const unlocked = state.unlockedCaseIds.includes(selectedCaseId);
    const playable = !definition.placeholder && unlocked;
    const resolution = completed ? state.resolutions[selectedCaseId] : draft;
    root.innerHTML = `<div class="app-toolbar"><span>HILFER / DATA RECONCILIATION</span><span>Operator 04</span></div>
      <div class="reconciliation-layout"><nav class="case-list" aria-label="Cases"><div class="pane-label">Case register</div>${store.getCases().map(c => `<button data-case="${h(c.id)}" aria-pressed="${c.id === selectedCaseId}"><b>${h(c.id)}</b><span>${h(c.title)}</span><small>${state.completedCaseIds.includes(c.id) ? 'RECONCILED' : !state.unlockedCaseIds.includes(c.id) ? 'LOCKED' : c.placeholder ? 'AVAILABLE · PLACEHOLDER' : 'OPEN'}</small></button>`).join('')}</nav>
      <div class="case-detail"><div class="case-metadata"><b>${h(definition.id)}</b><span>${h(definition.subjectId ?? '—')}</span><span>${completed ? 'RECONCILED' : unlocked ? 'OPEN' : 'LOCKED'}</span></div>
        <h1>${h(definition.category ?? definition.title)}</h1><p class="case-notice">${h(definition.description)}</p>
        ${playable ? `<section class="source-records"><h2>Source records</h2><div class="source-columns"><span>Reference</span><span>Document</span></div>
          <div id="evidence-tray" class="evidence-tray" aria-label="Evidence drop zone">${attached.map(id => `<div class="evidence-card"><b>${h(id)}</b><span>${h(store.getRecord(id).title)}</span>${completed ? '<small>FILED</small>' : `<button data-remove="${h(id)}" aria-label="Remove ${h(id)}">×</button>`}</div>`).join('')}<div class="drop-caption">${completed ? 'Consolidated record / read-only' : 'Drop additional records here'}</div></div>
          ${!completed ? `<form id="attach-form" class="attach-form"><label for="record-id">Reference</label><input id="record-id" name="recordId" aria-label="Record reference" required autocomplete="off"><button>Attach</button></form>` : ''}</section>
          <section class="determination"><h2>Consolidated entry</h2><form id="resolution-form"><fieldset ${completed ? 'disabled' : ''}>
            <label for="status-value">${h(label(definition.resolution.field))}</label><select id="status-value" name="value" required><option value="">Select…</option>${definition.statusOptions.map(value => `<option value="${h(value)}" ${value === resolution.value ? 'selected' : ''}>${h(value)}</option>`).join('')}</select>
            <label for="source-id">Source of authority</label><select id="source-id" name="sourceId" required><option value="">Select…</option>${attached.map(id => `<option value="${h(id)}" ${id === resolution.sourceId ? 'selected' : ''}>${h(id)} — ${h(store.getRecord(id).department)}</option>`).join('')}</select>
            <button class="commit-button" ${completed ? 'disabled' : ''}>${completed ? 'Resolution committed' : 'Commit Resolution'}</button></fieldset></form></section>`
          : `<div class="placeholder-notice">${unlocked ? 'Assignment released. Content pending; placeholder.' : 'Locked. Complete the preceding assignment to release this placeholder.'}</div>`}
        </div></div><p class="feedback" role="status" aria-live="polite">${h(message)}</p>`;
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
    message = result.ok ? `${id} filed for review.` : result.message;
    render();
  }
  root.addEventListener('click', event => {
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
  render();
  return { getActiveCaseId: () => selectedCaseId };
}
