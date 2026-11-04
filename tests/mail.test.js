import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createMailModel, validateMailCorpus, renderMailThread, MAIL_UI_KEY } from '../js/apps/emails.js';
import { createStore } from '../js/core/store.js';
const bytes = readFileSync(new URL('../data/emails.json', import.meta.url));
const corpus = JSON.parse(bytes);
const read = name => JSON.parse(readFileSync(new URL('../data/' + name + '.json', import.meta.url), 'utf8'));
const records = read('records');
const memory = () => { const data = new Map(); return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}; };
const fixture = () => {
  const data = structuredClone(corpus);
  const secret = structuredClone(data.threads[0]);
  Object.assign(secret, {id:'SEALED-THREAD',subject:'Hidden subject',access:{requiredGrants:['mail.desk.read','mail.sealed']}});
  secret.messages = [{...secret.messages[0],id:'SEALED-MESSAGE',sentAt:'2088-03-01T04:05:06',from:{id:'SEALED-SENDER',name:'Hidden sender',address:'sealed@hilfer.internal'},body:'Sealed search needle',references:[{type:'record',id:'SEALED-RECORD',label:'Hidden record'}]}];
  data.threads.push(secret); return data;
};

test('fixed corpus matches every supplied value, five threads, twelve messages and valid record anchors', () => {
  // Pin all authored values/order while allowing Git's platform-specific file line endings.
  assert.equal(createHash('sha256').update(JSON.stringify(corpus)).digest('hex'), 'ad27be8a04e9b23fb9dec674fba888995d47c758dfada6fdc4c6fa5599351ba0');
  assert.deepEqual(validateMailCorpus(corpus, id=>records.find(r=>r.id===id)), {threads:5,messages:12});
  assert.deepEqual(corpus.threads.flatMap(t=>t.messages.map(m=>m.id)), Array.from({length:12},(_,i)=>'MAIL-'+String(i+1).padStart(3,'0')));
  for (const [id,date] of Object.entries(corpus.timelineConstraints.recordAnchors)) assert.equal(records.find(r=>r.id===id).date,date);
  assert.deepEqual(corpus.threads.flatMap(t=>t.messages.flatMap(m=>m.references.map(r=>r.id))), ['HR-014']);
});

test('folders and chronological ordering are real data projections; full text searches cross only authorized folders', () => {
  const model = createMailModel(corpus);
  assert.deepEqual(model.getFolders().map(f=>[f.id,f.count,f.unread]), [['inbox',3,3],['sent',0,0],['archive',2,2]]);
  assert.equal(model.listThreads()[0].id,'THREAD-MEDICAL-ROUTING');
  assert.deepEqual(model.getThread('THREAD-DESK-HANDOFF').messages.map(m=>m.id), ['MAIL-001','MAIL-002','MAIL-003']);
  model.setFolder('sent'); assert.deepEqual(model.listThreads(),[]);
  for (const query of ['HR-014','human-resources@hilfer.internal','Duty-period roster','spreadsheet']) {
    model.setQuery(query); assert.ok(model.listThreads().some(t=>t.id==='THREAD-ROSTER'));
  }
  model.setQuery('Tito'); assert.equal(model.listThreads()[0].folderId,'archive');
  model.setQuery('no matching phrase'); assert.deepEqual(model.listThreads(),[]);
  const changed = structuredClone(corpus); changed.threads[0].messages.reverse();
  assert.equal(createMailModel(changed).getThread('THREAD-DESK-HANDOFF').messages[0].id,'MAIL-001');
});

test('authorization precedes list, search, count, lookup, direct open, receipts and record references', () => {
  const storage = memory(); storage.setItem(MAIL_UI_KEY, JSON.stringify({version:1,readMessageIds:['SEALED-MESSAGE'],selectedThreadId:'SEALED-THREAD',folderId:'inbox'}));
  const model = createMailModel(fixture(),{storage});
  assert.deepEqual(model.getFolders().map(f=>f.count), [3,0,2]);
  assert.equal(model.getThread('SEALED-THREAD'),null); assert.equal(model.getMessage('SEALED-MESSAGE'),null);
  assert.equal(model.getReference('SEALED-MESSAGE','SEALED-RECORD'),null);
  assert.deepEqual(model.openThread('SEALED-THREAD'), model.openThread('UNKNOWN'));
  assert.equal(model.openMessage('SEALED-MESSAGE').ok,false); assert.equal(model.markUnread('SEALED-THREAD'),false);
  assert.doesNotMatch(JSON.stringify(model.getState()), /SEALED|2088|Hidden/);
  for (const query of ['Hidden sender','Hidden subject','sealed@hilfer.internal','Sealed search needle','SEALED-RECORD','2088']) {
    model.setQuery(query); assert.deepEqual(model.listThreads(),[]);
  }
  model.setQuery(''); model.setGrants([...corpus.initialGrants,'mail.sealed']);
  assert.equal(model.getFolders()[0].count,4); assert.equal(model.openMessage('SEALED-MESSAGE').ok,true);
  model.setGrants(corpus.initialGrants);
  assert.equal(model.getState().selectedThreadId,null); assert.doesNotMatch(JSON.stringify(model.getState()), /SEALED/);
});

test('read/unread survives reload and reset, stores only UI IDs, and never modifies game state or source prose', () => {
  const storage = memory(), source = structuredClone(corpus);
  const game = createStore({records,cases:read('cases'),storage}); const before = game.getState();
  let model = createMailModel(corpus,{storage}); model.openThread('THREAD-ROSTER');
  assert.equal(model.getFolders()[0].unread,2); assert.equal(model.getReference('MAIL-004','HR-014').type,'record');
  assert.equal(model.getReference('MAIL-004','OH-008'),null);
  model = createMailModel(corpus,{storage}); assert.equal(model.getFolders()[0].unread,2);
  assert.equal(model.getState().selectedThreadId,'THREAD-ROSTER');
  model.markUnread('THREAD-ROSTER'); assert.equal(createMailModel(corpus,{storage}).getFolders()[0].unread,3);
  assert.doesNotMatch(storage.getItem(MAIL_UI_KEY), /Jessica|@hilfer|body|resolutions|distortion/);
  model.reset(); assert.equal(model.getState().selectedThreadId,null); assert.deepEqual(model.getState().readMessageIds,[]);
  assert.deepEqual(game.getState(),before); assert.deepEqual(corpus,source);
});

test('malformed, stale and blocked receipt storage fall back without disabling Mail', () => {
  for (const value of ['bad JSON','{"version":99,"readMessageIds":[]}','{"version":1,"readMessageIds":null}']) {
    const storage = memory(); storage.setItem(MAIL_UI_KEY,value);
    assert.equal(createMailModel(corpus,{storage}).getFolders()[0].unread,3);
  }
  const storage = {getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  const model = createMailModel(corpus,{storage}); model.openThread('THREAD-ROSTER');
  assert.equal(model.getFolders()[0].unread,2); model.reset(); assert.equal(model.getFolders()[0].unread,3);
});

test('invalid IDs, references and timestamps fail validation; authored text is escaped without rewriting it', () => {
  for (const mutate of [data=>data.threads[1].messages[0].id='MAIL-001',data=>data.threads[0].messages[0].sentAt='1998-02-31T12:00:00',data=>data.threads[1].messages[0].references[0].id='UNKNOWN']) {
    const data = structuredClone(corpus); mutate(data); assert.throws(()=>validateMailCorpus(data,id=>records.find(r=>r.id===id)));
  }
  const thread = structuredClone(corpus.threads[0]); thread.messages[0].body='<script>unsafe</script>\n\nExact spacing.';
  assert.match(renderMailThread(thread), /&lt;script&gt;unsafe&lt;\/script&gt;\n\nExact spacing\./);
  assert.doesNotMatch(renderMailThread(thread), /<script>/);
});
