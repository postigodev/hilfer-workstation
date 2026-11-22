import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveAssistant, createAssistantReceipt, ASSISTANT_RECEIPT_KEY } from '../js/apps/ai.js';
import { createStore } from '../js/core/store.js';
import { createAssistantVoice } from '../js/apps/assistant-voice.js';

test('narration only speaks fresh cues and ignores canceled completions', () => {
  const saved = new Map();
  const storage = {getItem:key => saved.get(key), setItem:(key,value) => saved.set(key,value), removeItem:key => saved.delete(key)};
  const played = [];
  const engine = {
    audio: { play() { played.push(this.src); }, pause() {} }
  };
  const welcome = {id:'welcome', src:'welcome.mp3'};
  const filed = {id:'filed', src:'filed.mp3'};
  const voice = createAssistantVoice(storage, 'CASE-001', engine);
  assert.deepEqual(played, []);
  voice.play(welcome);
  assert.match(played.at(-1), /welcome\.mp3$/);
  engine.audio.onended();
  voice.play(welcome);
  assert.equal(played.length, 1);
  voice.play(filed);
  const canceledEnd = engine.audio.onended;
  voice.stop();
  canceledEnd();
  const reloaded = createAssistantVoice(storage, 'CASE-001', engine);
  reloaded.play(filed);
  assert.match(played.at(-1), /filed\.mp3$/);
  engine.audio.onended();
  const count = played.length;
  reloaded.play(filed);
  assert.equal(played.length, count);
  reloaded.reset();
  reloaded.play(welcome);
  assert.match(played.at(-1), /welcome\.mp3$/);
});
const read = name => JSON.parse(readFileSync(new URL('../data/' + name + '.json', import.meta.url), 'utf8'));
test('canceling a queued engine voice cannot interrupt another cue or mark it completed',()=>{
  const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
  let pauses=0;const audio={play(){},pause(){pauses++;}},voice=createAssistantVoice(storage,'TEST',{audio});
  voice.play({id:'baseline',src:'baseline.mp3'});const before=pauses;
  voice.cancelCue('queued-engine');assert.equal(pauses,before);
  voice.cancelCue('baseline');assert.equal(pauses,before+1);
  assert.equal(saved.size,0);
});
const records = read('history/records-v2'), cases = read('history/cases-v2'), content = read('assistant');
const memory = () => {
  const data = new Map();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
};

test('assistant derives assignment, investigation and filed correspondence without altering game state', () => {
  const storage = memory(); const store = createStore({records, cases, storage});
  const model = () => deriveAssistant(store.getState(), records, content);
  assert.equal(model().phase, 'welcome'); assert.equal(model().notificationId, null);
  assert.doesNotMatch(JSON.stringify(model()), /OH-008|NOT_CLEARED|Not cleared|NOT_ESTABLISHED/);
  store.discover('OH-008');
  assert.equal(model().phase, 'investigating'); assert.equal(model().notificationId, null);
  assert.doesNotMatch(JSON.stringify(model()), /OH-008|NOT_CLEARED|Not cleared/);
  const snapshot = store.getState(); model(); assert.deepEqual(store.getState(), snapshot);
  store.reconcileClaim('CASE-001', 'OH-008', 'workEligibility');
  assert.equal(model().phase, 'filed'); assert.equal(model().notificationId, 'CASE-001:reconciled');
  const filedEntry = content.dialogue.find(entry => entry.on === 'case.report-filed');
  assert.deepEqual(model().messages.at(-1), filedEntry);
  assert.deepEqual(model().voice, filedEntry.voice);
  const reloaded = createStore({records, cases, storage});
  assert.deepEqual(deriveAssistant(reloaded.getState(), records, content), model());
  store.resetProgress(); assert.equal(model().phase, 'welcome');
});

test('unrelated discovery never advances assistant correspondence', () => {
  const state = {completedCaseIds:[], resolutions:{}, discoveredEvidenceIds:['OTHER']};
  assert.equal(deriveAssistant(state, [...records, {id:'OTHER',caseIds:['OTHER-CASE']}], content).phase, 'welcome');
});

test('UI receipt survives reload, is idempotent, resets independently and rejects incompatible saves', () => {
  const storage = memory(); let receipt = createAssistantReceipt(storage, 'CASE-001:reconciled');
  assert.equal(receipt.isRead(), false); receipt.markRead();
  const value = storage.getItem(ASSISTANT_RECEIPT_KEY); receipt.markRead(); assert.equal(storage.getItem(ASSISTANT_RECEIPT_KEY), value);
  receipt = createAssistantReceipt(storage, 'CASE-001:reconciled'); assert.equal(receipt.isRead(), true);
  receipt.reset(); assert.equal(createAssistantReceipt(storage, 'CASE-001:reconciled').isRead(), false);
  for (const invalid of ['broken', '{"version":9,"readId":"CASE-001:reconciled"}', '{"version":1,"readId":"OTHER"}']) {
    storage.setItem(ASSISTANT_RECEIPT_KEY, invalid);
    assert.equal(createAssistantReceipt(storage, 'CASE-001:reconciled').isRead(), false);
  }
});

test('blocked UI storage preserves an in-session receipt and reset', () => {
  const fail = () => { throw new Error('storage blocked'); };
  const receipt = createAssistantReceipt({getItem:fail,setItem:fail,removeItem:fail}, 'CASE-001:reconciled');
  receipt.markRead(); assert.equal(receipt.isRead(), true); receipt.reset(); assert.equal(receipt.isRead(), false);
});
