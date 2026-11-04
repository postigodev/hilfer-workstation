import { escapeHTML as h, displayDate } from './shared.js';

export const MAIL_UI_KEY = 'hilfer:mail-ui:v1';
const copy = value => structuredClone(value);
const personValid = person => person && ['id','name','address'].every(key => typeof person[key] === 'string' && person[key].length);
export function validateMailCorpus(corpus, getRecord) {
  const fail = () => { throw new Error('Invalid Mail corpus.'); };
  if (corpus.schemaVersion !== 1 || !corpus.mailbox?.displayName || !corpus.mailbox.address ||
      !Array.isArray(corpus.initialGrants) || !Array.isArray(corpus.folders) || !Array.isArray(corpus.threads)) fail();
  const folders = new Set(), threads = new Set(), messages = new Set();
  for (const folder of corpus.folders) {
    if (!folder.id || !folder.label || folders.has(folder.id)) fail();
    folders.add(folder.id);
  }
  for (const thread of corpus.threads) {
    if (!thread.id || threads.has(thread.id) || typeof thread.subject !== 'string' || !folders.has(thread.folderId) ||
        !Array.isArray(thread.access?.requiredGrants) || !thread.access.requiredGrants.every(grant => typeof grant === 'string') ||
        !Array.isArray(thread.messages) || !thread.messages.length) fail();
    threads.add(thread.id);
    for (const message of thread.messages) {
      if (!message.id || messages.has(message.id) || !personValid(message.from) ||
          !Array.isArray(message.to) || !message.to.length || !message.to.every(personValid) ||
          !Array.isArray(message.cc) || !message.cc.every(personValid) || typeof message.body !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(message.sentAt) || !Number.isFinite(Date.parse(message.sentAt)) || new Date(message.sentAt + 'Z').toISOString().slice(0,19) !== message.sentAt ||
          !Array.isArray(message.references)) fail();
      messages.add(message.id);
      for (const reference of message.references) {
        if (reference.type !== 'record' || !reference.id || !reference.label || (getRecord && !getRecord(reference.id))) fail();
      }
    }
  }
  return { threads: threads.size, messages: messages.size };
}

// This model owns UI receipts and authorization only. It has no gameplay-write API.
export function createMailModel(input, { storage, grants = input.initialGrants, getRecord } = {}) {
  validateMailCorpus(input, getRecord);
  const corpus = copy(input);
  for (const thread of corpus.threads) thread.messages.sort((a,b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id));
  let effectiveGrants = new Set(grants), readIds = new Set(), query = '';
  let folderId = corpus.folders[0].id, selectedThreadId = null, warning = '';
  const subscribers = new Set();
  const authorized = () => corpus.threads.filter(thread => thread.access.requiredGrants.every(grant => effectiveGrants.has(grant)));
  const find = id => authorized().find(thread => thread.id === id);
  const allowedIds = () => new Set(authorized().flatMap(thread => thread.messages.map(message => message.id)));
  function cleanState() {
    const allowed = allowedIds(); readIds = new Set([...readIds].filter(id => allowed.has(id)));
    if (!find(selectedThreadId)) selectedThreadId = null;
  }
  try {
    const raw = storage?.getItem(MAIL_UI_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.readMessageIds)) throw new Error('Old receipt');
      readIds = new Set(saved.readMessageIds);
      if (corpus.folders.some(folder => folder.id === saved.folderId)) folderId = saved.folderId;
      if (find(saved.selectedThreadId)?.folderId === folderId) selectedThreadId = saved.selectedThreadId;
    }
  } catch { warning = 'Mail view started with fresh read receipts.'; }
  cleanState();
  const state = () => ({ folderId, selectedThreadId, query, readMessageIds: [...readIds] });
  function publish(persist = true) {
    cleanState();
    if (persist) {
      try { storage?.setItem(MAIL_UI_KEY, JSON.stringify({ version:1, folderId, selectedThreadId, readMessageIds:[...readIds] })); }
      catch { warning = 'Mail view could not be saved; reading is available for this session.'; }
    }
    subscribers.forEach(fn => fn(state()));
  }
  const unread = thread => thread.messages.some(message => !readIds.has(message.id));
  function listThreads() {
    const term = query.trim().toLowerCase();
    return copy(authorized().filter(thread => term ? [thread.subject, ...thread.messages.flatMap(message => [message.subject ?? '', message.from.name, message.from.address, message.body, ...message.to.flatMap(p => [p.name,p.address]), ...message.cc.flatMap(p => [p.name,p.address]), ...message.references.map(r => r.id)])].join('\n').toLowerCase().includes(term) : thread.folderId === folderId)
      .sort((a,b) => b.messages.at(-1).sentAt.localeCompare(a.messages.at(-1).sentAt) || a.id.localeCompare(b.id))
      .map(thread => ({...thread, unread:unread(thread)})));
  }
  return {
    getState: state, getWarning: () => warning, getMailbox: () => copy(corpus.mailbox),
    getFolders: () => corpus.folders.map(folder => ({...copy(folder), count:authorized().filter(t => t.folderId === folder.id).length, unread:authorized().filter(t => t.folderId === folder.id && unread(t)).length})),
    listThreads,
    getThread(id) { const thread = find(id); return thread ? copy(thread) : null; },
    getMessage(id) { for (const thread of authorized()) { const message = thread.messages.find(m => m.id === id); if (message) return copy({...message,threadId:thread.id}); } return null; },
    getReference(messageId, recordId) { return this.getMessage(messageId)?.references.find(reference => reference.id === recordId) ?? null; },
    setFolder(id) { if (!corpus.folders.some(f => f.id === id)) return false; folderId = id; query = ''; selectedThreadId = null; publish(); return true; },
    setQuery(value) { query = String(value); if (!listThreads().some(t => t.id === selectedThreadId)) selectedThreadId = null; publish(false); },
    openThread(id) {
      const thread = find(id); if (!thread) return {ok:false,message:'Conversation unavailable.'};
      folderId = thread.folderId;
      selectedThreadId = id; thread.messages.forEach(message => readIds.add(message.id)); publish(); return {ok:true};
    },
    openMessage(id) { const message = this.getMessage(id); return message ? this.openThread(message.threadId) : {ok:false,message:'Conversation unavailable.'}; },
    markUnread(id) { const thread = find(id); if (!thread) return false; thread.messages.forEach(message => readIds.delete(message.id)); publish(); return true; },
    setGrants(values) { effectiveGrants = new Set(values); cleanState(); publish(); },
    reset() { readIds.clear(); query = ''; folderId = corpus.folders[0].id; selectedThreadId = null; warning = ''; publish(); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
  };
}

const person = value => `${h(value.name)} &lt;${h(value.address)}&gt;`;
const mailDate = value => `${displayDate(value)} ${value.slice(11,16)}`;
export function renderMailThread(thread) {
  return `<header class="mail-conversation-heading"><h1>${h(thread.subject)}</h1>${thread.archiveSeries ? `<p>${h(thread.archiveSeries)}</p>` : ''}</header>` + thread.messages.map(message => `<article class="mail-message" data-message-id="${h(message.id)}" aria-label="${h(message.subject ?? thread.subject)} from ${h(message.from.name)}">
    <dl class="mail-message-fields"><dt>From</dt><dd>${person(message.from)}</dd><dt>To</dt><dd>${message.to.map(person).join('; ')}</dd>${message.cc.length ? `<dt>Cc</dt><dd>${message.cc.map(person).join('; ')}</dd>` : ''}<dt>Sent</dt><dd><time datetime="${h(message.sentAt)}" title="Provisional demo timestamp">${h(mailDate(message.sentAt))}</time></dd><dt>Subject</dt><dd>${h(message.subject ?? thread.subject)}</dd></dl>
    <div class="mail-body">${h(message.body)}</div>
    ${message.references.map(reference => `<button type="button" class="source-reference" data-mail-reference="${h(reference.id)}" data-mail-message="${h(message.id)}">${h(reference.label)}</button>`).join('')}
    <small class="mail-message-id">${h(message.id)}</small></article>`).join('');
}

export function mountMail(root, corpus, { storage, store, openRecord }) {
  const model = createMailModel(corpus, {storage,getRecord:store.getRecord});
  const mailbox = model.getMailbox();
  root.innerHTML = `<header class="mail-account"><b>${h(mailbox.displayName)}</b><span>${h(mailbox.address)}</span></header>
    <form class="mail-search" role="search"><label for="mail-search">Find</label><input id="mail-search" type="search" placeholder="Search all authorized mail" autocomplete="off"><button type="button" id="mail-clear-search">Clear</button></form>
    <nav class="mail-folders" aria-label="Mail folders"></nav>
    <div class="mail-workspace"><section class="mail-list-pane" aria-label="Conversations"><div class="pane-label" id="mail-list-label"></div><div class="mail-thread-list"></div></section>
    <section class="mail-reader-pane" aria-label="Message reader"><div class="mail-reader-tools"><button type="button" id="mail-mark-unread" disabled>Mark unread</button></div><div class="mail-reader" tabindex="-1"></div></section></div>
    <footer class="mail-status" role="status"><span id="mail-count"></span><span id="mail-warning">Dates provisional</span></footer>`;
  let renderedThread;
  function render() {
    const state = model.getState(), folders = model.getFolders(), threads = model.listThreads();
    const oldFocus = root.querySelector('.mail-thread-list')?.contains(document.activeElement) ? document.activeElement.dataset.mailThread : null;
    root.querySelector('.mail-folders').innerHTML = folders.map(folder => `<button type="button" data-mail-folder="${h(folder.id)}" aria-pressed="${!state.query.trim() && state.folderId === folder.id}" aria-label="${h(folder.label)}, ${folder.unread} unread conversations">${h(folder.label)}${folder.unread ? ` <span>(${folder.unread})</span>` : ''}</button>`).join('');
    root.querySelector('#mail-search').value = state.query;
    root.querySelector('#mail-list-label').textContent = state.query.trim() ? 'Search results / all folders' : folders.find(f => f.id === state.folderId).label;
    root.querySelector('.mail-thread-list').innerHTML = threads.map(thread => `<button type="button" class="mail-thread ${thread.unread ? 'mail-unread' : ''}" data-mail-thread="${h(thread.id)}" aria-pressed="${thread.id === state.selectedThreadId}"><b>${h(thread.subject)}</b><span>${h([...new Set(thread.messages.map(m => m.from.name))].join(', '))}</span><small>${h(mailDate(thread.messages.at(-1).sentAt))} · ${thread.messages.length} messages${thread.unread ? ' · Unread' : ''}</small></button>`).join('') || `<p class="mail-empty">${state.query.trim() ? 'No matching conversations.' : 'No conversations in this folder.'}</p>`;
    if (oldFocus) [...root.querySelectorAll('[data-mail-thread]')].find(button => button.dataset.mailThread === oldFocus)?.focus({preventScroll:true});
    if (renderedThread !== state.selectedThreadId) {
      const thread = model.getThread(state.selectedThreadId);
      root.querySelector('.mail-reader').innerHTML = thread ? renderMailThread(thread) : '<p class="mail-empty">Select a conversation to read.</p>';
      root.querySelector('.mail-reader').scrollTop = 0; renderedThread = state.selectedThreadId;
    }
    root.querySelector('#mail-mark-unread').disabled = !state.selectedThreadId;
    const messageCount = threads.reduce((total,t) => total + t.messages.length,0);
    root.querySelector('#mail-count').textContent = `${threads.length} conversation${threads.length === 1 ? '' : 's'} · ${messageCount} message${messageCount === 1 ? '' : 's'}`;
    root.querySelector('#mail-warning').textContent = model.getWarning() || 'Dates provisional';
  }
  root.querySelector('.mail-search').addEventListener('submit', event => event.preventDefault());
  root.querySelector('#mail-search').addEventListener('input', event => model.setQuery(event.target.value));
  root.querySelector('#mail-clear-search').addEventListener('click', () => { model.setQuery(''); root.querySelector('#mail-search').focus(); });
  root.addEventListener('click', event => {
    const reference = event.target.closest('[data-mail-reference]');
    if (reference) {
      event.stopPropagation();
      if (model.getReference(reference.dataset.mailMessage, reference.dataset.mailReference)) openRecord(reference.dataset.mailReference);
      return;
    }
    const folder = event.target.closest('[data-mail-folder]');
    if (folder) { model.setFolder(folder.dataset.mailFolder); [...root.querySelectorAll('[data-mail-folder]')].find(button => button.dataset.mailFolder === folder.dataset.mailFolder)?.focus(); }
    const thread = event.target.closest('[data-mail-thread]');
    if (thread) model.openThread(thread.dataset.mailThread);
    if (event.target.closest('#mail-mark-unread')) model.markUnread(model.getState().selectedThreadId);
  });
  root.addEventListener('keydown', event => {
    const current = event.target.closest('[data-mail-thread], [data-mail-folder]');
    if (event.key === 'F6') {
      event.preventDefault();
      const reader = root.querySelector('.mail-reader');
      (reader.contains(document.activeElement) ? root.querySelector('.mail-thread[aria-pressed="true"]') || root.querySelector('.mail-thread') : reader)?.focus();
      return;
    }
    if (!current || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const folders = current.hasAttribute('data-mail-folder');
    const buttons = [...root.querySelectorAll(folders ? '[data-mail-folder]' : '[data-mail-thread]')];
    const index = buttons.indexOf(current);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0,Math.min(buttons.length-1,index + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1)));
    event.preventDefault(); const button = buttons[next]; if (!button) return;
    if (folders) model.setFolder(button.dataset.mailFolder); else model.openThread(button.dataset.mailThread);
    const attribute = folders ? 'mailFolder' : 'mailThread';
    [...root.querySelectorAll(folders ? '[data-mail-folder]' : '[data-mail-thread]')].find(el => el.dataset[attribute] === button.dataset[attribute])?.focus();
  });
  model.subscribe(render);
  store.onEvent(({type}) => { if (type === 'hilfer:progress-reset') model.reset(); });
  render(); return model;
}
