# Engine Foundation Implementation Plan

> **For agentic workers:** Execute inline with executing-plans; independent spec review uses the brainstorming reviewer contract.

**Goal:** Deliver PR 1 with definition-driven investigations and existing demo compatibility.
**Architecture:** Pure bounded conditions and validated definitions feed one store transaction. Persistence owns migration; legacy state is only a projection.
**Tech Stack:** Vanilla JavaScript modules, JSON, Node test runner, existing Playwright checks.

## Global Constraints

- No canonical evidence, restricted production content, dialogue changes, Drive writes, PR 2, or automatic merge.
- Existing APIs and all 31 baseline tests retain their guarantees.
- Save migration never treats v1 discovery as inspection or replays historical cues.

### Task 1: Validate and evaluate declarative definitions

Files: create js/core/rules.js, tests/engine.test.js, tests/fixtures/investigation.js.
Interfaces: validateDefinitions(input,cases), evaluateCondition(condition,state,definition,grants),
settleRules(state,definition,{restore}), deriveAccess/deriveAvailability/derivePresentation.

- [ ] Add a synthetic evidence registry (camera injury, HR authorization, maintenance warnings, recovery purpose), explicit support alternatives, two determinations and milestone policies.
- [ ] Run `node --test tests/engine.test.js`; confirm missing-module failure before implementation.
- [ ] Validate each schema and cross-reference; topologically evaluate producers and reject dependency cycles; prove all 24 inspection orders and counts.
- [ ] Run engine tests and commit the independently tested evaluator.

### Task 2: Canonical state, commands and compatible projection

Files: modify js/core/store.js and progression.js; create data/progression.json; adapt main.js and reconciliation.js.
Interfaces: createStore({records,cases,storage,progression,contentMigrations}), dispatch(command), getSnapshot(), getState(), getAccess(), getAvailability().

- [ ] Add failing command tests: explicit inference, immutable individual determinations, inaccessible/unknown evidence, duplicate commands and legacy compatibility.
- [ ] Implement commands against one snapshot copy; settle, persist, publish compatible events then new events; queue reentrant callbacks.
- [ ] Compile default legacy definitions for old test callers; explicitly load production progression JSON; stop presentClaim from inventing inspection.
- [ ] Run `npm test` preserving original assertions; commit commands and demo compatibility.

### Task 3: Save evolution and effect receipts

Files: modify persistence.js; create effects.js and tests/persistence-v2.test.js.
Interfaces: initialSnapshot(definition), loadSnapshot(storage,definition,cases,records,migrations), saveSnapshot(storage,state), claim/ack via store commands, drainEffects(store,handlers).

- [ ] Add migration tests using exact v1 partial/completed saves and no retrospective inspection; add unknown/future v2 preservation and explicit reset tests.
- [ ] Add sequential content migration fixtures that rename/retire IDs, retain historical claims and carry effect receipts; test failure backups and restoration without effects.
- [ ] Implement historical validation, verified v2 writes and backup preservation; effect claims are persisted before fake handlers run.
- [ ] Run `npm test`; commit persistence and effect contracts.

### Task 4: End-to-end verification and PR

Files: update docs/INTEGRATION.md and add docs/ENGINE.md; add focused browser inspection assertions to existing browser suite.

- [ ] Verify a second investigation uses only new definitions and public engine APIs, without modifying store.js/rules.js.
- [ ] Run `npm test` and the four existing browser scripts against the repository server; inspect output screenshots.
- [ ] Document commands, exact schema, mutation/event semantics, migrations, compatibility and PR 2 deferrals; record actual failures and resolutions.
- [ ] Review diff, commit only explicit paths, push feature branch, open PR against main with test results; verify no merge/auto-merge.
