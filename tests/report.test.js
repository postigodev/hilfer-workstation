import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../js/core/store.js';
import { deriveReport, renderReport } from '../js/apps/report.js';
const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const records = read('records'), cases = read('cases');
function setup() {
  const saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const create = () => createStore({ records, cases, storage });
  return { store: create(), create, saved };
}
const report = store => deriveReport(store.getCases(), store.getState(), store.getRecord);

test('report starts pending without exposing required records or supported findings', () => {
  const { store } = setup(); const result = report(store);
  assert.equal(result.completed, 0); assert.equal(result.pending, 1); assert.equal(result.reserved, 1);
  assert.equal(result.status, 'IN PROGRESS');
  assert.equal(result.sections[0].status, 'PENDING');
  assert.deepEqual(result.sections[0].references, []);
  assert.equal(result.sections[0].determination, null);
  assert.deepEqual(result.sections[0].context, []);
  assert.doesNotMatch(renderReport(result), /HR-014|OH-008|NOT_CLEARED|NOT_ESTABLISHED|Administrative discrepancy resolved/);
});
test('inspection is not report evidence; attachments are provisional and removal updates projection', () => {
  const { store } = setup(); store.discover('OH-008');
  assert.equal(report(store).sections[0].references.length, 0);
  store.attachEvidence('CASE-001', 'OH-008');
  const pending = report(store).sections[0];
  assert.equal(pending.status, 'UNDER REVIEW');
  assert.deepEqual(pending.references.map(r => r.id), ['OH-008']);
  assert.equal(pending.determination, null); assert.deepEqual(pending.context, []);
  assert.match(renderReport(report(store)), /Provisional references/);
  assert.doesNotMatch(renderReport(report(store)), /NOT_CLEARED|NOT_ESTABLISHED/);
  assert.equal(store.submitResolution('CASE-001', cases[0].resolution).ok, false);
  assert.equal(report(store).completed, 0);
  store.removeEvidence('CASE-001', 'OH-008'); assert.equal(report(store).sections[0].status, 'PENDING');
});
test('a committed report cites saved authority, preserves context provenance and reloads without separate report state', () => {
  const { store, create, saved } = setup(); const events = []; store.onEvent(e => events.push(e.type));
  for (const r of records) store.attachEvidence('CASE-001', r.id);
  store.submitResolution('CASE-001', cases[0].resolution);
  const result = report(store); const section = result.sections[0];
  assert.equal(section.status, 'RECONCILED'); assert.equal(result.completed, 1); assert.equal(result.pending, 0);
  assert.equal(result.status, 'IN PROGRESS'); assert.equal(result.sections[1].status, 'RESERVED');
  assert.equal(section.determination.value, 'NOT_CLEARED'); assert.equal(section.determination.sourceId, 'OH-008');
  assert.deepEqual(section.context, [{label:'Occupational causation', value:'NOT_ESTABLISHED', sourceId:'OH-008'}]);
  assert.deepEqual(section.references.map(r => r.id), ['HR-014','OH-008']);
  assert.equal(section.disposition, 'Administrative discrepancy resolved.');
  const stateBefore = store.getState(); report(store); renderReport(result);
  assert.deepEqual(store.getState(), stateBefore);
  assert.deepEqual(report(create()), result);
  assert.ok(![...saved.values()][0].includes('report'));
  store.submitResolution('CASE-001', cases[0].resolution);
  assert.equal(events.filter(type => type === 'hilfer:case-reconciled').length, 1);
  store.resetProgress(); assert.equal(report(create()).completed, 0);
  assert.equal(report(store).sections[0].determination, null);
});
test('new definitions extend the document, missing context is omitted, and strings are escaped', () => {
  const { store } = setup();
  const definitions = [...structuredClone(cases), {id:'TEST-CASE', title:'<script>unsafe</script>'}];
  const snapshot = store.getState();
  snapshot.completedCaseIds = ['CASE-001']; snapshot.resolutions['CASE-001'] = {field:'workEligibility',value:'SAVED_VALUE',sourceId:'HR-014'};
  const result = deriveReport(definitions, snapshot, store.getRecord);
  assert.equal(result.sections.length, 3);
  assert.equal(result.sections[0].determination.value, 'SAVED_VALUE');
  assert.deepEqual(result.sections[0].context, []);
  assert.match(renderReport(result), /&lt;script&gt;/); assert.doesNotMatch(renderReport(result), /<script>/);
});
