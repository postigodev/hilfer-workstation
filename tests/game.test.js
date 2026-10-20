import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../js/core/store.js';
import { SAVE_KEY } from '../js/core/persistence.js';
import { validateResolution } from '../js/core/progression.js';
const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const records = read('records'), cases = read('cases');
const correct = cases[0].resolution;
function memory() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) }; }
function setup(storage = memory(), extras = []) { return createStore({ records: [...records, ...extras], cases, storage }); }
function attachBoth(store) { for (const r of records) assert.equal(store.attachEvidence('CASE-001', r.id).ok, true); }

test('discovery and attachments are distinct; drops validate IDs, relevance, duplicates, lock and removal', () => {
  const store = setup(undefined, [{ id: 'OTHER', fields: {}, caseIds: [] }]);
  store.discover('HR-014');
  assert.deepEqual(store.getState().attachedEvidence, {});
  assert.equal(store.attachEvidence('CASE-001', 'missing').ok, false);
  assert.equal(store.attachEvidence('CASE-001', 'OTHER').ok, false);
  assert.equal(store.attachEvidence('CASE-002', 'HR-014').ok, false);
  attachBoth(store);
  assert.equal(store.attachEvidence('CASE-001', 'HR-014').ok, false);
  assert.equal(store.getState().completedCaseIds.length, 0);
  assert.equal(store.getState().distortionLevel, 0);
  store.removeEvidence('CASE-001', 'HR-014');
  assert.deepEqual(store.getState().attachedEvidence['CASE-001'], ['OH-008']);
});
test('validation requires both evidence records and the supported status/source combination', () => {
  const store = setup();
  assert.equal(store.submitResolution('CASE-001', correct).ok, false);
  store.attachEvidence('CASE-001', 'OH-008');
  assert.equal(store.submitResolution('CASE-001', correct).ok, false);
  store.attachEvidence('CASE-001', 'HR-014');
  for (const resolution of [{...correct, value: 'AVAILABLE'}, {...correct, sourceId: 'HR-014'}, {...correct, field: 'occupationalCausation'}])
    assert.equal(store.submitResolution('CASE-001', resolution).ok, false);
  assert.match(validateResolution(cases[0], ['HR-014','OH-008'], correct, () => ({fields:{workEligibility:'AVAILABLE'}})), /does not support/);
  assert.equal(store.submitResolution('CASE-001', correct).ok, true);
});
test('commit emits predictable milestones once, unlocks only placeholder, seals evidence and keeps registry immutable', () => {
  const store = setup(); const events = []; store.onEvent(e => events.push(e));
  attachBoth(store);
  assert.equal(store.submitResolution('CASE-001', correct).ok, true);
  const count = events.length;
  assert.equal(store.submitResolution('CASE-001', correct).alreadyCompleted, true);
  assert.equal(events.length, count);
  assert.deepEqual(events.map(e => e.type), ['hilfer:evidence-discovered','hilfer:evidence-attached','hilfer:evidence-discovered','hilfer:evidence-attached','hilfer:case-reconciled','hilfer:case-unlocked','hilfer:distortion-changed']);
  assert.deepEqual(events.at(-1).detail, {previousLevel:0,level:1});
  assert.equal(store.getState().distortionLevel, 1);
  assert.ok(store.getState().unlockedCaseIds.includes('CASE-002'));
  assert.equal(store.submitResolution('CASE-002', correct).ok, false);
  assert.equal(store.removeEvidence('CASE-001','HR-014').ok, false);
  assert.throws(() => { store.getRecord('HR-014').fields.workEligibility = 'INVALID'; }, TypeError);
  const snapshot = store.getState(); snapshot.completedCaseIds.length = 0;
  assert.equal(store.getState().completedCaseIds.length, 1);
});
test('in-progress and completed saves reload; reset persists and allows another complete playthrough', () => {
  const storage = memory(); let store = setup(storage);
  store.attachEvidence('CASE-001','HR-014'); store = setup(storage);
  assert.deepEqual(store.getState().attachedEvidence['CASE-001'], ['HR-014']);
  store.attachEvidence('CASE-001','OH-008'); store.submitResolution('CASE-001',correct);
  store = setup(storage);
  assert.deepEqual(store.getState().resolutions['CASE-001'], correct);
  assert.equal(store.getState().distortionLevel, 1);
  store.resetProgress(); store = setup(storage);
  assert.equal(store.getState().distortionLevel, 0);
  assert.deepEqual(store.getState().completedCaseIds, []);
  assert.deepEqual(store.getState().unlockedCaseIds, ['CASE-001']);
  attachBoth(store); assert.equal(store.submitResolution('CASE-001', correct).ok, true);
  assert.ok(!storage.getItem(SAVE_KEY).includes('Jessica Personnel Status'));
});
test('malformed/incompatible and unavailable storage do not crash; forged progression cannot unlock cases', () => {
  const storage = memory();
  for (const raw of ['{broken', 'null', '{"version":2}', '{"version":1}']) {
    storage.setItem(SAVE_KEY,raw); const store = setup(storage);
    assert.equal(store.getState().distortionLevel,0); assert.ok(store.getWarning());
  }
  storage.setItem(SAVE_KEY, JSON.stringify({version:1, discoveredEvidenceIds:['FAKE'], attachedEvidence:{'CASE-001':['FAKE','HR-014','HR-014']}, resolutions:{'CASE-001':correct}, unlockedCaseIds:['CASE-002'], distortionLevel:99}));
  const store = setup(storage);
  assert.equal(store.getState().distortionLevel,0);
  assert.deepEqual(store.getState().unlockedCaseIds,['CASE-001']);
  assert.deepEqual(store.getState().attachedEvidence['CASE-001'],['HR-014']);
  const broken = setup({getItem() {throw Error();},setItem() {throw Error();}});
  attachBoth(broken); assert.equal(broken.submitResolution('CASE-001',correct).ok,true);
  assert.ok(broken.getWarning());
});
