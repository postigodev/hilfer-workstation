import { escapeHTML as h } from './shared.js';
import { createAssistantVoice } from './assistant-voice.js';

// The demo maps today's game state to dialogue signals. The final game's event
// sequence can select the same entries without changing their copy or voice.
export function deriveAssistant(state, records, content) {
  const filed = state.completedCaseIds.includes(content.caseId) && Boolean(state.resolutions[content.caseId]);
  const investigating = records.some(record => record.caseIds.includes(content.caseId) && state.discoveredEvidenceIds.includes(record.id));
  const phase = filed ? 'filed' : investigating ? 'investigating' : 'welcome';
  const signal = filed ? 'case.report-filed' : investigating ? 'case.review-started' : 'assignment.available';
  const entry = content.dialogue.find(message => message.on === signal);
  const welcome = content.dialogue.find(message => message.on === 'assignment.available');
  return { phase, signal, messages: [...new Set([welcome, entry])].filter(Boolean),
    voice: entry?.voice ?? null,
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
  root.innerHTML = `<section id="assistant-balloon" class="assistant-balloon" aria-labelledby="assistant-title" hidden>
    <header class="ai-profile"><h1 id="assistant-title">HILFER Assistant</h1><button type="button" data-assistant-dismiss aria-label="Dismiss Assistant">Close</button></header>
    <div class="ai-transcript" tabindex="-1" role="log" aria-label="Assistant correspondence" aria-live="polite" aria-relevant="additions"></div>
    <div class="ai-actions"><button data-open="reconciliation">Open Reconciliation</button><button data-open="records">Open Records</button></div>
    </section>
    <div class="assistant-launch">
      <button type="button" id="assistant-notification" class="assistant-notification" aria-controls="assistant-balloon" hidden>Report updated</button>
      <button type="button" id="assistant-portrait" aria-label="HILFER Assistant" aria-controls="assistant-balloon" aria-expanded="false"><img class="ai-avatar" alt=""></button>
    </div>
    <span class="assistant-announcement" id="assistant-announcement" role="status" aria-live="polite"></span>`;
  const notification = root.querySelector('#assistant-notification');
  const announcement = root.querySelector('#assistant-announcement');
  const launcher = root.querySelector('#assistant-portrait');
  const balloon = root.querySelector('#assistant-balloon');
  const log = root.querySelector('.ai-transcript');
  const voice = createAssistantVoice(storage, content.caseId);
  const deliveryKey = 'hilfer:assistant-delivery:v1';
  const delivered = new Set();
  try {
    const saved = JSON.parse(storage?.getItem(deliveryKey) ?? 'null');
    if (saved?.caseId === content.caseId && Array.isArray(saved.signals)) {
      for (const signal of saved.signals) if (content.dialogue.some(entry => entry.on === signal)) delivered.add(signal);
    }
  } catch { /* Delivery still deduplicates in this session. */ }
  const history = new Set();
  let voiceCue = null;
  let needsGesture = false;
  let userInteracted = false;
  const markGesture=event=>{if(event.isTrusted)userInteracted=true;};
  document.addEventListener('pointerdown',markGesture,true);
  document.addEventListener('keydown',markGesture,true);
  function speakPending() {
    if (!voiceCue || document.hidden) return;
    if (!userInteracted || navigator.userActivation?.hasBeenActive === false) { needsGesture = true; return; }
    voice.play(voiceCue, {
      onEnded: speakPending,
      onError(error) {
        needsGesture = error?.name === 'NotAllowedError';
        if (!needsGesture) announcement.textContent = 'Voice unavailable.';
      }
    });
  }
  const portrait = root.querySelector('.ai-avatar');
  // Preserve the full transcript on demand, collapse unsolicited correspondence
  // as soon as the player works in an application. Voice receipts remain separate.
  document.addEventListener('pointerdown',event=>{if(event.target.closest('.window')&&!root.contains(event.target)&&!balloon.hidden&&balloon.hasAttribute('data-passive'))setOpen(false,false);},true);
  let presentationStage;
  let previousPhase;
  let wasUnread = false;
  function renderHistory() {
    log.innerHTML = [...history].map(message => `<section class="ai-message"><h2>${h(message.label)}</h2><p>${h(message.text)}</p></section>`).join('');
    log.scrollTop = log.scrollHeight;
  }
  function deliver(signal) {
    const entry = content.dialogue.find(message => message.on === signal);
    if (!entry || delivered.has(signal)) return;
    delivered.add(signal);
    try {
      storage?.setItem(deliveryKey, JSON.stringify({caseId:content.caseId, signals:[...delivered]}));
    } catch { /* Delivery still deduplicates in this session. */ }
    history.add(entry);
    voiceCue = entry.voice ?? null;
    renderHistory();
    setOpen(true, false);
    speakPending();
  }
  function update() {
    const state = store.getState();
    const model = deriveAssistant(state, store.getRecords(), content);
    const face = state.distortionLevel > 0 ? 'assistant-distorted' : 'assistant';
    const lateFace = {2:'uneasy',3:'uneasy',4:'obstructive',5:'obstructive',6:'hostile'}[presentationStage];
    const portraitSrc = lateFace ? `assets/arwa/final/assistant-${lateFace}.webp` : `assets/arwa/portraits/${presentationStage===0?'assistant':face}.webp`;
    if (portrait.getAttribute('src') !== portraitSrc) portrait.src = portraitSrc;
    if (model.phase !== previousPhase && (model.phase !== 'welcome' || !previousPhase)) {
      if (!previousPhase) {
        for (const signal of delivered) history.add(content.dialogue.find(message => message.on === signal));
      }
      for (const message of model.messages) history.add(message);
      voiceCue = model.voice;
      previousPhase = model.phase;
      renderHistory();
      deliver(model.signal);
    }
    const unread = Boolean(model.notificationId) && !receipt.isRead();
    notification.hidden = !unread;
    if (unread !== wasUnread) announcement.textContent = unread ? 'HILFER Assistant has a report update.' : '';
    wasUnread = unread;
  }
  function setOpen(open, focus = true) {
    const justOpened = open && balloon.hidden;
    balloon.hidden = !open;
    if (open && (justOpened || focus)) balloon.toggleAttribute('data-passive', !focus);
    launcher.setAttribute('aria-expanded', String(open));
    update();
    if (open && focus && previousPhase === 'filed') {
      receipt.markRead();
      update();
    }
    if (justOpened && focus) speakPending();
    if (open) log.scrollTop = log.scrollHeight;
    if (focus) (open ? log : launcher).focus({preventScroll: true});
  }
  launcher.addEventListener('click', () => setOpen(balloon.hidden));
  notification.addEventListener('click', () => setOpen(true));
  root.querySelector('[data-assistant-dismiss]').addEventListener('click', () => setOpen(false));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !balloon.hidden) {
      event.stopPropagation();
      setOpen(false);
    }
  });
  root.querySelector('.ai-actions').addEventListener('click', event => {
    if (event.target.closest('[data-open]')) setOpen(false);
  });
  window.addEventListener('hilfer:assistant-open', () => setOpen(true));
  window.addEventListener('hilfer:assistant-dialogue', ({detail}) => deliver(detail?.signal));
  function retryVoice(event) {
    if (!event.isTrusted || !needsGesture) return;
    needsGesture = false;
    speakPending();
  }
  document.addEventListener('click', retryVoice, true);
  document.addEventListener('keydown', retryVoice, true);
  window.addEventListener('pagehide', voice.stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) voice.stop();
    else if (!balloon.hidden) speakPending();
  });
  store.subscribe(update);
  store.onEvent(({ type }) => {
    if (type === 'hilfer:progress-reset') {
      receipt.reset();
      voice.reset();
      delivered.clear();
      history.clear();
      previousPhase = undefined;
      update();
    }
    if (type === 'hilfer:case-reconciled') update();
  });
  update();
  root.hidden = false;
  return {setMuted:value=>voice.setMuted(value),setPresentationStage(value){presentationStage=value;update();},hasDelivered:signal=>delivered.has(signal),cancelSignal(signal) {
    const cue=content.dialogue.find(entry=>entry.on===signal)?.voice;
    if(cue && voiceCue?.id===cue.id){voiceCue=null;needsGesture=false;voice.cancelCue(cue.id);}
  },deliverSignal(signal) {
    if(!content.dialogue.some(entry=>entry.on===signal)) return false;
    deliver(signal); return true;
  }};
}
