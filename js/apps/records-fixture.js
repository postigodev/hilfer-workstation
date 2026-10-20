import { escapeHTML as h, label, RECORD_MIME } from './shared.js';
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
  const identity = fields([['Employee', record.employee], ['Personnel ID', record.employeeId]]);
  const reference = fields([['Record reference', record.id], ['Issued', record.date.replace('T', ' ')], ['Effective period', record.workPeriod]]);
  let content;
  if (record.type === 'personnel_status') {
    content = `<header class="document-heading"><b>HILFER PERSONNEL</b><span>EMPLOYEE RECORD</span></header>
      <div class="personnel-identity"><figure class="portrait-placeholder"><img src="assets/placeholders/personnel.svg" alt="Employee portrait placeholder"><figcaption>PHOTO / PENDING</figcaption></figure><div>${identity}</div></div>
      ${reference}<section class="document-determination"><h3>Work eligibility</h3><strong>${h(record.fields.workEligibility)}</strong></section>
      <p class="document-note">${h(record.note)}</p><footer class="document-authorization"><b>AUTHORIZED HR EXTRACT</b><span>${h(record.department)}</span></footer>`;
  } else if (record.type === 'occupational_health_record') {
    content = `<header class="document-heading medical-heading"><b>HILFER / OCCUPATIONAL HEALTH</b><span>WORK CLEARANCE DETERMINATION</span></header>
      ${identity}${reference}<section class="document-determination medical-determination"><h3>Work clearance</h3><strong>${h(record.fields.workEligibility)}</strong></section>
      ${fields([['Occupational causation', record.fields.occupationalCausation]])}<p class="document-note">${h(record.note)}</p>
      <footer class="document-authorization"><span>ISSUING OFFICE</span><b>${h(record.department)}</b></footer>`;
  } else {
    content = `<header class="document-heading"><b>${h(record.department)}</b><span>${h(record.title)}</span></header>${identity}${reference}${fields(Object.entries(record.fields).map(([key, value]) => [label(key), value]))}`;
  }
  return `<article class="record-document ${record.type === 'occupational_health_record' ? 'medical-document' : ''}" draggable="true" data-record-id="${h(record.id)}" tabindex="0" aria-label="Drag ${h(record.id)}">${content}</article>`;
}

// Replaceable Records UI. No case rules or duplicated game state live here.
export function mountRecords(root, store) {
  let selectedId = null;
  let department = '';
  let query = '';
  const departments = [...new Set(store.getRecords().map(r => r.department))];
  root.innerHTML = `<div class="app-toolbar"><span>HILFER Records</span><span>Read-only archive</span></div>
    <form class="records-search" role="search"><label for="records-search">Find</label><input type="search" id="records-search" placeholder="Name, reference or department" autocomplete="off"><button type="button" id="clear-search">Clear</button></form>
    <div class="records-explorer"><nav class="folder-tree" aria-label="Departments"><div class="pane-label">Departments</div><button data-folder="" aria-pressed="true">▾ All departments</button>${departments.map(name => `<button data-folder="${h(name)}" aria-pressed="false">▸ ${h(name)}</button>`).join('')}</nav>
      <section class="files-pane" aria-label="Record list"><div class="pane-label">Reference / Employee</div><div id="record-files"></div></section>
      <section class="preview-pane" aria-label="Document preview"><div class="preview-reference" id="preview-reference">Document preview</div><div class="preview-scroll" id="record-preview"></div></section></div>
    <div class="records-status"><span id="record-count"></span><span id="record-drag-hint">Read-only</span></div>`;

  function renderFiles() {
    const records = store.getRecords().filter(record => (!department || record.department === department) &&
      [record.id, record.title, record.employee, record.employeeId, record.department].join(' ').toLowerCase().includes(query.toLowerCase()));
    if (!records.some(r => r.id === selectedId)) selectedId = null;
    const discovered = store.getState().discoveredEvidenceIds;
    root.querySelector('#record-files').innerHTML = records.length ? records.map(record => `<button class="record-file" data-file-id="${h(record.id)}" data-record-id="${h(record.id)}" draggable="true" aria-pressed="${selectedId === record.id}"><b>▤ ${h(record.id)}</b><span>${h(record.title)}</span><small>${h(record.employeeId)}${discovered.includes(record.id) ? ' · Viewed' : ''}</small></button>`).join('') : '<p class="files-empty">No matching records.</p>';
    root.querySelector('#record-count').textContent = `${records.length} file${records.length === 1 ? '' : 's'}`;
    root.querySelectorAll('[data-folder]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.folder === department)));
    const record = store.getRecord(selectedId);
    root.querySelector('#preview-reference').textContent = record ? `${record.id} / ${record.employeeId}` : 'Document preview';
    root.querySelector('#record-drag-hint').textContent = record ? 'Drag file to Reconciliation' : 'Read-only';
    root.querySelector('#record-preview').innerHTML = record ? renderRecord(record) : '<div class="preview-empty"><span aria-hidden="true">▤</span>No document selected</div>';
    root.querySelector('#record-preview').scrollTop = 0;
  }
  root.querySelector('.records-search').addEventListener('submit', event => event.preventDefault());
  root.querySelector('#records-search').addEventListener('input', event => { query = event.target.value; renderFiles(); });
  root.querySelector('#clear-search').addEventListener('click', () => { query = ''; root.querySelector('#records-search').value = ''; renderFiles(); root.querySelector('#records-search').focus(); });
  root.addEventListener('click', event => {
    const folder = event.target.closest('[data-folder]');
    if (folder) { department = folder.dataset.folder; renderFiles(); }
    const file = event.target.closest('[data-file-id]');
    if (file) { selectedId = file.dataset.fileId; store.discover(selectedId); renderFiles(); }
  });
  root.addEventListener('dragstart', event => {
    const file = event.target.closest('[data-record-id]');
    if (file) beginRecordDrag(event, file.dataset.recordId);
  });
  store.onEvent(({type}) => {
    if (type === 'hilfer:progress-reset') {
      selectedId = null; department = ''; query = ''; root.querySelector('#records-search').value = ''; renderFiles();
    }
  });
  renderFiles();
}
