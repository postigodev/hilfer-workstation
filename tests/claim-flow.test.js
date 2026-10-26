import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../js/core/store.js';
import { deriveReport, renderReport } from '../js/apps/report.js';
import { renderRecord } from '../js/apps/records-fixture.js';

const read = name => JSON.parse(readFileSync(new URL('../data/' + name + '.json', import.meta.url), 'utf8'));
const records = read('records'), cases = read('cases');
function setup(storage, definitions = cases, registry = records) {
  const map = storage ?? new Map();
  const store = createStore({ records: registry, cases: definitions, storage: {
    getItem(key) { return map.get(key) ?? null; },
    setItem(key, value) { map.set(key, value); }
  } });
  return { store, map };
}

test('the official report begins with an unverified claim, not a blank field or the solution', () => {
  const {store} = setup();
  const report = deriveReport(cases, store.getState(), store.getRecord);
  assert.equal(report.sections[0].provisional.sourceId, 'HR-014');
  assert.equal(report.sections[0].provisional.value, 'AVAILABLE');
  assert.equal(report.sections[0].determination, null);
  assert.match(renderReport(report), /UNVERIFIED/);
  assert.doesNotMatch(renderReport(report), /OH-008|NOT_CLEARED/);
});

test('source claim must have been inspected, target the case field and change the provisional source', () => {
  const {store} = setup();
  assert.equal(store.reconcileClaim('CASE-001', 'OH-008', 'workEligibility').ok, false);
  store.discover('HR-014');
  assert.equal(store.reconcileClaim('CASE-001', 'HR-014', 'workEligibility').ok, false);
  store.discover('OH-008');
  assert.equal(store.reconcileClaim('CASE-001', 'OH-008', 'occupationalCausation').ok, false);
  assert.equal(store.reconcileClaim('CASE-002', 'OH-008', 'workEligibility').ok, false);
  assert.deepEqual(store.getState().completedCaseIds, []);
});

test('one contextual selection files the revised claim, preserves sources and persists', () => {
  const map = new Map();
  let { store } = setup(map);
  const events = []; store.onEvent(e => events.push(e.type));
  store.discover('OH-008');
  assert.equal(store.reconcileClaim('CASE-001', 'OH-008', 'workEligibility').ok, true);
  const saved = store.getState();
  assert.deepEqual(saved.attachedEvidence['CASE-001'], ['HR-014', 'OH-008']);
  assert.deepEqual(saved.discoveredEvidenceIds, ['OH-008','HR-014']);
  assert.deepEqual(saved.completedCaseIds, ['CASE-001']);
  assert.equal(saved.resolutions['CASE-001'].value, 'NOT_CLEARED');
  assert.equal(saved.distortionLevel, 1);
  assert.ok(saved.unlockedCaseIds.includes('CASE-002'));
  assert.equal(events.filter(t => t === 'hilfer:case-reconciled').length, 1);
  const count = events.length;
  assert.equal(store.reconcileClaim('CASE-001', 'OH-008', 'workEligibility').alreadyCompleted, true);
  assert.equal(events.length, count);
  const report = deriveReport(cases, saved, store.getRecord);
  assert.equal(report.sections[0].determination.sourceId, 'OH-008');
  assert.equal(report.sections[0].provisional, null);
  assert.deepEqual(report.sections[0].context, [{label:'Occupational causation',value:'NOT_ESTABLISHED',sourceId:'OH-008'}]);
  store = setup(map).store;
  // Loading normalizes missing attachment lists to empty arrays, including placeholders.
  assert.deepEqual(store.getState(), {
    ...saved,
    attachedEvidence: Object.fromEntries(cases.map(c => [c.id, saved.attachedEvidence[c.id] ?? []]))
  });
  store.resetProgress();
  assert.equal(deriveReport(cases, store.getState(), store.getRecord).sections[0].provisional.value, 'AVAILABLE');
});

test('comparison cannot invent additional required evidence or emit rewards on rejection', () => {
  const definitions = structuredClone(cases);
  definitions[0].requiredEvidence.push('TEST-SUPPORT');
  const support = {id:'TEST-SUPPORT', caseIds:['CASE-001'], fields:{note:'Additional supporting record'}};
  const {store} = setup(undefined, definitions, [...records, support]);
  store.discover('OH-008');
  const before = store.getState(); const events = []; store.onEvent(e => events.push(e));
  assert.equal(store.reconcileClaim('CASE-001', 'OH-008', 'workEligibility').ok, false);
  assert.deepEqual(store.getState(), before);
  assert.deepEqual(events, []);
  store.attachEvidence('CASE-001', 'TEST-SUPPORT');
  assert.equal(store.reconcileClaim('CASE-001', 'OH-008', 'workEligibility').ok, true);
  assert.deepEqual(store.getState().attachedEvidence['CASE-001'], ['TEST-SUPPORT', 'HR-014', 'OH-008']);
});

test('an invalid provisional source cannot become report provenance', () => {
  for (const baseline of [
    {field:'workEligibility', value:'AVAILABLE', sourceId:'UNKNOWN'},
    {field:'workEligibility', value:'NOT_CLEARED', sourceId:'HR-014'},
    {field:'occupationalCausation', value:'AVAILABLE', sourceId:'HR-014'}
  ]) {
    const definitions = structuredClone(cases); definitions[0].provisional = baseline;
    const {store} = setup(undefined, definitions);
    store.discover('OH-008'); const before = store.getState();
    assert.equal(store.reconcileClaim('CASE-001', 'OH-008', 'workEligibility').ok, false);
    assert.deepEqual(store.getState(), before);
  }
});

test('both record types surface a clickable claim, while other medical fields remain context only', () => {
  const html = records.map(renderRecord);
  assert.ok(html.every(x => x.includes('data-claim-field="workEligibility"')));
  assert.ok(html[0].includes('data-claim-record="HR-014"'));
  assert.ok(html[1].includes('data-claim-record="OH-008"'));
  assert.match(html[1], /NOT_ESTABLISHED/);
  assert.doesNotMatch(html[1], /data-claim-field="occupationalCausation"/);
});
