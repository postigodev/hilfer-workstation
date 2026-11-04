import { escapeHTML as h } from './shared.js';

// Adapted from Altynai's HILFER assistant. Messages are a projection of game state.
export function deriveAssistant(state, records, content) {
  const filed = state.completedCaseIds.includes(content.caseId) && Boolean(state.resolutions[content.caseId]);
  const investigating = records.some(record => record.caseIds.includes(content.caseId) && state.discoveredEvidenceIds.includes(record.id));
  const phase = filed ? 'filed' : investigating ? 'investigating' : 'welcome';
  return { phase, messages: phase === 'welcome' ? [content.welcome] : [content.welcome, content[phase]],
    notificationId: filed ? content.caseId + ':reconciled' : null };
}

// UI receipts only; no evidence, resolutions or progression are stored here.
export const ASSISTANT_RECEIPT_KEY = 'hilfer:assistant:v1';
export function createAssistantReceipt(storage, notificationId) {
  let read = false;
  try {
    const saved = JSON.parse(storage?.getItem(ASSISTANT_RECEIPT_KEY) ?? 'null');
    read = saved?.version === 1 && saved.readId === notificationId;
  } catch { /* Missing/blocked/malformed UI storage leaves the message unread. */ }
  return {
    isRead: () => read,
    markRead() {
      if (read) return;
      read = true;
      try { storage?.setItem(ASSISTANT_RECEIPT_KEY, JSON.stringify({ version: 1, readId: notificationId })); } catch { /* Session receipt still works. */ }
    },
    reset() { read = false; try { storage?.removeItem(ASSISTANT_RECEIPT_KEY); } catch { /* In-memory reset remains available. */ } }
  };
}

export function mountAI(root, store, content, { storage } = {}) {
  const receipt = createAssistantReceipt(storage, content.caseId + ':reconciled');
  const notification = document.querySelector('#assistant-notification');
  const announcement = document.querySelector('#assistant-announcement');
  const windowEl = root.closest('.window');
  root.innerHTML = `<header class="ai-profile"><img class="ai-avatar" src="assets/placeholders/personnel.svg" alt="HILFER Assistant generic profile portrait"><div><h1>HILFER Assistant</h1><p>Internal support</p></div></header>
    <div class="ai-transcript" tabindex="-1" role="log" aria-label="Assistant correspondence" aria-live="polite" aria-relevant="additions"></div>
    <div class="ai-actions"><button data-open="reconciliation">Open Reconciliation</button><button data-open="records">Open Records</button></div>
    <p class="ai-status" role="status"></p>`;
  let previousPhase;
  let wasUnread = false;
  function update() {
    const model = deriveAssistant(store.getState(), store.getRecords(), content);
    if (model.phase !== previousPhase) {
      const log = root.querySelector('.ai-transcript');
      log.innerHTML = model.messages.map(message => `<section class="ai-message"><h2>${h(message.label)}</h2><p>${h(message.text)}</p></section>`).join('');
      log.scrollTop = log.scrollHeight;
      root.querySelector('.ai-status').textContent = model.phase === 'filed' ? 'Report revision registered.' : 'Personnel review / pending';
      previousPhase = model.phase;
    }
    if (model.notificationId && windowEl.classList.contains('active') && windowEl.classList.contains('visible')) receipt.markRead();
    const unread = Boolean(model.notificationId) && !receipt.isRead();
    notification.hidden = !unread;
    if (unread !== wasUnread) announcement.textContent = unread ? 'HILFER Assistant has a report update.' : '';
    wasUnread = unread;
  }
  window.addEventListener('hilfer:window-activated', ({ detail }) => {
    if (detail.windowId === 'ai') {
      const focusCorrespondence = !windowEl.contains(document.activeElement);
      update();
      if (focusCorrespondence) root.querySelector('.ai-transcript').focus({ preventScroll: true });
    }
  });
  store.subscribe(update);
  store.onEvent(({ type }) => {
    if (type === 'hilfer:progress-reset') { receipt.reset(); update(); }
    if (type === 'hilfer:case-reconciled') update();
  });
  update();
}
