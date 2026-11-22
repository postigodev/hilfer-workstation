import { createStore } from './core/store.js';
import { mountRecords } from './apps/records-fixture.js';
import { mountReconciliation } from './apps/reconciliation.js';
import { mountMail, createMailModel } from './apps/emails.js';
import { mountAI } from './apps/ai.js';
import { mountDistortion } from './effects/distortion.js';
import { createArtifacts } from './core/artifacts.js';
import { presentationPolicies } from './apps/inspection.js';
import { mountSecurity } from './apps/security.js';
import { validateSecurityCatalog } from './apps/security-catalog.js';
import { mountPresentation } from './apps/presentation.js';
import { mountContrastEffects } from './effects/contrasts.js';

async function boot() {
  const [records, cases, assistant, emails, progression, previousProgression, previousCases, previousProgressionV2, previousCasesV2, previousProgressionV3, previousCasesV3, previousProgressionV4, previousCasesV4, previousProgressionV5, previousCasesV5, footageCatalog] = await Promise.all(['records', 'cases', 'assistant', 'emails', 'progression','history/progression-v1','history/cases-v1','history/progression-v2','history/cases-v2','history/progression-v3','history/cases-v3','history/progression-v4','history/cases-v4','history/progression-v5','history/cases-v5','footage'].map(async name => {
    const response = await fetch(`./data/${name}.json`);
    if (!response.ok) throw new Error(`Could not load ${name}`);
    return response.json();
  }));
  // Accessing localStorage itself can throw when browser storage is disabled.
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage disabled'); }, setItem() { throw new Error('Storage disabled'); } }; }
  const contentMigrations=[
    {from:1,to:2,sourceDefinition:previousProgression,sourceCases:previousCases,migrate:s=>({...s,contentVersion:2})},
    {from:2,to:3,sourceDefinition:previousProgressionV2,sourceCases:previousCasesV2,migrate:s=>({...s,contentVersion:3})},
    {from:3,to:4,sourceDefinition:previousProgressionV3,sourceCases:previousCasesV3,migrate:s=>({...s,contentVersion:4})},
    {from:4,to:5,sourceDefinition:previousProgressionV4,sourceCases:previousCasesV4,migrate:s=>({...s,contentVersion:5})},
    {from:5,to:6,sourceDefinition:previousProgressionV5,sourceCases:previousCasesV5,migrate:s=>({...s,contentVersion:6})}
  ];
  const store = createStore({ records, cases, storage, progression, contentMigrations });
  const mail = createMailModel(emails,{storage,getRecord:store.getRecord,grants:store.getAccess(),
    isAvailable:id=>store.isArtifactAvailable('mail',id),canReference:id=>store.isArtifactAvailable('records',id)});
  validateSecurityCatalog(footageCatalog);
  const artifacts=createArtifacts({store,records,emails,mail,footage:footageCatalog,policies:presentationPolicies});
  let reconciliation;
  const recordsApp = mountRecords(document.querySelector('#records-app'), store, {
    artifacts,
    onContrast,
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
  function onContrast(app,id){const result=reconciliation.contrastArtifact(app,id);if(result.ok){window.openWindow('reconciliation');reconciliation.focusComparison();}return result;}
  reconciliation = mountReconciliation(document.querySelector('#reconciliation-app'), store, { openRecord, artifacts });
  const assistantApp=mountAI(document.querySelector('#ai-app'), store, assistant, { storage });
  mountMail(document.querySelector('#emails-app'), emails, {storage,store,openRecord,artifacts,model:mail,onContrast});
  const footage = document.querySelector('#footage-window');
  const footageApp=mountSecurity(footage,artifacts,footageCatalog,{store});
  store.onEvent(({type}) => {
    if (type === 'hilfer:progress-reset') footageApp.reset();
  });
  mountDistortion(store);
  mountPresentation(store,{assistant:assistantApp,contrastEffects:mountContrastEffects(store)});
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
