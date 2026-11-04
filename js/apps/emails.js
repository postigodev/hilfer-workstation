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
  let folderId = corpus.folders[0].id, selectedThreadId = null, selectedMessageId = null, warning = '';
  const subscribers = new Set();
  const authorized = () => corpus.threads.filter(thread => thread.access.requiredGrants.every(grant => effectiveGrants.has(grant)));
  const find = id => authorized().find(thread => thread.id === id);
  const allowedIds = () => new Set(authorized().flatMap(thread => thread.messages.map(message => message.id)));
  function cleanState() {
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
      if (corpus.folders.some(folder => folder.id === saved.folderId)) folderId = saved.folderId;
      if (find(saved.selectedThreadId)?.folderId === folderId) selectedThreadId = saved.selectedThreadId;
      if (authorized().some(thread => thread.folderId === folderId && thread.messages.some(message => message.id === saved.selectedMessageId))) selectedMessageId = saved.selectedMessageId;
    }
  } catch { warning = 'Mail view started with fresh read receipts.'; }
  cleanState();
  const state = () => ({ folderId, selectedThreadId, selectedMessageId, query, readMessageIds: [...readIds] });
  function publish(persist = true) {
    cleanState();
    if (persist) {
      try { storage?.setItem(MAIL_UI_KEY, JSON.stringify({ version:1, folderId, selectedThreadId, selectedMessageId, readMessageIds:[...readIds] })); }
      catch { warning = 'Mail view could not be saved; reading is available for this session.'; }
    }
    subscribers.forEach(fn => fn(state()));
  }
  const unread = thread => thread.messages.some(message => !readIds.has(message.id));
  const matches = (thread, message, term) => [thread.subject,message.subject ?? '',message.from.name,message.from.address,message.body,...message.to.flatMap(p=>[p.name,p.address]),...message.cc.flatMap(p=>[p.name,p.address]),...message.references.map(r=>r.id)].join('\n').toLowerCase().includes(term);
  function listMessages() {
    const term = query.trim().toLowerCase();
    return copy(authorized().filter(thread => term || thread.folderId === folderId).flatMap(thread => thread.messages.filter(message => !term || matches(thread,message,term)).map(message => ({...message,subject:message.subject ?? thread.subject,threadId:thread.id,folderId:thread.folderId,unread:!readIds.has(message.id)})))
      .sort((a,b)=>b.sentAt.localeCompare(a.sentAt) || a.id.localeCompare(b.id)));
  }
  function listThreads() {
    const term = query.trim().toLowerCase();
    return copy(authorized().filter(thread => term ? [thread.subject, ...thread.messages.flatMap(message => [message.subject ?? '', message.from.name, message.from.address, message.body, ...message.to.flatMap(p => [p.name,p.address]), ...message.cc.flatMap(p => [p.name,p.address]), ...message.references.map(r => r.id)])].join('\n').toLowerCase().includes(term) : thread.folderId === folderId)
      .sort((a,b) => b.messages.at(-1).sentAt.localeCompare(a.messages.at(-1).sentAt) || a.id.localeCompare(b.id))
      .map(thread => ({...thread, unread:unread(thread)})));
  }
  return {
    getState: state, getWarning: () => warning, getMailbox: () => copy(corpus.mailbox),
    getFolders: () => corpus.folders.map(folder => ({...copy(folder), messageCount:authorized().filter(t=>t.folderId===folder.id).reduce((n,t)=>n+t.messages.length,0), unreadMessages:authorized().filter(t=>t.folderId===folder.id).reduce((n,t)=>n+t.messages.filter(m=>!readIds.has(m.id)).length,0), count:authorized().filter(t => t.folderId === folder.id).length, unread:authorized().filter(t => t.folderId === folder.id && unread(t)).length})),
    listThreads, listMessages,
    getThread(id) { const thread = find(id); return thread ? copy(thread) : null; },
    getMessage(id) { for (const thread of authorized()) { const message = thread.messages.find(m => m.id === id); if (message) return copy({...message,threadId:thread.id}); } return null; },
    getReference(messageId, recordId) { return this.getMessage(messageId)?.references.find(reference => reference.id === recordId) ?? null; },
    setFolder(id) { if (!corpus.folders.some(f => f.id === id)) return false; folderId = id; query = ''; selectedThreadId = null; selectedMessageId = null; publish(); return true; },
    setQuery(value) { query = String(value); if (!listThreads().some(t => t.id === selectedThreadId)) selectedThreadId = null; if (!listMessages().some(m=>m.id===selectedMessageId)) selectedMessageId=null; publish(false); },
    openThread(id) {
      const thread = find(id); if (!thread) return {ok:false,message:'Conversation unavailable.'};
      folderId = thread.folderId;
      selectedMessageId = null;
      selectedThreadId = id; thread.messages.forEach(message => readIds.add(message.id)); publish(); return {ok:true};
    },
    selectMessage(id) {
      const message=this.getMessage(id); if (!message) return {ok:false,message:'Message unavailable.'};
      if (selectedMessageId===id) return {ok:true};
      selectedMessageId=id; selectedThreadId=message.threadId; folderId=find(message.threadId).folderId; publish(); return {ok:true};
    },
    openMessage(id) {
      const message=this.getMessage(id); if (!message) return {ok:false,message:'Conversation unavailable.'};
      selectedMessageId=id; selectedThreadId=message.threadId; folderId=find(message.threadId).folderId; readIds.add(id); publish(); return {ok:true};
    },
    setMessageRead(id, read) { if (!this.getMessage(id) || typeof read !== 'boolean') return false; if (readIds.has(id)===read) return true; if (read) readIds.add(id); else readIds.delete(id); publish(); return true; },
    markUnread(id) { const thread = find(id); if (!thread) return false; thread.messages.forEach(message => readIds.delete(message.id)); publish(); return true; },
    setGrants(values) { effectiveGrants = new Set(values); cleanState(); publish(); },
    reset() { readIds.clear(); query = ''; folderId = corpus.folders[0].id; selectedThreadId = null; selectedMessageId = null; warning = ''; publish(); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
  };
}

const person = value => `${h(value.name)} &lt;${h(value.address)}&gt;`;
const mailDate = value => `${displayDate(value)} ${value.slice(11,16)}`;
export function renderMailMessage(message, subject = message.subject) {
  return `<dl class="mail-message-fields"><dt>From:</dt><dd>${person(message.from)}</dd><dt>To:</dt><dd>${message.to.map(person).join('; ')}</dd><dt>Cc:</dt><dd>${message.cc.length ? message.cc.map(person).join('; ') : '—'}</dd><dt>Date:</dt><dd><time datetime="${h(message.sentAt)}" title="Provisional demo timestamp">${h(mailDate(message.sentAt))}</time></dd><dt>Subject:</dt><dd>${h(subject)}</dd></dl>
    <div class="mail-message-scroll" tabindex="-1"><div class="mail-body">${h(message.body)}</div>${message.references.map(reference => `<button type="button" class="source-reference" data-mail-reference="${h(reference.id)}" data-mail-message="${h(message.id)}">${h(reference.label)}</button>`).join('')}</div>
    <footer class="mail-message-status"><span>${h(message.id)}</span><span>Dates provisional</span></footer>`;
}
// Retained for contributors using the v1 conversation renderer; the app opens single messages.
export function renderMailThread(thread) {
  return thread.messages.map(message => renderMailMessage(message, message.subject ?? thread.subject)).join('');
}
const envelope = unread => `<svg class="mail-envelope" viewBox="0 0 20 18" aria-hidden="true"><path d="${unread ? 'M2 4h16v12H2z M2 4l8 6 8-6' : 'M2 7l8-5 8 5v9H2z M2 7l8 6 8-6'}"/></svg>`;
const toolIcon = kind => {
  const paths = {compose:'M2 5h14v12H2z M2 5l7 6 7-6 M11 3l3 3 4-4-3-3z',reply:'M9 3L3 8l6 5V9c5 0 7 2 8 6V9c0-4-4-5-8-5z',forward:'M11 3l6 5-6 5V9c-5 0-7 2-8 6V9c0-4 4-5 8-5z',delete:'M3 3h14v14H3z M6 6l8 8 M14 6l-8 8',move:'M2 6V3h6l2 3h8v11H2z M7 11h7 M11 8l3 3-3 3',open:'M2 7l8-5 8 5v10H2z M2 7l8 6 8-6',previous:'M14 3L7 10l7 7 M7 10h11',next:'M6 3l7 7-7 7 M2 10h11',unread:'M2 4h16v12H2z M2 4l8 6 8-6'};
  return `<svg class="mail-tool-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="${paths[kind]}"/></svg>`;
};

export function mountMail(root, corpus, { storage, store, openRecord }) {
  const model = createMailModel(corpus, {storage,getRecord:store.getRecord});
  const mailbox = model.getMailbox(), messageWindows = new Map();
  const action = (name,label,extra='') => `<button type="button" data-mail-command="${name}" ${extra}>${label}</button>`;
  const menu = (label,items) => `<details class="mail-menu"><summary>${label}</summary><div class="mail-menu-panel">${items}</div></details>`;
  root.innerHTML = `<nav class="mail-menubar" aria-label="Mail menus">
    ${menu('File',action('open','Open message','data-needs-selection disabled')+action('close-mail','Close Mail'))}
    ${menu('Edit',action('find','Find…'))}
    ${menu('View',model.getFolders().map(folder=>action('folder',h(folder.label),`data-mail-folder="${h(folder.id)}"`)).join(''))}
    ${menu('Mail',action('read','Mark as read','data-needs-selection disabled')+action('unread','Mark as unread','data-needs-selection disabled'))}
    ${menu('Window',action('close-messages','Close message windows','disabled'))}<button type="button" disabled>Help</button></nav>
    <div class="mail-toolbar" role="toolbar" aria-label="Mail tools">
      ${[['compose','Compose'],['reply','Reply'],['reply','Reply All'],['forward','Forward'],['move','Move'],['delete','Delete']].map(([icon,label])=>`<button type="button" disabled title="${label} is unavailable in this demo">${toolIcon(icon)}<span>${label}</span></button>`).join('')}
      <span class="mail-toolbar-divider" aria-hidden="true"></span>
      ${action('open',toolIcon('open')+'<span>Open</span>','data-needs-selection disabled')}
      ${action('previous',toolIcon('previous')+'<span>Prev</span>','disabled')}${action('next',toolIcon('next')+'<span>Next</span>')}
      ${action('unread',toolIcon('unread')+'<span>Unread</span>','data-needs-selection disabled')}
    </div>
    <div class="mail-account"><b>${h(mailbox.displayName)}</b><span>${h(mailbox.address)}</span></div>
    <form class="mail-search" role="search"><label for="mail-search">Find</label><input id="mail-search" type="search" placeholder="Search all authorized mail" autocomplete="off"><button type="button" id="mail-clear-search">Clear</button></form>
    <div class="mail-workspace"><nav class="mail-folders" aria-label="Mail folders"><div class="mail-pane-heading">Mail Folders</div><div class="mail-tree-root">${envelope(false)}<b>HILFER Mail</b></div>${model.getFolders().map(folder=>`<button type="button" data-mail-folder="${h(folder.id)}"><span class="mail-folder-symbol" aria-hidden="true"></span><span>${h(folder.label)}<span data-folder-unread="${h(folder.id)}"></span></span></button>`).join('')}</nav>
    <section class="mail-list-pane" aria-label="Messages"><div class="mail-pane-heading" id="mail-list-label"></div><div class="mail-table-scroll"><table class="mail-table" role="grid" aria-label="Mail messages"><colgroup><col class="mail-state-column"><col class="mail-from-column"><col><col class="mail-date-column"></colgroup><thead><tr><th scope="col" aria-label="Read status"></th><th scope="col">From</th><th scope="col">Subject</th><th scope="col" aria-sort="descending">Received</th></tr></thead><tbody></tbody></table><p class="mail-empty" hidden></p></div></section></div>
    <footer class="mail-status" role="status"><span id="mail-count"></span><span id="mail-warning">Dates provisional</span></footer>`;
  let rowSignature;
  const currentRows = () => model.listMessages();
  function selectRow(id, focus = true) {
    if (!model.selectMessage(id).ok) return;
    if (focus) {
      const row=[...root.querySelectorAll('[data-mail-row]')].find(row=>row.dataset.mailRow===id);
      row?.focus({preventScroll:true}); row?.scrollIntoView({block:'nearest',inline:'nearest'});
    }
  }
  function closeMessage(id) {
    const node = messageWindows.get(id); if (!node) return;
    messageWindows.delete(id); window.closeWindow(node.id.slice(0,-7)); node.remove();
  }
  const closeMessages = () => [...messageWindows.keys()].forEach(closeMessage);
  function openMessage(id) {
    if (!model.openMessage(id).ok) return;
    const message = model.getMessage(id), thread = model.getThread(message.threadId);
    let node = messageWindows.get(id);
    if (!node) {
      node = document.createElement('section'); node.id = 'mail-message-' + id + '-window'; node.className = 'window mail-message-window';
      node.dataset.messageId = id;
      const title = message.subject ?? thread.subject;
      node.setAttribute('aria-label',title);
      const narrow=window.innerWidth<=700;
      const width = Math.min(620,window.innerWidth-12), height = narrow ? window.innerHeight-48 : Math.min(475,window.innerHeight-48), offset = messageWindows.size % 5 * 28;
      Object.assign(node.style,{width:width+'px',height:height+'px',left:Math.max(6,Math.min(225+offset,window.innerWidth-width-12))+'px',top:(narrow ? 10 : Math.max(10,Math.min(145+offset,window.innerHeight-height-42)))+'px'});
      node.innerHTML = `<div class="window-header"><span class="window-title">${h(title)}</span><div class="window-controls"><button class="window-button" data-control="minimize" aria-label="Minimize ${h(title)}">_</button><button class="window-button" data-control="maximize" aria-label="Maximize ${h(title)}">□</button><button class="window-button close-btn" data-control="close" aria-label="Close ${h(title)}">×</button></div></div><div class="window-content mail-message-content">${renderMailMessage(message,title)}</div>`;
      node.addEventListener('click',event=>{
        const reference=event.target.closest('[data-mail-reference]');
        if (reference) { event.stopPropagation(); if (model.getReference(id,reference.dataset.mailReference)) openRecord(reference.dataset.mailReference); }
      });
      node.addEventListener('keydown',event=>{ if (event.key==='Escape') { event.preventDefault(); window.closeWindow(node.id.slice(0,-7)); } });
      document.querySelector('#desktop').append(node); messageWindows.set(id,node);
    }
    window.openWindow(node.id.slice(0,-7)); node.querySelector('.mail-message-scroll').focus({preventScroll:true}); render();
  }
  function render() {
    for (const id of [...messageWindows.keys()]) if (!model.getMessage(id)) closeMessage(id);
    const state=model.getState(), folders=model.getFolders(), rows=currentRows();
    const selected=rows.find(message=>message.id===state.selectedMessageId), selectedIndex=rows.findIndex(message=>message.id===state.selectedMessageId);
    const oldFocus=root.querySelector('.mail-table')?.contains(document.activeElement) ? document.activeElement.dataset.mailRow : null;
    root.querySelectorAll('[data-mail-folder]').forEach(button=>{
      const folder=folders.find(f=>f.id===button.dataset.mailFolder);
      button.setAttribute('aria-pressed',String(!state.query.trim() && state.folderId===folder.id));
      button.setAttribute('aria-label',`${folder.label}, ${folder.unreadMessages} unread messages`);
    });
    root.querySelectorAll('[data-folder-unread]').forEach(span=>{const count=folders.find(f=>f.id===span.dataset.folderUnread).unreadMessages;span.textContent=count ? ` (${count})` : '';});
    root.querySelector('#mail-search').value=state.query;
    const unreadCount=rows.filter(message=>message.unread).length;
    root.querySelector('#mail-list-label').textContent=`${state.query.trim() ? 'Search results / all folders' : folders.find(f=>f.id===state.folderId).label} — ${rows.length} message${rows.length===1?'':'s'} (${unreadCount} unread)`;
    const signature=JSON.stringify(rows.map(m=>[m.id,m.unread]));
    if (signature!==rowSignature) {
      root.querySelector('tbody').innerHTML=rows.map(message=>`<tr data-mail-row="${h(message.id)}" data-thread-id="${h(message.threadId)}" aria-selected="false" tabindex="-1" class="${message.unread ? 'mail-unread' : ''}"><td aria-label="${message.unread ? 'Unread' : 'Read'}">${envelope(message.unread)}</td><td title="${h(message.from.name)} &lt;${h(message.from.address)}&gt;">${h(message.from.name)}</td><td title="${h(message.subject)}">${h(message.subject)}</td><td><time datetime="${h(message.sentAt)}" title="Provisional demo timestamp">${h(mailDate(message.sentAt))}</time></td></tr>`).join('');
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
    root.querySelector('[data-mail-command="close-messages"]').disabled=![...messageWindows.values()].some(node=>node.classList.contains('visible'));
    root.querySelector('#mail-count').textContent=`${rows.length} message${rows.length===1?'':'s'} (${unreadCount} unread)`;
    root.querySelector('#mail-warning').textContent=model.getWarning() || 'Dates provisional';
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
    const command=button.dataset.mailCommand, id=model.getState().selectedMessageId;
    root.querySelectorAll('.mail-menu[open]').forEach(menu=>menu.open=false);
    if(command==='open'){event.stopPropagation();openMessage(id);}
    if(command==='find')root.querySelector('#mail-search').focus();
    if(command==='read'||command==='unread')model.setMessageRead(id,command==='read');
    if(command==='close-mail'){event.stopPropagation();window.closeWindow('emails');}
    if(command==='close-messages')closeMessages();
    if(command==='previous'||command==='next'){const rows=currentRows(), index=rows.findIndex(m=>m.id===id);selectRow(rows[Math.max(0,Math.min(rows.length-1,index+(command==='next'?1:-1)))]?.id);}
  });
  root.addEventListener('dblclick',event=>{const row=event.target.closest('[data-mail-row]');if(row){event.stopPropagation();openMessage(row.dataset.mailRow);}});
  root.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){event.preventDefault();root.querySelector('#mail-search').focus();return;}
    if(event.key==='Escape'){root.querySelectorAll('.mail-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus();});return;}
    const row=event.target.closest('[data-mail-row]');
    if(row && event.key==='Enter'){event.preventDefault();event.stopPropagation();openMessage(row.dataset.mailRow);return;}
    if(row && ['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const rows=currentRows(),index=rows.findIndex(m=>m.id===row.dataset.mailRow);const next=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowDown'?1:-1)));selectRow(rows[next]?.id);}
    const folder=event.target.closest('.mail-folders [data-mail-folder]');
    if(folder && ['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const buttons=[...root.querySelectorAll('.mail-folders [data-mail-folder]')], index=buttons.indexOf(folder),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowDown'?1:-1)));buttons[next].click();buttons[next].focus();}
  });
  document.addEventListener('pointerdown',event=>{if(!root.querySelector('.mail-menubar').contains(event.target))root.querySelectorAll('.mail-menu[open]').forEach(menu=>menu.open=false);});
  window.addEventListener('hilfer:window-activated',({detail})=>{const node=[...messageWindows.values()].find(node=>node.id===detail.windowId+'-window');if(node && model.getMessage(node.dataset.messageId))model.setMessageRead(node.dataset.messageId,true);});
  window.addEventListener('hilfer:window-closed',({detail})=>{if([...messageWindows.values()].some(node=>node.id===detail.windowId+'-window')){render();if(root.closest('.window').classList.contains('active'))selectRow(model.getState().selectedMessageId);}});
  model.subscribe(render);
  store.onEvent(({type})=>{if(type==='hilfer:progress-reset'){closeMessages();model.reset();}});
  render();return model;
}
