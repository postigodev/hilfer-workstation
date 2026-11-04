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
const verifyThread = async (page,id) => {
  const thread = corpus.threads.find(t=>t.id===id);
  assert.equal(await page.locator('.mail-message').count(),thread.messages.length);
  for (const message of thread.messages) {
    const article=page.locator('[data-message-id="'+message.id+'"]');
    assert.equal(await article.locator('.mail-body').textContent(),message.body);
    assert.equal(await article.locator('time').getAttribute('datetime'),message.sentAt);
    for (const person of [message.from,...message.to,...message.cc]) assert.ok((await article.textContent()).includes(person.address));
    assert.ok((await article.textContent()).includes(message.subject??thread.subject));
  }
};
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});watch(page);
  await page.goto(target);await ready(page); const initial=await page.evaluate(()=>hilfer.getState());
  await open(page,'emails');
  assert.equal(await page.locator('[data-mail-thread]').count(),3);
  assert.equal(await page.locator('#mail-count').textContent(),'3 conversations · 7 messages');
  assert.match(await page.locator('.mail-account').textContent(),/Reconciliation Desk/);
  await page.locator('[data-mail-thread]').first().focus(); await page.keyboard.press('End');
  await verifyThread(page,'THREAD-DESK-HANDOFF');
  await page.keyboard.press('F6'); assert.ok(await page.locator('.mail-reader').evaluate(el=>el===document.activeElement));
  await page.keyboard.press('F6'); assert.ok(await page.locator('[data-mail-thread="THREAD-DESK-HANDOFF"]').evaluate(el=>el===document.activeElement));
  await page.locator('#mail-mark-unread').click();
  assert.match(await page.locator('[data-mail-folder="inbox"]').getAttribute('aria-label'),/3 unread/);
  await page.locator('[data-mail-thread="THREAD-MEDICAL-ROUTING"]').click(); await verifyThread(page,'THREAD-MEDICAL-ROUTING');
  await page.locator('[data-mail-folder="archive"]').click();
  assert.equal(await page.locator('[data-mail-thread]').count(),2);
  for (const id of ['THREAD-JESSICA-SHIFT','THREAD-TITO-RELAY']) { await page.locator('[data-mail-thread="'+id+'"]').click(); await verifyThread(page,id); }
  await page.screenshot({path:join(tmpdir(),'hilfer-mail-archive.png')});
  await page.locator('[data-mail-folder="sent"]').click();
  assert.equal(await page.locator('[data-mail-thread]').count(),0); assert.match(await page.locator('.mail-thread-list').innerText(),/No conversations/);
  assert.equal(await page.getByRole('button',{name:/Compose|Send message/}).count(),0);
  for (const query of ['human-resources@hilfer.internal','spreadsheet','Duty-period roster','HR-014']) {
    await page.locator('#mail-search').fill(query); assert.equal(await page.locator('[data-mail-thread="THREAD-ROSTER"]').count(),1);
  }
  await page.locator('[data-mail-thread="THREAD-ROSTER"]').click(); await verifyThread(page,'THREAD-ROSTER');
  assert.equal(await page.locator('[data-mail-reference]').count(),1);
  assert.deepEqual(await page.evaluate(()=>hilfer.getState()),initial,'all mail reading leaves game state untouched');
  await page.screenshot({path:join(tmpdir(),'hilfer-mail-roster.png')});
  await page.locator('[data-mail-reference="HR-014"]').click();
  assert.ok(await page.locator('#records-window').evaluate(el=>el.classList.contains('active')));
  assert.match(await page.locator('#preview-reference').textContent(),/Jessica — Personnel File/);
  assert.deepEqual(await page.evaluate(()=>hilfer.getState().completedCaseIds),[]);
  assert.deepEqual(await page.evaluate(()=>hilfer.getState().discoveredEvidenceIds),['HR-014']);
  await page.locator('[data-file-id="OH-008"]').click();await page.locator('.claim-source').click();await page.locator('.claim-apply').click();
  assert.ok(await page.locator('#assistant-notification').isVisible());
  assert.equal(await page.evaluate(()=>hilfer.getState().distortionLevel),1);
  await page.reload();await ready(page);await open(page,'emails');
  assert.match(await page.locator('[data-mail-folder="inbox"]').getAttribute('aria-label'),/1 unread/);
  assert.match(await page.locator('[data-mail-folder="archive"]').getAttribute('aria-label'),/0 unread/);
  await verifyThread(page,'THREAD-ROSTER');
  assert.equal(await page.evaluate(()=>hilfer.getState().resolutions['CASE-001'].sourceId),'OH-008');
  await page.getByRole('button',{name:'Minimize HILFER Mail',exact:true}).click();
  await page.locator('.taskbar-item[data-window="emails"]').click(); assert.ok(await page.locator('#emails-window').isVisible());
  await page.getByRole('button',{name:'Maximize HILFER Mail',exact:true}).click(); assert.equal((await page.locator('#emails-window').boundingBox()).width,1440);
  await page.getByRole('button',{name:'Maximize HILFER Mail',exact:true}).click();
  await page.locator('.start-button').click();await page.locator('#reset-progress').click();await open(page,'emails');
  assert.match(await page.locator('[data-mail-folder="inbox"]').getAttribute('aria-label'),/3 unread/);
  assert.match(await page.locator('[data-mail-folder="archive"]').getAttribute('aria-label'),/2 unread/);
  assert.equal(await page.locator('.mail-message').count(),0); assert.equal(await page.locator('#mail-search').inputValue(),'');
  await page.evaluate(()=>localStorage.setItem('hilfer:mail-ui:v1','corrupt'));await page.reload();await ready(page);await open(page,'emails');
  assert.equal(await page.locator('[data-mail-thread]').count(),3);assert.match(await page.locator('#mail-warning').innerText(),/fresh read receipts/);

  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const small=await mobile.newPage();watch(small);await small.goto(target);await ready(small);await open(small,'emails');
  await small.locator('[data-mail-folder="archive"]').click();await small.locator('[data-mail-thread="THREAD-JESSICA-SHIFT"]').click();
  await verifyThread(small,'THREAD-JESSICA-SHIFT');assert.ok(await small.locator('#emails-app').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await small.locator('.mail-reader').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  assert.ok(await small.locator('.mail-reader').evaluate(el=>el.scrollTop>0));
  await small.screenshot({path:join(tmpdir(),'hilfer-mail-mobile.png')});
  await open(small,'themes');await small.locator('#display-theme').selectOption('archive');await open(small,'emails');
  assert.ok((await small.locator('#emails-window .window-title').evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).includes('mail-graphite.webp'));
  await mobile.close();

  const restricted=structuredClone(corpus), secret=structuredClone(corpus.threads[0]);
  Object.assign(secret,{id:'TEST-RESTRICTED',subject:'Restricted fixture subject',access:{requiredGrants:['mail.desk.read','mail.test-restricted']}});
  secret.messages=[{...secret.messages[0],id:'TEST-SECRET-MESSAGE',body:'Restricted fixture body',from:{id:'test-sender',name:'Restricted fixture sender',address:'fixture@hilfer.internal'}}];
  restricted.threads.push(secret);
  const isolated=await browser.newPage();watch(isolated);
  await isolated.route('**/data/emails.json',route=>route.fulfill({json:restricted}));
  await isolated.goto(target);await ready(isolated);await open(isolated,'emails');
  assert.equal(await isolated.locator('[data-mail-thread]').count(),3);
  assert.doesNotMatch(await isolated.locator('#emails-app').textContent(),/TEST-RESTRICTED|Restricted fixture/);
  for (const query of ['Restricted fixture subject','Restricted fixture body','fixture@hilfer.internal']) {await isolated.locator('#mail-search').fill(query);assert.equal(await isolated.locator('[data-mail-thread]').count(),0);}
  const access=await isolated.evaluate(async()=>{
    const {createMailModel}=await import('/js/apps/emails.js');const model=createMailModel(await(await fetch('/data/emails.json')).json());
    return {thread:model.openThread('TEST-RESTRICTED').ok,message:model.openMessage('TEST-SECRET-MESSAGE').ok,lookup:model.getMessage('TEST-SECRET-MESSAGE'),unread:model.getFolders()[0].unread};
  }); assert.deepEqual(access,{thread:false,message:false,lookup:null,unread:3});
  const blocked=await browser.newPage();watch(blocked);
  await blocked.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='hilfer:mail-ui:v1')throw new Error('blocked');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key==='hilfer:mail-ui:v1')throw new Error('blocked');return set.call(this,key,value);};});
  await blocked.goto(target);await ready(blocked);await open(blocked,'emails');await blocked.locator('[data-mail-thread="THREAD-ROSTER"]').click();
  assert.match(await blocked.locator('[data-mail-folder="inbox"]').getAttribute('aria-label'),/2 unread/);
  assert.match(await blocked.locator('#mail-warning').textContent(),/could not be saved/);
  assert.deepEqual(errors,[]);
  console.log('PASS: all five conversations/twelve exact message bodies, metadata, folders/search, authorization fixture/direct access/counts, read/unread/reload/reset, blocked/corrupt storage, keyboard/mobile, HR-014 -> Records -> Jessica -> Assistant, Mail controls and Graphite; no missing assets or JS errors.');
} finally {await browser.close();}
