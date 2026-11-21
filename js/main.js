import { createStore } from './core/store.js';
import { mountRecords } from './apps/records-fixture.js';
import { mountReconciliation } from './apps/reconciliation.js';
import { mountMail } from './apps/emails.js';
import { mountAI } from './apps/ai.js';
import { mountDistortion } from './effects/distortion.js';

async function boot() {
  const [records, cases, assistant, emails, progression] = await Promise.all(['records', 'cases', 'assistant', 'emails', 'progression'].map(async name => {
    const response = await fetch(`./data/${name}.json`);
    if (!response.ok) throw new Error(`Could not load ${name}`);
    return response.json();
  }));
  // Accessing localStorage itself can throw when browser storage is disabled.
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage disabled'); }, setItem() { throw new Error('Storage disabled'); } }; }
  const store = createStore({ records, cases, storage, progression });
  let reconciliation;
  const recordsApp = mountRecords(document.querySelector('#records-app'), store, {
    onClaim(recordId, field) {
      if (!reconciliation) return { ok: false, message: 'Reconciliation has not loaded.' };
      const result = reconciliation.presentClaim(recordId, field);
      if (result.ok) {
        window.openWindow('reconciliation');
        reconciliation.focusComparison();
      }
      return result;
    }
  });
  function openRecord(recordId) {
    if (!store.getRecord(recordId)) return { ok: false, message: 'Unknown record ID.' };
    window.openWindow('records');
    return recordsApp.openRecord(recordId);
  }
  reconciliation = mountReconciliation(document.querySelector('#reconciliation-app'), store, { openRecord });
  mountAI(document.querySelector('#ai-app'), store, assistant, { storage });
  mountMail(document.querySelector('#emails-app'), emails, {storage,store,openRecord});
  const footage = document.querySelector('#footage-window');
  const video = footage.querySelector('video');
  const stopFootage = () => video.pause();
  new MutationObserver(() => {
    if (!footage.classList.contains('visible')) stopFootage();
  }).observe(footage, {attributes:true, attributeFilter:['class']});
  window.addEventListener('pagehide', stopFootage);
  store.onEvent(({type}) => {
    if (type === 'hilfer:progress-reset') { stopFootage(); video.currentTime = 0; }
  });
  video.querySelector('source').addEventListener('error', () => {
    footage.querySelector('.status-bar-field').textContent = 'Preview could not be loaded.';
  });
  mountDistortion(store);
  function update() {
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
