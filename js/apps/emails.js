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
export function createMailModel(input, { storage, grants = input.initialGrants, getRecord, isAvailable = () => true, canReference = () => true } = {}) {
  validateMailCorpus(input, getRecord);
  const corpus = copy(input);
  for (const thread of corpus.threads) thread.messages.sort((a,b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id));
  let effectiveGrants = new Set(grants), readIds = new Set(), query = '';
  let folderId = corpus.folders[0].id, selectedThreadId = null, selectedMessageId = null, warning = '';
  const subscribers = new Set();
  const deleted = new Set();
  const folders = corpus.folders.map(folder => folder.id === 'archive' ? {...folder, label:'Archive'} : folder);
  folders.push({id:'deleted', label:'Deleted Items'});
  const authorized = () => corpus.threads.filter(thread => isAvailable(thread.id) && thread.access.requiredGrants.every(grant => effectiveGrants.has(grant)))
    .map(thread=>({...thread,messages:thread.messages.filter(message=>isAvailable(message.id)).map(message=>({...message,
      references:message.references.filter(reference=>canReference(reference.id)),
      ...(message.attachments ? {attachments:message.attachments.filter(attachment=>isAvailable(attachment.id))} : {})
    }))})).filter(thread=>thread.messages.length);
  const find = id => authorized().find(thread => thread.id === id);
  const isMe = person => person.address.toLowerCase() === corpus.mailbox.address.toLowerCase();
  const outgoing = thread => thread.messages.filter(message => isMe(message.from));
  const inFolder = (thread, folder) => {
    if (folder === 'deleted' || deleted.has(thread.id)) return folder === 'deleted' && deleted.has(thread.id);
    return folder === 'sent' ? outgoing(thread).length > 0 : thread.folderId === folder;
  };
  const inSearch = thread => deleted.has(thread.id) === (folderId === 'deleted');
  const allowedIds = () => new Set(authorized().flatMap(thread => thread.messages.map(message => message.id)));
  function cleanState() {
    for (const id of deleted) if (!find(id)) deleted.delete(id);
    const allowed = allowedIds(); readIds = new Set([...readIds].filter(id => allowed.has(id)));
    if (!find(selectedThreadId)) selectedThreadId = null;
    if (!authorized().some(thread => thread.messages.some(message => message.id === selectedMessageId))) selectedMessageId = null;
  }
  try {
    const raw = storage?.getItem(MAIL_UI_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.readMessageIds)) throw new Error('Old receipt');
      readIds = new Set(saved.readMessageIds);
      if (Array.isArray(saved.deletedThreadIds)) saved.deletedThreadIds.forEach(id => deleted.add(id));
      if (folders.some(folder => folder.id === saved.folderId)) folderId = saved.folderId;
      if (find(saved.selectedThreadId) && inFolder(find(saved.selectedThreadId), folderId)) selectedThreadId = saved.selectedThreadId;
      if (authorized().some(thread => inFolder(thread, folderId) && thread.messages.some(message => message.id === saved.selectedMessageId))) selectedMessageId = saved.selectedMessageId;
    }
  } catch { warning = 'Mail view started with fresh read receipts.'; }
  cleanState();
  const state = () => ({ folderId, selectedThreadId, selectedMessageId, query, readMessageIds: [...readIds], deletedThreadIds: [...deleted] });
  function publish(persist = true) {
    cleanState();
    if (persist) {
      try { storage?.setItem(MAIL_UI_KEY, JSON.stringify({ version:1, folderId, selectedThreadId, selectedMessageId, readMessageIds:[...readIds], deletedThreadIds:[...deleted] })); }
      catch { warning = 'Mail view could not be saved; reading is available for this session.'; }
    }
    subscribers.forEach(fn => fn(state()));
  }
  const unread = thread => thread.messages.some(message => !readIds.has(message.id));
  const matches = (thread, message, term) => [thread.subject,message.subject ?? '',message.from.name,message.from.address,message.body,...message.to.flatMap(p=>[p.name,p.address]),...message.cc.flatMap(p=>[p.name,p.address]),...message.references.map(r=>r.id)].join('\n').toLowerCase().includes(term);
  function listMessages() {
    const term = query.trim().toLowerCase();
    return copy(authorized().filter(thread => term ? inSearch(thread) : inFolder(thread, folderId)).flatMap(thread => thread.messages.filter(message => !term || matches(thread,message,term)).map(message => ({...message,subject:message.subject ?? thread.subject,threadId:thread.id,folderId:thread.folderId,unread:!readIds.has(message.id)})))
      .sort((a,b)=>b.sentAt.localeCompare(a.sentAt) || a.id.localeCompare(b.id)));
  }
  function listThreads() {
    const term = query.trim().toLowerCase();
    const rows = [];
    for (const thread of authorized()) {
      const latest = thread.messages.at(-1);
      const match = term ? thread.messages.findLast(message => matches(thread, message, term)) : null;
      if (term ? !match || !inSearch(thread) : !inFolder(thread, folderId)) continue;
      const sent = !term && folderId === 'sent';
      const preview = sent ? outgoing(thread).at(-1) : latest;
      const participants = sent ? preview.to : thread.messages.map(message => message.from);
      const names = [...new Map(participants.map(person => [person.address.toLowerCase(), isMe(person) ? 'me' : person.name])).values()];
      rows.push({...thread, unread: unread(thread), preview, expandedId: (match ?? preview).id,
        participants: (sent ? 'To: ' : '') + names.join(', ')});
    }
    return copy(rows.sort((a,b) => b.preview.sentAt.localeCompare(a.preview.sentAt) || a.id.localeCompare(b.id)));
  }
  function setThreadRead(id, read) {
    const thread = find(id);
    if (!thread) return false;
    if (!thread.messages.some(message => readIds.has(message.id) !== read)) return true;
    for (const message of thread.messages) {
      if (read) readIds.add(message.id);
      else readIds.delete(message.id);
    }
    publish();
    return true;
  }
  return {
    getState: state, getWarning: () => warning, getMailbox: () => copy(corpus.mailbox),
    getFolders: () => folders.map(folder => {
      const threads = authorized().filter(thread => inFolder(thread, folder.id));
      const messages = threads.flatMap(thread => thread.messages);
      return {...copy(folder), count: threads.length, unread: threads.filter(unread).length,
        messageCount: messages.length, unreadMessages: messages.filter(message => !readIds.has(message.id)).length};
    }),
    listThreads, listMessages,
    getThread(id) { const thread = find(id); return thread ? copy(thread) : null; },
    getMessage(id) { for (const thread of authorized()) { const message = thread.messages.find(m => m.id === id); if (message) return copy({...message,threadId:thread.id}); } return null; },
    getReference(messageId, recordId) { return this.getMessage(messageId)?.references.find(reference => reference.id === recordId) ?? null; },
    setFolder(id) { if (!folders.some(f => f.id === id)) return false; folderId = id; query = ''; selectedThreadId = null; selectedMessageId = null; publish(); return true; },
    setQuery(value) { query = String(value); if (!listThreads().some(t => t.id === selectedThreadId)) selectedThreadId = null; if (!listMessages().some(m=>m.id===selectedMessageId)) selectedMessageId=null; publish(false); },
    setThreadDeleted(id, value) {
      if (!find(id) || typeof value !== 'boolean' || deleted.has(id) === value) return false;
      if (value) deleted.add(id);
      else deleted.delete(id);
      if (selectedThreadId === id) { selectedThreadId = null; selectedMessageId = null; }
      publish();
      return true;
    },
    selectThread(id) {
      if (!find(id)) return {ok:false,message:'Conversation unavailable.'};
      if (selectedThreadId !== id) {
        selectedThreadId = id;
        selectedMessageId = null;
        publish();
      }
      return {ok:true};
    },
    openThread(id) {
      const thread = find(id);
      if (!thread) return {ok:false,message:'Conversation unavailable.'};
      if (!inFolder(thread, folderId) && !query.trim()) folderId = deleted.has(id) ? 'deleted' : thread.folderId;
      this.selectThread(id);
      setThreadRead(id, true);
      return {ok:true};
    },
    setThreadRead,
    selectMessage(id) {
      const message=this.getMessage(id); if (!message) return {ok:false,message:'Message unavailable.'};
      if (selectedMessageId===id) return {ok:true};
      selectedMessageId=id; selectedThreadId=message.threadId; folderId=deleted.has(message.threadId) ? 'deleted' : find(message.threadId).folderId; publish(); return {ok:true};
    },
    openMessage(id) {
      const message=this.getMessage(id); if (!message) return {ok:false,message:'Conversation unavailable.'};
      selectedMessageId=id; selectedThreadId=message.threadId; folderId=deleted.has(message.threadId) ? 'deleted' : find(message.threadId).folderId; readIds.add(id); publish(); return {ok:true};
    },
    setMessageRead(id, read) { if (!this.getMessage(id) || typeof read !== 'boolean') return false; if (readIds.has(id)===read) return true; if (read) readIds.add(id); else readIds.delete(id); publish(); return true; },
    markUnread(id) { return setThreadRead(id, false); },
    setGrants(values) { effectiveGrants = new Set(values); cleanState(); publish(); },
    reset() { readIds.clear(); deleted.clear(); query = ''; folderId = corpus.folders[0].id; selectedThreadId = null; selectedMessageId = null; warning = ''; publish(); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
  };
}

const person = value => `${h(value.name)} &lt;${h(value.address)}&gt;`;
const mailDate = value => `${displayDate(value)} ${value.slice(11,16)}`;
export function renderMailMessage(message, subject = message.subject, compact = false) {
  const fields = `<dl class="mail-message-fields"><dt>From:</dt><dd>${person(message.from)}</dd><dt>To:</dt><dd>${message.to.map(person).join('; ')}</dd><dt>Cc:</dt><dd>${message.cc.length ? message.cc.map(person).join('; ') : '—'}</dd><dt>Date:</dt><dd><time datetime="${h(message.sentAt)}" title="Facility-local timestamp">${h(mailDate(message.sentAt))}</time></dd><dt>Subject:</dt><dd>${h(subject)}</dd></dl>`;
  return `${compact ? `<details class="mail-envelope-details"><summary>To: ${h(message.to.map(recipient => recipient.name).join(', '))}</summary>${fields}</details>` : fields}
    <div class="mail-message-scroll" tabindex="-1"><div class="mail-body">${h(message.body)}</div>${message.references.map(reference => `<button type="button" class="source-reference" data-mail-reference="${h(reference.id)}" data-mail-message="${h(message.id)}">${h(reference.label)}</button>`).join('')}</div>
    <footer class="mail-message-status"><span>${h(message.id)}</span><span>Facility-local time</span></footer>`;
}
// Retained for consumers of the original conversation markup.
export function renderMailThread(thread) {
  return thread.messages.map(message => renderMailMessage(message, message.subject ?? thread.subject)).join('');
}
const envelope = unread => `<svg class="mail-envelope" viewBox="0 0 20 18" aria-hidden="true"><path d="${unread ? 'M2 4h16v12H2z M2 4l8 6 8-6' : 'M2 7l8-5 8 5v9H2z M2 7l8 6 8-6'}"/></svg>`;
const toolIcon = kind => {
  if (['open', 'unread', 'delete', 'restore'].includes(kind)) {
    return `<img class="mail-tool-icon mail-tool-bitmap" src="assets/win98-mail/${kind}.png" alt="">`;
  }
  const paths = {previous:'M14 3L7 10l7 7 M7 10h11',next:'M6 3l7 7-7 7 M2 10h11'};
  return `<svg class="mail-tool-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="${paths[kind]}"/></svg>`;
};

function snippet(body) {
  return body.trim().replace(/\s+/g, ' ').slice(0, 240);
}

function renderConversation(thread, expandedId) {
  const portraits = new Map([
    ['jessica', 'assets/arwa/portraits/jessica-mail.webp'],
    ['tito', 'assets/arwa/portraits/tito-mail.webp']
  ]);
  return thread.messages.map(message => {
    const initials = message.from.name.split(/\s+/).slice(0, 2).map(part => [...part][0]).join('');
    const portrait = portraits.get(message.from.id);
    const avatar = portrait
      ? `<img class="mail-avatar" src="${portrait}" alt="">`
      : `<span class="mail-avatar" aria-hidden="true">${h(initials)}</span>`;
    return `<details class="mail-thread-message" data-message-id="${h(message.id)}" ${message.id === expandedId ? 'open' : ''}>
      <summary>${avatar}<b>${h(message.from.name)}</b>
        <time datetime="${h(message.sentAt)}">${h(mailDate(message.sentAt))}</time>
        <span class="mail-collapsed-preview">${h(snippet(message.body))}</span></summary>
      <div class="mail-thread-body">${renderMailMessage(message, message.subject ?? thread.subject, true)}</div>
    </details>`;
  }).join('');
}

export function mountMail(root, corpus, { storage, store, openRecord, artifacts, model:providedModel }) {
  const model = providedModel ?? createMailModel(corpus, {storage,getRecord:store.getRecord});
  const mailbox = model.getMailbox(), threadWindows = new Map();
  const action = (name,label,extra='') => `<button type="button" data-mail-command="${name}" ${extra}>${label}</button>`;
  const menu = (label,items) => `<details class="mail-menu"><summary>${label}</summary><div class="mail-menu-panel">${items}</div></details>`;
  root.innerHTML = `<nav class="mail-menubar" aria-label="Mail menus">
    ${menu('File',action('open','Open conversation','data-needs-selection disabled')+action('close-mail','Close Mail'))}
    ${menu('Edit',action('find','Find…'))}
    ${menu('View',model.getFolders().map(folder=>action('folder',h(folder.label),`data-mail-folder="${h(folder.id)}"`)).join(''))}
    ${menu('Mail',action('read','Mark as read','data-needs-selection disabled')+action('unread','Mark as unread','data-needs-selection disabled'))}
    ${menu('Window',action('close-messages','Close conversation windows','disabled'))}<button type="button" disabled>Help</button></nav>
    <div class="mail-toolbar" role="toolbar" aria-label="Mail tools">
      ${action('open',toolIcon('open')+'<span>Open</span>','data-needs-selection disabled')}
      ${action('previous',toolIcon('previous')+'<span>Prev</span>','disabled')}${action('next',toolIcon('next')+'<span>Next</span>')}
      ${action('unread',toolIcon('unread')+'<span>Unread</span>','data-needs-selection disabled')}
      <span class="mail-toolbar-divider" aria-hidden="true"></span>
      ${action('delete',toolIcon('delete')+'<span>Delete</span>','disabled')}
      ${action('restore',toolIcon('restore')+'<span>Restore</span>','hidden disabled')}
    </div>
    <div class="mail-account"><b>${h(mailbox.displayName)}</b><span>${h(mailbox.address)}</span></div>
    <form class="mail-search" role="search"><label for="mail-search">Find</label><input id="mail-search" type="search" placeholder="Search all authorized mail" autocomplete="off"><button type="button" id="mail-clear-search">Clear</button></form>
    <div class="mail-workspace"><nav class="mail-folders" aria-label="Mail folders"><div class="mail-pane-heading">Mail Folders</div><div class="mail-tree-root">${envelope(false)}<b>HILFER Mail</b></div>${model.getFolders().map(folder=>`<button type="button" data-mail-folder="${h(folder.id)}"><span class="mail-folder-symbol" aria-hidden="true"></span><span>${h(folder.label)}<span data-folder-unread="${h(folder.id)}"></span></span></button>`).join('')}</nav>
    <section class="mail-list-pane" aria-label="Messages"><div class="mail-pane-heading" id="mail-list-label"></div><div class="mail-table-scroll"><table class="mail-table" role="grid" aria-label="Mail conversations"><colgroup><col class="mail-state-column"><col class="mail-from-column"><col><col class="mail-date-column"></colgroup><thead><tr><th scope="col" aria-label="Read status"></th><th scope="col">Participants</th><th scope="col">Subject</th><th scope="col" aria-sort="descending">Latest</th></tr></thead><tbody></tbody></table><p class="mail-empty" hidden></p></div></section></div>
    <footer class="mail-status status-bar" role="status"><span class="status-bar-field" id="mail-count"></span><span class="status-bar-field" id="mail-warning">Facility-local time</span></footer>`;
  let rowSignature;
  const currentRows = () => model.listThreads();
  function selectRow(id, focus = true) {
    if (!model.selectThread(id).ok) return;
    if (focus) {
      const row=[...root.querySelectorAll('[data-mail-row]')].find(row=>row.dataset.mailRow===id);
      row?.focus({preventScroll:true}); row?.scrollIntoView({block:'nearest',inline:'nearest'});
    }
  }
  function closeThread(id) {
    const node = threadWindows.get(id); if (!node) return;
    for(const message of node.querySelectorAll('[data-message-id]')) artifacts?.cancel('mail:'+message.dataset.messageId);
    threadWindows.delete(id); window.closeWindow(node.id.slice(0,-7)); node.remove();
  }
  const closeThreads = () => [...threadWindows.keys()].forEach(closeThread);
  function openThread(id) {
    const row = currentRows().find(thread => thread.id === id);
    if (!row || !model.openThread(id).ok) return;
    if(artifacts && !artifacts.canOpen('mail',id)) return;
    let node = threadWindows.get(id);
    if (!node) {
      node = document.createElement('section'); node.id = 'mail-message-' + id + '-window'; node.className = 'window mail-message-window';
      node.dataset.threadId = id;
      const title = row.subject;
      node.setAttribute('aria-label',title);
      const narrow=window.innerWidth<=700;
      const width = Math.min(620,window.innerWidth-12), height = narrow ? window.innerHeight-48 : Math.min(475,window.innerHeight-48), offset = threadWindows.size % 5 * 28;
      Object.assign(node.style,{width:width+'px',height:height+'px',left:Math.max(6,Math.min(225+offset,window.innerWidth-width-12))+'px',top:(narrow ? 10 : Math.max(10,Math.min(145+offset,window.innerHeight-height-42)))+'px'});
      node.innerHTML = `<div class="window-header"><span class="window-title">${h(title)}</span><div class="window-controls"><button class="window-button" data-control="minimize" aria-label="Minimize ${h(title)}"></button><button class="window-button" data-control="maximize" aria-label="Maximize ${h(title)}"></button><button class="window-button close-btn" data-control="close" aria-label="Close ${h(title)}"></button></div></div><div class="window-content mail-message-content mail-thread-content" tabindex="-1"></div>`;
      node.addEventListener('click',event=>{
        const reference=event.target.closest('[data-mail-reference]');
        if (reference) { event.stopPropagation(); if (model.getReference(reference.dataset.mailMessage,reference.dataset.mailReference)) openRecord(reference.dataset.mailReference); }
      });
      node.addEventListener('keydown',event=>{ if (event.key==='Escape') { event.preventDefault(); window.closeWindow(node.id.slice(0,-7)); } });
      node.addEventListener('toggle',event=>{
        const message=event.target;
        if(!message.matches('.mail-thread-message')) return;
        const viewer='mail:'+message.dataset.messageId;
        artifacts?.cancel(viewer);
        if(message.open && node.classList.contains('visible')) void artifacts?.present(viewer,'mail',message.dataset.messageId,{node:message});
      },true);
      new MutationObserver(()=>{
        if(!node.classList.contains('visible')) {
          for(const message of node.querySelectorAll('[data-message-id]')) artifacts?.cancel('mail:'+message.dataset.messageId);
        } else {
          for(const message of node.querySelectorAll('.mail-thread-message[open]')) void artifacts?.present('mail:'+message.dataset.messageId,'mail',message.dataset.messageId,{node:message});
        }
      }).observe(node,{attributes:true,attributeFilter:['class']});
      document.querySelector('#desktop').append(node); threadWindows.set(id,node);
    }
    const content = node.querySelector('.mail-thread-content');
    if (!content.firstElementChild || !node.classList.contains('visible') || node.dataset.expandedId !== row.expandedId) {
      for(const message of content.querySelectorAll('[data-message-id]')) artifacts?.cancel('mail:'+message.dataset.messageId);
      content.innerHTML = renderConversation(row, row.expandedId);
      node.dataset.expandedId = row.expandedId;
      node.dataset.contentSignature=JSON.stringify(model.getThread(id));
    }
    window.openWindow(node.id.slice(0,-7));
    const header = content.querySelector('.mail-thread-message[open] > summary');
    header?.scrollIntoView({block:'nearest'});
    (header ?? content).focus({preventScroll:true});
    render();
    for(const message of content.querySelectorAll('.mail-thread-message[open]')) void artifacts?.present('mail:'+message.dataset.messageId,'mail',message.dataset.messageId,{node:message});
  }
  function render() {
    for (const id of [...threadWindows.keys()]) if (!model.getThread(id)) closeThread(id);
    for(const [id,node] of threadWindows) {
      const thread=model.getThread(id), signature=JSON.stringify(thread);
      if(node.dataset.contentSignature===signature) continue;
      const content=node.querySelector('.mail-thread-content');
      const openIds=[...content.querySelectorAll('.mail-thread-message[open]')].map(el=>el.dataset.messageId);
      for(const message of content.querySelectorAll('[data-message-id]')) artifacts?.cancel('mail:'+message.dataset.messageId);
      content.innerHTML=renderConversation(thread,null);
      for(const message of content.querySelectorAll('[data-message-id]')) message.open=openIds.includes(message.dataset.messageId);
      node.dataset.contentSignature=signature;
    }
    const state=model.getState(), folders=model.getFolders(), rows=currentRows();
    const selected=rows.find(message=>message.id===state.selectedThreadId), selectedIndex=rows.findIndex(message=>message.id===state.selectedThreadId);
    const inDeleted = state.folderId === 'deleted';
    const deleteButton = root.querySelector('[data-mail-command="delete"]');
    const restoreButton = root.querySelector('[data-mail-command="restore"]');
    deleteButton.hidden = inDeleted;
    restoreButton.hidden = !inDeleted;
    deleteButton.disabled = restoreButton.disabled = !selected;
    const oldFocus=root.querySelector('.mail-table')?.contains(document.activeElement) ? document.activeElement.dataset.mailRow : null;
    root.querySelectorAll('[data-mail-folder]').forEach(button=>{
      const folder=folders.find(f=>f.id===button.dataset.mailFolder);
      if (folder.id === 'deleted') button.toggleAttribute('data-filled', folder.count > 0);
      button.setAttribute('aria-pressed',String(!state.query.trim() && state.folderId===folder.id));
      button.setAttribute('aria-label',`${folder.label}, ${folder.unread} unread conversations`);
    });
    root.querySelectorAll('[data-folder-unread]').forEach(span=>{const count=folders.find(f=>f.id===span.dataset.folderUnread).unread;span.textContent=count ? ` (${count})` : '';});
    root.querySelector('#mail-search').value=state.query;
    const unreadCount=rows.filter(message=>message.unread).length;
    root.querySelector('#mail-list-label').textContent=`${state.query.trim() ? (inDeleted ? 'Search / Deleted Items' : 'Search results') : folders.find(f=>f.id===state.folderId).label} — ${rows.length} conversation${rows.length===1?'':'s'} (${unreadCount} unread)`;
    const signature=JSON.stringify(rows.map(row => [row.id, row.unread, row.preview.id, row.participants]));
    if (signature!==rowSignature) {
      root.querySelector('tbody').innerHTML = rows.map(row => {
        const preview = snippet(row.preview.body);
        return `<tr data-mail-row="${h(row.id)}" aria-selected="false" tabindex="-1" class="${row.unread ? 'mail-unread' : ''}">
          <td aria-label="${row.unread ? 'Unread' : 'Read'}">${envelope(row.unread)}</td>
          <td title="${h(row.participants)}">${h(row.participants)} <span class="mail-snippet">(${row.messages.length})</span></td>
          <td title="${h(row.subject + ' — ' + preview)}">${h(row.subject)} <span class="mail-snippet">— ${h(preview)}</span></td>
          <td><time datetime="${h(row.preview.sentAt)}" title="Facility-local timestamp">${h(mailDate(row.preview.sentAt))}</time></td></tr>`;
      }).join('');
      rowSignature=signature;
    }
    const activeId=selected?.id ?? rows[0]?.id;
    root.querySelectorAll('[data-mail-row]').forEach(row=>{row.setAttribute('aria-selected',String(row.dataset.mailRow===selected?.id));row.tabIndex=row.dataset.mailRow===activeId ? 0 : -1;});
    if (oldFocus) [...root.querySelectorAll('[data-mail-row]')].find(row=>row.dataset.mailRow===oldFocus)?.focus({preventScroll:true});
    root.querySelector('.mail-empty').hidden=Boolean(rows.length);
    root.querySelector('.mail-empty').textContent=state.query.trim() ? 'No matching messages.' : 'No messages in this folder.';
    root.querySelectorAll('[data-needs-selection]').forEach(button=>button.disabled=!selected);
    root.querySelector('[data-mail-command="previous"]').disabled=selectedIndex<=0;
    root.querySelector('[data-mail-command="next"]').disabled=!rows.length || selectedIndex===rows.length-1;
    root.querySelector('[data-mail-command="close-messages"]').disabled=![...threadWindows.values()].some(node=>node.classList.contains('visible'));
    root.querySelector('#mail-count').textContent=`${rows.length} conversation${rows.length===1?'':'s'} (${unreadCount} unread)`;
    root.querySelector('#mail-warning').textContent=model.getWarning() || 'Facility-local time';
  }
  root.querySelector('.mail-search').addEventListener('submit',event=>event.preventDefault());
  root.querySelector('#mail-search').addEventListener('input',event=>model.setQuery(event.target.value));
  root.querySelector('#mail-clear-search').addEventListener('click',()=>{model.setQuery('');root.querySelector('#mail-search').focus();});
  root.addEventListener('toggle',event=>{if(event.target.matches('.mail-menu[open]')) root.querySelectorAll('.mail-menu[open]').forEach(menu=>{if(menu!==event.target)menu.open=false;});},true);
  root.addEventListener('click',event=>{
    const folder=event.target.closest('[data-mail-folder]');
    if(folder){model.setFolder(folder.dataset.mailFolder);root.querySelectorAll('.mail-menu[open]').forEach(menu=>menu.open=false);return;}
    const row=event.target.closest('[data-mail-row]');if(row){selectRow(row.dataset.mailRow);return;}
    const button=event.target.closest('[data-mail-command]');if(!button)return;
    const command=button.dataset.mailCommand, id=model.getState().selectedThreadId;
    root.querySelectorAll('.mail-menu[open]').forEach(menu=>menu.open=false);
    if(command==='open'){event.stopPropagation();openThread(id);}
    if(command==='find')root.querySelector('#mail-search').focus();
    if(command==='read'||command==='unread')model.setThreadRead(id,command==='read');
    if ((command === 'delete' || command === 'restore') && model.setThreadDeleted(id, command === 'delete')) {
      closeThread(id);
      const next = currentRows()[0];
      if (next) selectRow(next.id);
      else root.querySelector('.mail-folders [aria-pressed="true"]')?.focus();
    }
    if(command==='close-mail'){event.stopPropagation();window.closeWindow('emails');}
    if(command==='close-messages')closeThreads();
    if(command==='previous'||command==='next'){const rows=currentRows(), index=rows.findIndex(m=>m.id===id);selectRow(rows[Math.max(0,Math.min(rows.length-1,index+(command==='next'?1:-1)))]?.id);}
  });
  root.addEventListener('dblclick',event=>{const row=event.target.closest('[data-mail-row]');if(row){event.stopPropagation();openThread(row.dataset.mailRow);}});
  root.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){event.preventDefault();root.querySelector('#mail-search').focus();return;}
    if(event.key==='Escape'){root.querySelectorAll('.mail-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus();});return;}
    const row=event.target.closest('[data-mail-row]');
    if(row && event.key==='Enter'){event.preventDefault();event.stopPropagation();openThread(row.dataset.mailRow);return;}
    if(row && ['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const rows=currentRows(),index=rows.findIndex(m=>m.id===row.dataset.mailRow);const next=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowDown'?1:-1)));selectRow(rows[next]?.id);}
    const folder=event.target.closest('.mail-folders [data-mail-folder]');
    if(folder && ['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const buttons=[...root.querySelectorAll('.mail-folders [data-mail-folder]')], index=buttons.indexOf(folder),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowDown'?1:-1)));buttons[next].click();buttons[next].focus();}
  });
  document.addEventListener('pointerdown',event=>{if(!root.querySelector('.mail-menubar').contains(event.target))root.querySelectorAll('.mail-menu[open]').forEach(menu=>menu.open=false);});
  window.addEventListener('hilfer:window-closed',({detail})=>{if([...threadWindows.values()].some(node=>node.id===detail.windowId+'-window')){render();if(root.closest('.window').classList.contains('active'))selectRow(model.getState().selectedThreadId);}});
  model.subscribe(render);
  artifacts?.subscribe(render);
  store.onEvent(({type})=>{if(type==='hilfer:progress-reset'){closeThreads();model.reset();}});
  window.addEventListener('hilfer:mail-navigate',({detail})=>{const thread=model.getThread(detail?.threadId);if(thread){model.setFolder(thread.folderId);openThread(thread.id);}});
  render();return model;
}
