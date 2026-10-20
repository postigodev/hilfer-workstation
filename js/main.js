import { createStore } from './core/store.js';
import { mountRecords } from './apps/records-fixture.js';
import { mountReconciliation } from './apps/reconciliation.js';
import { mountDistortion } from './effects/distortion.js';

async function boot() {
  const [records, cases] = await Promise.all(['records', 'cases'].map(async name => {
    const response = await fetch(`./data/${name}.json`);
    if (!response.ok) throw new Error(`Could not load ${name}`);
    return response.json();
  }));
  // Accessing localStorage itself can throw when browser storage is disabled.
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage disabled'); }, setItem() { throw new Error('Storage disabled'); } }; }
  const store = createStore({ records, cases, storage });
  const recordsApp = mountRecords(document.querySelector('#records-app'), store);
  function openRecord(recordId) {
    if (!store.getRecord(recordId)) return { ok: false, message: 'Unknown record ID.' };
    window.openWindow('records');
    return recordsApp.openRecord(recordId);
  }
  const reconciliation = mountReconciliation(document.querySelector('#reconciliation-app'), store, { openRecord });
  mountDistortion(store);
  function update() {
    const state = store.getState();
    document.querySelector('#progress').textContent = `${state.completedCaseIds.length} / ${cases.filter(c => !c.placeholder).length} playable assignments reconciled`;
    document.querySelector('#save-status').textContent = store.getWarning();
  }
  store.subscribe(update); update();
  document.querySelector('#reset-progress').addEventListener('click', () => { store.resetProgress(); });
  // Stable integration surface for Records and browser tests; all writes go through validation.
  window.hilfer = Object.freeze({ ...store, ...reconciliation, openRecord });
}
boot().catch(error => {
  console.error(error);
  document.querySelector('#save-status').textContent = 'Workstation failed to load. Serve the repository over local HTTP, then reload.';
});
