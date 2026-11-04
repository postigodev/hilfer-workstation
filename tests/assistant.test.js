import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveAssistant, createAssistantReceipt, ASSISTANT_RECEIPT_KEY } from '../js/apps/ai.js';
import { createStore } from '../js/core/store.js';
const read = name => JSON.parse(readFileSync(new URL('../data/' + name + '.json', import.meta.url), 'utf8'));
const records = read('records'), cases = read('cases'), content = read('assistant');
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
  assert.equal(model().messages.at(-1).text, content.filed.text);
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
