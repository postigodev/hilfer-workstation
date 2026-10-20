import { escapeHTML as h, label, RECORD_MIME } from './shared.js';
export { RECORD_MIME } from './shared.js';
export function beginRecordDrag(event, recordId) {
  event.stopPropagation();
  event.dataTransfer.setData(RECORD_MIME, recordId);
  event.dataTransfer.setData('text/plain', recordId);
  event.dataTransfer.effectAllowed = 'copy';
}
// Temporary adapter: Lyden may replace this module without changing Reconciliation.
export function mountRecords(root, store) {
  root.innerHTML = `<div class="app-toolbar">Records / departmental extracts <span class="tag">TEMPORARY</span></div><p class="app-intro">Inspect a file, then drag its document into the Reconciliation evidence tray.</p><div class="record-list">${store.getRecords().map(r => `<details data-record="${h(r.id)}"><summary>${h(r.id)} — ${h(r.title)}</summary><article class="record-document" draggable="true" data-record-id="${h(r.id)}" tabindex="0" aria-label="Drag ${h(r.id)}"><div class="document-letterhead">HILFER / ${h(r.department)}</div><h2>${h(r.title)}</h2><dl><dt>Record</dt><dd>${h(r.id)}</dd><dt>Employee</dt><dd>${h(r.employee)} / ${h(r.employeeId)}</dd><dt>Issued</dt><dd>${h(r.date.replace('T',' '))}</dd><dt>Duty period</dt><dd>${h(r.workPeriod)}</dd>${Object.entries(r.fields).map(([key,value]) => `<dt>${h(label(key))}</dt><dd><strong>${h(value)}</strong></dd>`).join('')}</dl><p>${h(r.note)}</p><div class="document-footer">CONTROLLED COPY / drag to attach</div></article></details>`).join('')}</div>`;
  root.querySelectorAll('details').forEach(details => details.addEventListener('toggle', () => {
    if (details.open) store.discover(details.dataset.record);
  }));
  root.addEventListener('dragstart', event => {
    const card = event.target.closest('[data-record-id]');
    if (card) beginRecordDrag(event, card.dataset.recordId);
  });
  store.subscribe(state => {
    if (!state.discoveredEvidenceIds.length) root.querySelectorAll('details').forEach(d => { d.open = false; });
  });
}
