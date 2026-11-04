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
const sourceMessage=id=>{const thread=corpus.threads.find(t=>t.messages.some(m=>m.id===id));return {...thread.messages.find(m=>m.id===id),subject:thread.messages.find(m=>m.id===id).subject??thread.subject};};
const messageWindow=(page,id)=>page.locator('#mail-message-'+id+'-window');
const choose=async(page,id)=>{await open(page,'emails');await page.locator('[data-mail-row="'+id+'"]').click();};
const show=async(page,id,keyboard=false)=>{await open(page,'emails');const row=page.locator('[data-mail-row="'+id+'"]');if(keyboard){await row.focus();await page.keyboard.press('Enter');}else await row.dblclick();return messageWindow(page,id);};
const verifyMessage=async(page,id)=>{
  const message=sourceMessage(id), node=messageWindow(page,id);
  assert.ok(await node.isVisible());assert.equal(await node.locator('.window-title').textContent(),message.subject);
  assert.equal(await node.locator('.mail-body').textContent(),message.body);
  assert.equal(await node.locator('time').getAttribute('datetime'),message.sentAt);
  for(const person of [message.from,...message.to,...message.cc])assert.ok((await node.textContent()).includes(person.address));
  assert.ok((await node.locator('.mail-message-fields').textContent()).includes('Cc:'));
  assert.ok((await node.locator('.mail-message-fields').textContent()).includes(message.subject));
};
const closeMessage=async(page,id)=>{const node=messageWindow(page,id);await page.locator('.taskbar-item[data-window="mail-message-'+id+'"]').click();if(!(await node.evaluate(el=>el.classList.contains('visible'))))await page.locator('.taskbar-item[data-window="mail-message-'+id+'"]').click();await node.locator('[data-control="close"]').click();};
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});watch(page);await page.goto(target);await ready(page);
 const initial=await page.evaluate(()=>hilfer.getState());await open(page,'emails');
 assert.equal(await page.locator('[data-mail-row]').count(),7);assert.equal(await page.locator('#mail-count').textContent(),'7 messages (7 unread)');
 assert.equal(await page.locator('#emails-app .mail-body').count(),0,'no integrated preview');
 await page.screenshot({path:join(tmpdir(),'hilfer-mail-classic-inbox.png')});
 assert.deepEqual(await page.locator('.mail-table thead th').allTextContents(),['','From','Subject','Received']);
 for(const label of ['Compose','Reply','Reply All','Forward','Move','Delete'])assert.ok(await page.getByRole('toolbar',{name:'Mail tools'}).getByRole('button',{name:label,exact:true}).isDisabled());
 assert.ok(await page.locator('.mail-menubar > button').filter({hasText:'Help'}).isDisabled());
 await page.locator('[data-mail-row="MAIL-004"]').click();assert.equal(await page.locator('.mail-message-window').count(),0);
 assert.equal(await page.locator('#mail-count').textContent(),'7 messages (7 unread)');
 await page.locator('[data-mail-row="MAIL-004"]').dblclick();await verifyMessage(page,'MAIL-004');
 assert.equal(await page.locator('#mail-count').textContent(),'7 messages (6 unread)');
 assert.ok(await page.locator('[data-mail-row="MAIL-005"]').evaluate(el=>el.classList.contains('mail-unread')),'opening one reply does not read its conversation');
 assert.equal(await page.locator('.taskbar-item[data-window="mail-message-MAIL-004"]').textContent(),sourceMessage('MAIL-004').subject);
 await messageWindow(page,'MAIL-004').locator('[data-control="minimize"]').click();assert.ok(await messageWindow(page,'MAIL-004').isHidden());
 await page.locator('.taskbar-item[data-window="mail-message-MAIL-004"]').click();
 await messageWindow(page,'MAIL-004').locator('[data-control="maximize"]').click();assert.equal((await messageWindow(page,'MAIL-004').boundingBox()).width,1440);
 await messageWindow(page,'MAIL-004').locator('[data-control="maximize"]').click();assert.equal((await messageWindow(page,'MAIL-004').boundingBox()).width,620);
 await show(page,'MAIL-004');assert.equal(await page.locator('#mail-message-MAIL-004-window').count(),1,'reopening reuses the same OS window');
 await show(page,'MAIL-005',true);await verifyMessage(page,'MAIL-005');
 assert.equal(await page.locator('.mail-message-window.visible').count(),2);
 // Put two real OS windows side by side through their native title bars.
 for(const [id,x] of [['MAIL-004',35],['MAIL-005',740]]){
  await page.locator('.taskbar-item[data-window="mail-message-'+id+'"]').click();
  if(!(await messageWindow(page,id).isVisible()))await page.locator('.taskbar-item[data-window="mail-message-'+id+'"]').click();
  const box=await messageWindow(page,id).locator('.window-title').boundingBox();
  await page.mouse.move(box.x+80,box.y+7);await page.mouse.down();await page.mouse.move(x+80,137,{steps:10});await page.mouse.up();
 }
 assert.ok((await messageWindow(page,'MAIL-005').boundingBox()).x>(await messageWindow(page,'MAIL-004').boundingBox()).x+600);
 await page.screenshot({path:join(tmpdir(),'hilfer-mail-classic-two-messages.png')});
 await page.locator('.taskbar-item[data-window="mail-message-MAIL-004"]').click();
 const beforeResize=await messageWindow(page,'MAIL-004').boundingBox();
 await page.mouse.move(beforeResize.x+beforeResize.width-6,beforeResize.y+beforeResize.height-6);await page.mouse.down();await page.mouse.move(beforeResize.x+beforeResize.width-66,beforeResize.y+beforeResize.height-196,{steps:10});await page.mouse.up();
 assert.ok((await messageWindow(page,'MAIL-004').boundingBox()).width<beforeResize.width,'message windows use native OS resize');
 await messageWindow(page,'MAIL-004').locator('.mail-message-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 assert.ok(await messageWindow(page,'MAIL-004').locator('.mail-message-scroll').evaluate(el=>el.scrollTop>0),'message body scrolls independently in a short window');
 assert.ok(await messageWindow(page,'MAIL-004').locator('.mail-body').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=14));
 await open(page,'emails');await page.getByRole('button',{name:'Close HILFER Mail',exact:true}).click();
 assert.ok(await messageWindow(page,'MAIL-004').isVisible());assert.ok(await messageWindow(page,'MAIL-005').isVisible());
 await closeMessage(page,'MAIL-005');assert.ok(await messageWindow(page,'MAIL-004').isVisible());await closeMessage(page,'MAIL-004');
 await open(page,'emails');assert.ok(await page.locator('#emails-window').isVisible());
 await page.locator('.mail-menu summary').filter({hasText:'File'}).click();assert.ok(await page.locator('.mail-menu[open]').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('.mail-menu[open]').count(),0);
 await page.locator('[data-mail-row]').first().focus();await page.keyboard.press('End');
 assert.equal(await page.locator('tr[aria-selected="true"]').getAttribute('data-mail-row'),'MAIL-001');
 await page.keyboard.press('Enter');await verifyMessage(page,'MAIL-001');await page.keyboard.press('Escape');assert.ok(await messageWindow(page,'MAIL-001').isHidden());
 // Every authored message remains individually reachable, byte-exact in the reader.
 for(const id of ['MAIL-001','MAIL-002','MAIL-003','MAIL-006','MAIL-007']){await show(page,id);await verifyMessage(page,id);await closeMessage(page,id);}
 await open(page,'emails');await page.locator('.mail-folders [data-mail-folder="archive"]').click();assert.equal(await page.locator('[data-mail-row]').count(),5);
 for(const id of ['MAIL-008','MAIL-009','MAIL-010','MAIL-011','MAIL-012']){await show(page,id);await verifyMessage(page,id);await closeMessage(page,id);}
 await open(page,'emails');await page.locator('.mail-folders [data-mail-folder="sent"]').click();assert.equal(await page.locator('[data-mail-row]').count(),0);assert.equal(await page.locator('#mail-count').textContent(),'0 messages (0 unread)');
 for(const query of ['human-resources@hilfer.internal','spreadsheet','Duty-period roster','HR-014']){await page.locator('#mail-search').fill(query);assert.equal(await page.locator('[data-mail-row="MAIL-004"]').count(),1);}
 assert.equal(await page.locator('[data-mail-row]').count(),1,'record search returns the matching message');
 await page.locator('#mail-search').focus();await page.keyboard.press('Control+f');assert.ok(await page.locator('#mail-search').evaluate(el=>el===document.activeElement));
 assert.deepEqual(await page.evaluate(()=>hilfer.getState()),initial,'selection and reading do not affect gameplay');
 await page.screenshot({path:join(tmpdir(),'hilfer-mail-classic-table.png')});
 await page.locator('[data-mail-row="MAIL-004"]').dblclick();await messageWindow(page,'MAIL-004').locator('[data-mail-reference="HR-014"]').click();
 assert.ok(await page.locator('#records-window').evaluate(el=>el.classList.contains('active')));assert.match(await page.locator('#preview-reference').textContent(),/Jessica — Personnel File/);
 assert.deepEqual(await page.evaluate(()=>hilfer.getState().discoveredEvidenceIds),['HR-014']);assert.deepEqual(await page.evaluate(()=>hilfer.getState().completedCaseIds),[]);
 await page.locator('[data-file-id="OH-008"]').click();await page.locator('.claim-source').click();await page.locator('.claim-apply').click();assert.ok(await page.locator('#assistant-notification').isVisible());
 await open(page,'emails');await page.locator('#mail-clear-search').click();await choose(page,'MAIL-001');await page.locator('.mail-toolbar [data-mail-command="unread"]').click();
 assert.equal(await page.locator('#mail-count').textContent(),'7 messages (1 unread)');
 await page.reload();await ready(page);await open(page,'emails');assert.equal(await page.locator('#mail-count').textContent(),'7 messages (1 unread)');assert.equal(await page.locator('.mail-message-window').count(),0);
 assert.equal(await page.evaluate(()=>hilfer.getState().resolutions['CASE-001'].sourceId),'OH-008');
 await page.getByRole('button',{name:'Minimize HILFER Mail',exact:true}).click();await page.locator('.taskbar-item[data-window="emails"]').click();assert.ok(await page.locator('#emails-window').isVisible());
 await page.getByRole('button',{name:'Maximize HILFER Mail',exact:true}).click();assert.equal((await page.locator('#emails-window').boundingBox()).width,1440);await page.getByRole('button',{name:'Maximize HILFER Mail',exact:true}).click();
 await show(page,'MAIL-001');await show(page,'MAIL-002');
 await page.locator('.start-button').click();await page.locator('#reset-progress').click();await open(page,'emails');
 assert.equal(await page.locator('.mail-message-window').count(),0);assert.equal(await page.locator('[data-window^="mail-message-"]').count(),0);assert.equal(await page.locator('#mail-count').textContent(),'7 messages (7 unread)');assert.equal(await page.locator('#mail-search').inputValue(),'');
 await page.evaluate(()=>localStorage.setItem('hilfer:mail-ui:v1','corrupt'));await page.reload();await ready(page);await open(page,'emails');assert.match(await page.locator('#mail-warning').innerText(),/fresh read receipts/);
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const small=await mobile.newPage();watch(small);await small.goto(target);await ready(small);await open(small,'emails');
 await small.screenshot({path:join(tmpdir(),'hilfer-mail-classic-mobile-table.png')});
 await small.locator('.mail-folders [data-mail-folder="archive"]').click();await small.locator('[data-mail-row="MAIL-008"]').click();await small.locator('.mail-toolbar [data-mail-command="open"]').click();await verifyMessage(small,'MAIL-008');
 const phoneMessage=messageWindow(small,'MAIL-008');assert.ok(await phoneMessage.locator('.mail-message-content').evaluate(el=>el.scrollWidth<=el.clientWidth));
 const phoneBox=await phoneMessage.boundingBox();assert.ok(phoneBox.y>=0&&phoneBox.y+phoneBox.height<=844-31);
 await phoneMessage.locator('.mail-message-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});await small.screenshot({path:join(tmpdir(),'hilfer-mail-classic-mobile.png')});
 await phoneMessage.locator('[data-control="close"]').click();await open(small,'themes');await small.locator('#display-theme').selectOption('archive');await open(small,'emails');
 assert.ok((await small.locator('#emails-window .window-title').evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).includes('mail-graphite.webp'));await mobile.close();
 const restricted=structuredClone(corpus),secret=structuredClone(corpus.threads[0]);Object.assign(secret,{id:'TEST-RESTRICTED',subject:'Restricted fixture subject',access:{requiredGrants:['mail.desk.read','mail.test-restricted']}});secret.messages=[{...secret.messages[0],id:'TEST-SECRET-MESSAGE',body:'Restricted fixture body',from:{id:'test-sender',name:'Restricted fixture sender',address:'fixture@hilfer.internal'}}];restricted.threads.push(secret);
 const isolated=await browser.newPage();watch(isolated);await isolated.route('**/data/emails.json',route=>route.fulfill({json:restricted}));await isolated.goto(target);await ready(isolated);await open(isolated,'emails');assert.equal(await isolated.locator('[data-mail-row]').count(),7);
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
 await isolated.locator('#mail-permission-fixture [data-mail-row="TEST-SECRET-MESSAGE"]').dblclick();
 assert.ok(await messageWindow(isolated,'TEST-SECRET-MESSAGE').isVisible());
 await isolated.evaluate(()=>permissionMail.setGrants(['mail.desk.read','mail.archive.general']));
 assert.equal(await messageWindow(isolated,'TEST-SECRET-MESSAGE').count(),0);
 assert.equal(await isolated.locator('#mail-permission-fixture [data-mail-row="TEST-SECRET-MESSAGE"]').count(),0);
 const blocked=await browser.newPage();watch(blocked);await blocked.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='hilfer:mail-ui:v1')throw new Error('blocked');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key==='hilfer:mail-ui:v1')throw new Error('blocked');return set.call(this,key,value);};});await blocked.goto(target);await ready(blocked);await show(blocked,'MAIL-004');assert.equal(await blocked.locator('#mail-count').textContent(),'7 messages (6 unread)');assert.match(await blocked.locator('#mail-warning').textContent(),/could not be saved/);
 assert.deepEqual(errors,[]);console.log('PASS: classic table/tree/menus/disabled toolbar; single vs double click/Enter; twelve exact messages; independent movable windows/focus/close/reuse; message-level unread/reload/reset; authorization/search; keyboard/mobile/Graphite; HR-014 -> Records -> Jessica -> Assistant; no missing assets or JS errors.');
}finally{await browser.close();}
