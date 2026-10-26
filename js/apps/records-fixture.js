import { escapeHTML as h, label, displayValue, displayDate, recordTitle, RECORD_MIME } from './shared.js';
export { RECORD_MIME } from './shared.js';
export function beginRecordDrag(event, recordId) {
  event.stopPropagation();
  event.dataTransfer.setData(RECORD_MIME, recordId);
  event.dataTransfer.setData('text/plain', recordId);
  event.dataTransfer.effectAllowed = 'copy';
}

// Presentation only: IDs, discovery and drag validation still belong to the shared store.
export function renderRecord(record) {
  const fields = (entries) => `<dl class="document-fields">${entries.map(([name, value]) => `<dt>${h(name)}</dt><dd>${h(value)}</dd>`).join('')}</dl>`;
  const identity = `<div class="document-identity"><strong>${h(record.employee)}</strong></div>`;
  const reference = fields([['Record reference', record.id], ['Issued', displayDate(record.date)], ['Effective period', record.workPeriod]]);
  const auditDetails = `<details class="record-details"><summary>Record details · ${h(record.id)}</summary>${reference}${fields([['Employee ID',record.employeeId], ...Object.entries(record.fields).map(([key,value]) => [label(key),value])])}</details>`;
  const claimControl = `<button type="button" class="claim-source" data-claim-record="${h(record.id)}" data-claim-field="workEligibility" aria-label="Compare ${h(displayValue(record.fields.workEligibility))} from ${h(record.id)} with the report"><strong>${h(displayValue(record.fields.workEligibility))}</strong><small>Compare status with report</small></button>`;
  let content;
  if (record.type === 'personnel_status') {
    content = `<header class="document-heading"><b>HILFER / HUMAN RESOURCES</b><span>Personnel File</span></header>
      <div class="personnel-identity"><figure class="portrait-placeholder"><img src="assets/placeholders/personnel.svg" alt="Employee portrait placeholder"><figcaption>PHOTO / PENDING</figcaption></figure><div>${identity}</div></div>
      <p class="document-date">Recorded ${h(displayDate(record.date))}</p><section class="document-determination"><h3>Work status</h3>${claimControl}</section>
      <p class="document-note">${h(record.note)}</p>${auditDetails}<footer class="document-authorization"><b>AUTHORIZED HR EXTRACT</b><span>${h(record.department)}</span></footer>`;
  } else if (record.type === 'occupational_health_record') {
    content = `<header class="document-heading medical-heading"><b>HILFER / OCCUPATIONAL HEALTH</b><span>Work Clearance</span></header>
      ${identity}<p class="document-date">Issued ${h(displayDate(record.date))}</p><section class="document-determination medical-determination"><h3>Medical work clearance</h3>${claimControl}</section>
      ${fields([['Work-related cause', displayValue(record.fields.occupationalCausation)]])}<p class="document-note">${h(record.note)}</p>${auditDetails}
      <footer class="document-authorization"><span>ISSUING OFFICE</span><b>${h(record.department)}</b></footer>`;
  } else {
    content = `<header class="document-heading"><b>${h(record.department)}</b><span>${h(record.title)}</span></header>${identity}${reference}${fields(Object.entries(record.fields).map(([key, value]) => [label(key), value]))}`;
  }
  return `<article class="record-document ${record.type === 'occupational_health_record' ? 'medical-document' : ''}" tabindex="0" aria-label="Inspect ${h(record.id)}">${content}</article>`;
}

// Replaceable Records UI. No case rules or duplicated game state live here.
export function mountRecords(root, store, { onClaim = () => {} } = {}) {
  let selectedId = null;
  let department = '';
  let query = '';
  const departments = [...new Set(store.getRecords().map(r => r.department))];
  root.innerHTML = `<div class="app-toolbar"><span>Records</span><div class="application-actions"><button data-open="reconciliation">Reconciliation</button><button data-arrange aria-label="Arrange workspace">Arrange</button></div></div>
    <form class="records-search" role="search"><label for="records-search">Find</label><input type="search" id="records-search" placeholder="Name, reference or department" autocomplete="off"><button type="button" id="clear-search">Clear</button></form>
    <div class="records-explorer"><nav class="folder-tree" aria-label="Departments"><div class="pane-label">Departments</div><button data-folder="" aria-pressed="true"><span class="folder-symbol" aria-hidden="true"></span>All departments</button>${departments.map(name => `<button data-folder="${h(name)}" aria-pressed="false"><span class="folder-symbol" aria-hidden="true"></span>${h(name)}</button>`).join('')}</nav>
      <section class="files-pane" aria-label="Record list"><div class="pane-label">Documents</div><div id="record-files"></div></section>
      <section class="preview-pane" aria-label="Document preview"><div class="preview-reference" id="preview-reference">Document preview</div><div class="preview-scroll" id="record-preview"></div></section></div>
    <div class="preview-drag-bar" id="preview-drag-bar" hidden></div>
    <div class="records-status"><span id="record-count"></span><span id="record-drag-hint">Read-only</span></div>`;

  function renderFiles() {
    const records = store.getRecords().filter(record => (!department || record.department === department) &&
      [record.id, record.title, record.employee, record.employeeId, record.department].join(' ').toLowerCase().includes(query.toLowerCase()));
    if (!records.some(r => r.id === selectedId)) selectedId = null;
    root.querySelector('#record-files').innerHTML = records.length ? records.map(record => `<button class="record-file" data-file-id="${h(record.id)}" data-record-id="${h(record.id)}" aria-pressed="${selectedId === record.id}"><b><span class="file-symbol" aria-hidden="true"></span>${h(recordTitle(record))}</b><span>${h(record.department)} <time datetime="${h(record.date.slice(0, 10))}">· ${h(displayDate(record.date, true))}</time></span><small>${h(record.id)}</small></button>`).join('') : '<p class="files-empty">No matching records.</p>';
    root.querySelector('#record-count').textContent = `${records.length} document${records.length === 1 ? '' : 's'}`;
    root.querySelectorAll('[data-folder]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.folder === department)));
    const record = store.getRecord(selectedId);
    root.querySelector('#preview-reference').textContent = record ? recordTitle(record) : 'Preview / no file selected';
    root.querySelector('#record-drag-hint').textContent = record ? `Selected / ${record.id}` : 'Read-only';
    root.querySelector('#record-preview').innerHTML = record ? renderRecord(record) : '<div class="preview-empty"><span class="preview-empty-sheet" aria-hidden="true"></span><b>No document selected</b><span>Select a document to inspect its fields.</span></div>';
    root.querySelector('#record-preview').scrollTop = 0;
    const dragBar = root.querySelector('#preview-drag-bar');
    dragBar.hidden = true;
    dragBar.innerHTML = '';
  }
  root.querySelector('.records-search').addEventListener('submit', event => event.preventDefault());
  root.querySelector('#records-search').addEventListener('input', event => { query = event.target.value; renderFiles(); });
  root.querySelector('#clear-search').addEventListener('click', () => { query = ''; root.querySelector('#records-search').value = ''; renderFiles(); root.querySelector('#records-search').focus(); });
  root.addEventListener('click', event => {
    const claim = event.target.closest('[data-claim-record]');
    if (claim) {
      // The shell also focuses clicked windows at document level. Prevent it
      // from bringing Records back over Reconciliation after this action.
      event.stopPropagation();
      const result = onClaim(claim.dataset.claimRecord, claim.dataset.claimField);
      if (result?.ok === false) root.querySelector('#record-drag-hint').textContent = result.message;
      return;
    }
    const folder = event.target.closest('[data-folder]');
    if (folder) { department = folder.dataset.folder; renderFiles(); }
    const file = event.target.closest('[data-file-id]');
    if (file) { selectedId = file.dataset.fileId; store.discover(selectedId); renderFiles(); }
  });
  root.addEventListener('dragstart', event => {
    const file = event.target.closest('[data-record-id]');
    if (file) beginRecordDrag(event, file.dataset.recordId);
  });
  root.addEventListener('keydown', event => {
    const current = event.target.closest('[data-file-id]');
    if (!current || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const files = [...root.querySelectorAll('[data-file-id]')];
    const index = files.indexOf(current);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? files.length - 1
      : Math.max(0, Math.min(files.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    selectedId = files[next].dataset.fileId;
    store.discover(selectedId); renderFiles();
    root.querySelector(`[data-file-id="${selectedId}"]`)?.focus({ preventScroll: true });
  });
  store.onEvent(({type}) => {
    if (type === 'hilfer:progress-reset') {
      selectedId = null; department = ''; query = ''; root.querySelector('#records-search').value = ''; renderFiles();
    }
  });
  function openRecord(recordId) {
    if (!store.getRecord(recordId)) return { ok: false, message: 'Unknown record ID.' };
    // A source link must reach its document even when a previous search hid it.
    selectedId = recordId; department = ''; query = '';
    root.querySelector('#records-search').value = '';
    store.discover(recordId); renderFiles();
    root.querySelector('.record-document')?.focus({ preventScroll: true });
    return { ok: true };
  }
  renderFiles();
  return { openRecord };
}
