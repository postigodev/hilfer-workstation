import { createStore } from './core/store.js';
import { mountRecords } from './apps/records-fixture.js';
import { mountReconciliation } from './apps/reconciliation.js';
import { mountMail, createMailModel } from './apps/emails.js';
import { mountAI } from './apps/ai.js';
import { mountDistortion } from './effects/distortion.js';
import { createArtifacts } from './core/artifacts.js';
import { presentationPolicies, mountFootage } from './apps/inspection.js';
import { mountPresentation } from './apps/presentation.js';

async function boot() {
  const [records, cases, assistant, emails, progression, previousProgression, previousCases, previousProgressionV2, previousCasesV2] = await Promise.all(['records', 'cases', 'assistant', 'emails', 'progression','history/progression-v1','history/cases-v1','history/progression-v2','history/cases-v2'].map(async name => {
    const response = await fetch(`./data/${name}.json`);
    if (!response.ok) throw new Error(`Could not load ${name}`);
    return response.json();
  }));
  // Accessing localStorage itself can throw when browser storage is disabled.
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage disabled'); }, setItem() { throw new Error('Storage disabled'); } }; }
  const contentMigrations=[
    {from:1,to:2,sourceDefinition:previousProgression,sourceCases:previousCases,migrate:s=>({...s,contentVersion:2})},
    {from:2,to:3,sourceDefinition:previousProgressionV2,sourceCases:previousCasesV2,migrate:s=>({...s,contentVersion:3})}
  ];
  const store = createStore({ records, cases, storage, progression, contentMigrations });
  const mail = createMailModel(emails,{storage,getRecord:store.getRecord,grants:store.getAccess(),
    isAvailable:id=>store.isArtifactAvailable('mail',id),canReference:id=>store.isArtifactAvailable('records',id)});
  const artifacts=createArtifacts({store,records,emails,mail,footage:[{id:'CAM4-PREVIEW'}],policies:presentationPolicies});
  let reconciliation;
  const recordsApp = mountRecords(document.querySelector('#records-app'), store, {
    artifacts,
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
    if (!artifacts.canOpen('records',recordId)) return { ok: false, message: 'Content unavailable.' };
    window.openWindow('records');
    return recordsApp.openRecord(recordId);
  }
  reconciliation = mountReconciliation(document.querySelector('#reconciliation-app'), store, { openRecord, artifacts });
  const assistantApp=mountAI(document.querySelector('#ai-app'), store, assistant, { storage });
  mountMail(document.querySelector('#emails-app'), emails, {storage,store,openRecord,artifacts,model:mail});
  const footage = document.querySelector('#footage-window');
  const video = footage.querySelector('video');
  const footageApp=mountFootage(footage,artifacts);
  store.onEvent(({type}) => {
    if (type === 'hilfer:progress-reset') footageApp.reset();
  });
  video.querySelector('source').addEventListener('error', () => {
    footage.querySelector('.status-bar-field').textContent = 'Preview could not be loaded.';
  });
  mountDistortion(store);
  mountPresentation(store,{assistant:assistantApp});
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
