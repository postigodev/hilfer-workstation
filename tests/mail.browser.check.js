import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const corpus = JSON.parse(readFileSync(new URL('../data/emails.json',import.meta.url),'utf8'));
const moduleName = process.env.HILFER_PLAYWRIGHT_MODULE;
const {chromium} = await import(moduleName ? pathToFileURL(moduleName).href : 'playwright');
const browser = await chromium.launch({channel:'msedge',headless:true});
const target = process.env.HILFER_URL || 'http://127.0.0.1:8080';
const errors = [];
const watch = page => {
  page.on('pageerror', e=>errors.push(e.message));
  page.on('response', r=>{if(r.status()>=400) errors.push(r.status()+' '+r.url());});
};
const ready = async page => page.waitForFunction(()=>window.hilfer);
const open = async (page,id) => {
  if (!(await page.locator('#start-menu').isVisible())) await page.locator('.start-button').click();
  await page.locator('.start-menu-item[data-open="'+id+'"]').click();
};
const reader = (page, id) => page.locator('#mail-message-' + id + '-window');
const row = (page, id) => page.locator('[data-mail-row="' + id + '"]');
const openThread = async (page, id) => {
  await open(page, 'emails');
  await row(page, id).dblclick();
  return reader(page, id);
};
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 watch(page);
 await page.goto(target);
 await ready(page);
 const initial = await page.evaluate(() => hilfer.getState());
 await open(page, 'emails');
 assert.equal(await page.locator('[data-mail-row]').count(), 3);
 assert.equal(await page.locator('#mail-count').textContent(), '3 conversations (3 unread)');
 assert.equal(await page.locator('#progress, #integrity').count(), 0);
 assert.ok(await page.locator('.mail-toolbar button:visible').evaluateAll(buttons =>
   buttons.every(button => {
     const label = button.querySelector('span').getBoundingClientRect();
     const control = button.getBoundingClientRect();
     return label.bottom <= control.bottom - 4 && label.right <= control.right - 4;
   })));
 const roster = corpus.threads.find(thread => thread.id === 'THREAD-ROSTER');
 const rosterRow = row(page, roster.id);
 assert.match(await rosterRow.textContent(), /Human Resources, Operations Scheduling/);
 assert.ok((await rosterRow.textContent()).includes(roster.messages.at(-1).body.split('\n')[0]));
 await page.screenshot({path:join(tmpdir(),'hilfer-mail-conversations-list.png')});
 await rosterRow.click();
 assert.equal(await page.locator('.mail-message-window').count(), 0);
 assert.equal(await page.locator('#mail-count').textContent(), '3 conversations (3 unread)');
 await rosterRow.click();
 await page.locator('[data-mail-command="delete"]').click();
 assert.equal(await rosterRow.count(), 0);
 await page.locator('.mail-folders [data-mail-folder="deleted"]').click();
 assert.match(await page.locator('.mail-folders [data-mail-folder="deleted"] .mail-folder-symbol').evaluate(el => getComputedStyle(el).backgroundImage), /deleted-full\.png/);
 await page.reload();
 await ready(page);
 await open(page, 'emails');
 assert.ok(await rosterRow.isVisible());
 await rosterRow.click();
 await page.locator('[data-mail-command="restore"]').click();
 assert.match(await page.locator('.mail-folders [data-mail-folder="deleted"] .mail-folder-symbol').evaluate(el => getComputedStyle(el).backgroundImage), /deleted\.png/);
 assert.equal(await rosterRow.count(), 0);
 await page.locator('.mail-folders [data-mail-folder="inbox"]').click();
 assert.ok(await rosterRow.isVisible());
 await rosterRow.click();
 await page.keyboard.press('Enter');
 const rosterWindow = reader(page, roster.id);
 assert.ok(await rosterWindow.isVisible());
 assert.equal(await rosterWindow.locator('.window-title').textContent(), roster.subject);
 assert.deepEqual(await rosterWindow.locator('details[open]').evaluateAll(nodes => nodes.map(node => node.dataset.messageId)), ['MAIL-005']);
 assert.equal(await page.locator('#mail-count').textContent(), '3 conversations (2 unread)');
 const receipts = () => page.evaluate(() => JSON.parse(localStorage.getItem('hilfer:mail-ui:v1')).readMessageIds);
 assert.deepEqual((await receipts()).sort(), ['MAIL-004', 'MAIL-005']);
 await rosterWindow.locator('[data-message-id="MAIL-004"] > summary').focus();
 await page.keyboard.press('Enter');
 assert.ok(await rosterWindow.locator('[data-message-id="MAIL-004"] .mail-body').isVisible());
 await page.screenshot({path:join(tmpdir(),'hilfer-mail-conversations-reader.png')});
 const second = await openThread(page, 'THREAD-MEDICAL-ROUTING');
 assert.ok(await second.isVisible());
 assert.ok(await rosterWindow.isVisible());
 await second.locator('[data-control="minimize"]').click();
 assert.ok(await second.isHidden());
 await page.locator('[data-window="mail-message-THREAD-MEDICAL-ROUTING"]').click();
 assert.ok(await second.isVisible());
 await second.locator('[data-control="close"]').click();
 assert.ok(await rosterWindow.isVisible());
 await openThread(page, roster.id);
 assert.equal(await rosterWindow.count(), 1);
 await open(page, 'emails');
 await page.locator('.mail-folders [data-mail-folder="sent"]').click();
 assert.equal(await page.locator('[data-mail-row]').count(), 0);
 await page.locator('.mail-folders [data-mail-folder="archive"]').click();
 assert.equal(await page.locator('[data-mail-row]').count(), 2);
 // v3 contains restricted conversations. They must remain invisible and unopened
 // before Jessica grants investigation.read.
 const initiallyAuthorized = corpus.threads.filter(thread =>
   thread.access.requiredGrants.every(grant => corpus.initialGrants.includes(grant)));
 assert.equal(initiallyAuthorized.length, 5);
 for (const id of ['THREAD-TEST-VIABILITY','THREAD-LEGAL-SCOPE','THREAD-SPACCO-REC03'])
   assert.equal(await row(page,id).count(), 0, id + ' leaked before authorization');
 await page.locator('#mail-search').fill("Tomorrow's run");
 assert.equal(await page.locator('[data-mail-row]').count(), 0, 'Restricted Mail search exposed its subject');
 await page.locator('#mail-search').fill('');
 const denied = await page.evaluate(async () => {
   const {createMailModel} = await import('/js/apps/emails.js');
   const model = createMailModel(await (await fetch('/data/emails.json')).json());
   return model.openThread('THREAD-TEST-VIABILITY').ok;
 });
 assert.equal(denied, false, 'Direct Mail lookup should also be denied');
 for (const thread of initiallyAuthorized) {
   await page.locator('.mail-folders [data-mail-folder="' + thread.folderId + '"]').click();
   const node = await openThread(page, thread.id);
   assert.deepEqual(await node.locator('.mail-body').allTextContents(), thread.messages.map(message => message.body));
   for (const sender of ['jessica', 'tito']) {
     if (!thread.messages.some(message => message.from.id === sender)) continue;
     const portrait = node.locator('img.mail-avatar[src$="' + sender + '-mail.webp"]').first();
     assert.equal(await portrait.evaluate(async img => { await img.decode(); return img.naturalWidth; }), 96);
   }
   await node.locator('[data-control="close"]').click();
 }
 await page.locator('#mail-search').fill('HR-014');
 assert.equal(await page.locator('[data-mail-row]').count(), 1);
 await openThread(page, roster.id);
 assert.ok(await rosterWindow.locator('[data-message-id="MAIL-004"][open]').isVisible());
 assert.deepEqual(await page.evaluate(() => hilfer.getState()), initial);
 await rosterWindow.locator('[data-mail-reference="HR-014"]').click();
 assert.equal(await page.locator('img[alt="Portrait of Jessica"]').evaluate(async img => {
   await img.decode();
   return img.naturalWidth;
 }), 280);
 assert.ok(await page.locator('#records-window.active').isVisible());
 assert.deepEqual(await page.evaluate(() => hilfer.getState().discoveredEvidenceIds), ['HR-014']);
 await page.locator('[data-file-id="OH-008"]').click();
 await page.locator('.claim-source').click();
 await page.locator('.claim-apply').click();
 assert.ok(await page.locator('#assistant-notification').isVisible());
 await open(page, 'emails');
 await page.locator('.mail-folders [data-mail-folder="archive"]').click();
 // Jessica's filed case unlocks P1 Mail, but not the later Recovery 03 thread.
 for (const id of ['THREAD-TEST-VIABILITY','THREAD-LEGAL-SCOPE']) {
   const thread = corpus.threads.find(item => item.id === id);
   assert.ok(await row(page,id).isVisible(), id + ' did not unlock after authorization');
   const node = await openThread(page,id);
   assert.deepEqual(await node.locator('.mail-body').allTextContents(),
     thread.messages.map(message => message.body));
   await node.locator('[data-control="close"]').click();
 }
 assert.equal(await row(page,'THREAD-SPACCO-REC03').count(),0,
   'Recovery 03 correspondence must stay locked until real footage');
 await page.locator('.mail-folders [data-mail-folder="inbox"]').click();
 await rosterRow.click();
 await page.locator('.mail-toolbar [data-mail-command="unread"]').click();
 await page.reload();
 await ready(page);
 await open(page, 'emails');
 assert.equal(await page.locator('#mail-count').textContent(), '3 conversations (1 unread)');
 assert.ok(!(await receipts()).some(id => ['MAIL-004', 'MAIL-005'].includes(id)));
 assert.equal(await page.evaluate(() => hilfer.getState().resolutions['CASE-001'].sourceId), 'OH-008');
 await openThread(page, roster.id);
 await page.locator('.start-button').click();
 await page.locator('#reset-progress').click();
 await open(page, 'emails');
 assert.equal(await page.locator('.mail-message-window').count(), 0);
 assert.equal(await page.locator('#mail-count').textContent(), '3 conversations (3 unread)');

 const small = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 watch(small);
 await small.goto(target);
 await ready(small);
 await open(small, 'emails');
 await row(small, roster.id).click();
 await small.locator('.mail-toolbar [data-mail-command="open"]').click();
 const content = reader(small, roster.id).locator('.mail-thread-content');
 assert.ok(await content.isVisible());
 assert.ok(await content.evaluate(el => el.scrollWidth <= el.clientWidth));
 await small.screenshot({path:join(tmpdir(),'hilfer-mail-conversations-mobile.png')});
 await small.close();

 const restricted=structuredClone(corpus),secret=structuredClone(corpus.threads[0]);Object.assign(secret,{id:'TEST-RESTRICTED',subject:'Restricted fixture subject',access:{requiredGrants:['mail.desk.read','mail.test-restricted']}});secret.messages=[{...secret.messages[0],id:'TEST-SECRET-MESSAGE',body:'Restricted fixture body',from:{id:'test-sender',name:'Restricted fixture sender',address:'fixture@hilfer.internal'}}];restricted.threads.push(secret);
 const isolated=await browser.newPage();watch(isolated);await isolated.route('**/data/emails.json',route=>route.fulfill({json:restricted}));
 await isolated.route('**/data/progression.json',async route=>{
  const response=await route.fetch(),definition=await response.json();definition.grants.push('mail.test-restricted');
  definition.contentCatalog.push({id:'mail:TEST-RESTRICTED',kind:'artifact',app:'mail',artifactId:'TEST-RESTRICTED',artifactType:'thread',requiredGrantIds:[]},{id:'mail:TEST-SECRET-MESSAGE',kind:'artifact',app:'mail',artifactId:'TEST-SECRET-MESSAGE',artifactType:'message',requiredGrantIds:[]});
  await route.fulfill({json:definition});
 });
 await isolated.goto(target);await ready(isolated);await open(isolated,'emails');assert.equal(await isolated.locator('[data-mail-row]').count(),3);
 assert.doesNotMatch(await isolated.locator('#emails-app').textContent(),/TEST-RESTRICTED|Restricted fixture/);
 for(const query of ['Restricted fixture subject','Restricted fixture body','fixture@hilfer.internal']){await isolated.locator('#mail-search').fill(query);assert.equal(await isolated.locator('[data-mail-row]').count(),0);}
 const access=await isolated.evaluate(async()=>{const {createMailModel}=await import('/js/apps/emails.js');const model=createMailModel(await(await fetch('/data/emails.json')).json());return {thread:model.openThread('TEST-RESTRICTED').ok,message:model.openMessage('TEST-SECRET-MESSAGE').ok,lookup:model.getMessage('TEST-SECRET-MESSAGE'),unread:model.getFolders()[0].unreadMessages};});assert.deepEqual(access,{thread:false,message:false,lookup:null,unread:7});
 // Grant revocation must remove an already-open reader, not just hide its table row.
 await isolated.evaluate(async()=>{
  const {mountMail}=await import('/js/apps/emails.js');const data=await(await fetch('/data/emails.json')).json();data.initialGrants.push('mail.test-restricted');
  const container=document.createElement('section');container.id='mail-permission-fixture-window';container.className='window';Object.assign(container.style,{left:'120px',top:'60px',width:'780px',height:'570px'});
  container.innerHTML='<div class="window-header"><span class="window-title">Permission test fixture</span></div><div id="mail-permission-fixture" class="window-content"></div>';document.querySelector('#desktop').append(container);
  window.permissionMail=mountMail(container.querySelector('.window-content'),data,{store:hilfer,openRecord:()=>{}});window.openWindow('mail-permission-fixture');
 });
 await isolated.locator('#mail-permission-fixture [data-mail-row="TEST-RESTRICTED"]').dblclick();
 assert.ok(await reader(isolated,'TEST-RESTRICTED').isVisible());
 await isolated.evaluate(()=>permissionMail.setGrants(['mail.desk.read','mail.archive.general']));
 assert.equal(await reader(isolated,'TEST-RESTRICTED').count(),0);
 assert.equal(await isolated.locator('#mail-permission-fixture [data-mail-row="TEST-RESTRICTED"]').count(),0);
 const blocked=await browser.newPage();watch(blocked);await blocked.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='hilfer:mail-ui:v1')throw new Error('blocked');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key==='hilfer:mail-ui:v1')throw new Error('blocked');return set.call(this,key,value);};});await blocked.goto(target);await ready(blocked);await openThread(blocked,'THREAD-ROSTER');assert.equal(await blocked.locator('#mail-count').textContent(),'3 conversations (2 unread)');assert.match(await blocked.locator('#mail-warning').textContent(),/could not be saved/);
 assert.deepEqual(errors,[]);console.log('PASS: conversation list, readers, receipts, search, Records and Jessica, mobile, authorization, and storage fallback.');
}finally{await browser.close();}
