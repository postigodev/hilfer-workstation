# HILFER — Integration Contracts

**Current experiment:** source-to-report reconciliation. This is the implemented vertical-slice UX for Jessica, not a finalized rule for every future case. Static evidence/case content lives in JSON. The central store owns gameplay state. The report remains a derived projection — never a second save.

## Run and checks

From the repository root:

    python scripts/serve.py --port 8080

Open http://127.0.0.1:8080. Node 18+ runs domain tests with `node --test` / `npm test`. Optional browser checks: `node tests/browser.check.js` with Playwright and Microsoft Edge installed. `HILFER_URL` defaults to localhost:8080, `HILFER_PLAYWRIGHT_MODULE` can specify the local Playwright package, and `HILFER_SCREENSHOT` controls the screenshot path.

## Player-facing flow

1. Reconciliation opens with the **Consolidated Report**. CASE-001 already contains HR-014's **unverified** work-eligibility claim: AVAILABLE. The report does not reveal the competing Occupational Health claim.
2. Open Records; select a department and inspect a document. The `workEligibility` field is a single contextual button, `Compare status with report`. Other metadata and medical classifications remain ordinary information.
3. Selecting the field invokes the `onClaim(recordId, field)` callback and opens Reconciliation's **Case Register** with an inline comparison of the initial source and the inspected source. The player sees actual values, source IDs and dates.
4. Selecting the existing HR source does not complete the case. The player can keep the existing entry to investigate further. Choosing **Update report** immediately validates and files the supported replacement; there is **no extra Commit button, dropdown, or required drag**.
5. The consolidated report becomes filed, explicitly cites both HR-014 and OH-008 and shows `NOT_CLEARED`. Occupational causation remains `NOT_ESTABLISHED`, a distinct sourced assertion rather than an adjudicated incident-causality claim.
6. CASE-002 unlocks and distortion level rises to 1 exactly once. Reload restores the filed report; Start → Reset Demo Progress resets it to the provisional HR baseline.

## Data model

`data/records.json` defines stable record ID, type, title, department, employeeId, employee, timestamp/date, workPeriod, fields, caseIds and note. Static JSON is immutable in the store. Records exposes browsable documents rather than raw JSON.

`data/cases.json` defines `requiredEvidence`, authoritative `resolution: {field,value,sourceId}`, unlock rules, report metadata and optional **`provisional: {field,value,sourceId}`**. A provisional source must exist in the registry and support the specified value. It is an **existing report assertion**, not a correct or committed finding. The initial report reveals only its existing source, never the supported replacement.

`CASE-001` is the only fully playable example. `CASE-002` remains an explicitly reserved/unimplemented placeholder. Do not invent other tasks simply to show a progress bar.

## Ownership and APIs

`js/main.js` creates `createStore({records,cases,storage})` and mounts both apps using the same store.

Public store methods:

- `getRecord(id)`, `getRecords()`, `getCases()`, `getState()`, `getWarning()`.
- `discover(recordId)`: register a known record when inspected. Filing also registers the existing report source; this list is not an independent inspection history. Browsing search results does not discover records.
- **`reconcileClaim(caseId, recordId, field)`**: use a *previously inspected*, case-relevant field. Reject locked, completed, unknown, unsupported or baseline-only selections. For a valid revised source, link only the valid baseline and chosen records (any other required evidence must already be attached), validate against the case definition, atomically file the canonical resolution and emit progression events. This is the new primary action.
- `attachEvidence(caseId, recordId)`, `removeEvidence(caseId, recordId)`, `submitResolution(caseId, resolution)`: existing validated **legacy domain APIs** retained for compatibility and tests. They are not player-facing requirements for this iteration.
- `subscribe(fn)`, `onEvent(fn)`: subscribe to state and milestone events.
- `resetProgress()`: revert to a fresh session.

The Records adapter is `mountRecords(root, store, {onClaim})` from `js/apps/records-fixture.js`. `renderRecord(record)` generates a visually differentiated employee/medical form and a `data-claim-record` + `data-claim-field` button where appropriate. New record types need field-specific interaction metadata; **do not hardcode all records as `workEligibility`**.

Reconciliation is `mountReconciliation(root, store, {openRecord})` from `js/apps/reconciliation.js`, returning `focusComparison()`, `presentClaim(recordId,field)`, `getActiveCaseId()` and `showReport()`. `js/main.js` bridges Records' `onClaim` to Reconciliation's `presentClaim`, then focuses the Reconciliation window. The link back to Records is `openRecord(id)`, which clears search filters and opens the requested source. `window.hilfer` exposes the store and Reconciliation APIs for development and tests.

### Claim workflow contract

`Records → onClaim(recordId, field) → Reconciliation.presentClaim(...)`

That action opens a comparison but does **not** mutate the official finding. When the player chooses the new source:

`Reconciliation → store.reconcileClaim(caseId, recordId, field) → saved resolution + milestone events`

This keeps UI selection, provenance validation, and administrative commitment distinct without forcing separate manual forms. The comparison's "Continue reviewing" option dismisses the proposal but **does not** falsely mark the discrepancy resolved.

## Living report

`js/apps/report.js` exports `deriveReport(cases,state,getRecord)` and `renderReport(report)`. It renders provisional values before reconciliation and authoritative source/context references after reconciliation. It does not persist a second document or imply that every sourced field is independently verified.

Source references navigate to Records. Report case links navigate to Case Register. The report is the player's work product and a later storytelling device about what HILFER permits to be entered into an official record.

## Persistence and progression

Key: `hilfer:save:v1`. Contents: version, discoveredEvidenceIds, attachedEvidence, resolutions, completedCaseIds, unlockedCaseIds, distortionLevel. No images, static JSON or separate report copy.

Save loading validates known/relevant IDs and reconstructs unlocks/distortion by replaying valid resolutions. Invalid/incompatible saves start clean; inaccessible storage allows in-memory play and displays a warning.

Milestone events are delivered by `store.onEvent` after state changes:

| Event | Detail |
| --- | --- |
| `hilfer:evidence-discovered` | `{recordId}` |
| `hilfer:evidence-attached` | `{caseId,recordId}` |
| `hilfer:case-reconciled` | `{caseId,resolution}` |
| `hilfer:case-unlocked` | `{caseId,byCaseId}` |
| `hilfer:distortion-changed` | `{previousLevel,level}` |
| `hilfer:progress-reset` | `{}` |

The distortion module listens for reconciliation milestones, not clicks or elapsed browser time. Replaying the same filed case must not duplicate milestones.

## Asset boundaries

Original art is in `assets/arwa/`, with provenance and usage guidance in `assets/arwa/CREDITS.md`. `css/assets.css` centralizes shell asset paths; `css/arwa.css` styles the shell, and `css/hilfer.css` supplies game document layouts, claim comparisons and effects. Original upstream desktop snapshot in `references/WIN98-template/` remains unchanged.

The initial medical/HR document graphics are placeholders pending Arwa's application-specific work. Prioritize legibility and believable paper/report composition, not more instructions or giant panels.

## Legacy drag contract — not the primary mechanic

The original store still validates ID-based attachment and explicit submission; the `beginRecordDrag(event,recordId)` helper is retained for compatibility. MIME was `application/x-hilfer-record-id`. Current document views do **not** require a drag or file tray. Do not reintroduce them without a considered UX test.

## Review questions

- Does selecting a highlighted status field feel discoverable without revealing its significance?
- Does comparing existing/current source claims communicate why one supersedes another?
- Can a first-time player finish Jessica without being coached?
- How should genuinely ambiguous evidence, official procedural constraints, and later nonlinear cases differ without multiplying UI controls?

## Editorial presentation

`js/apps/shared.js` formats display values, dates and document titles. Canonical enums, IDs and save data stay unchanged. Records prioritizes employee, document type and issued date; exact references and classifications live in native **Record details** disclosures. The report shows readable status/source/context, with audit provenance inside details. Technical placeholders are omitted from report rendering only; progression and the case register retain them.

## Contextual HILFER Assistant (demo)

`data/assistant.json` owns English correspondence for the configured case. `deriveAssistant(state, records, content)` in `js/apps/ai.js` projects welcome, investigating (relevant evidence discovered) and filed (committed resolution) phases. `mountAI` uses the existing store subscriptions/events; it never changes evidence, resolutions or progression. There is no LLM or Next-message sequence.

The shell dispatches `hilfer:window-activated` on `window` with `{windowId}` when a window gains focus. Opening/activating `ai` acknowledges its visible update. The discrete taskbar notification remains available while unread, including after reload. Only a versioned UI receipt (`hilfer:assistant:v1`, `{version:1,readId}`) is persisted separately; it is not game state. Demo reset clears the receipt and derives the welcome phase again. Unavailable storage retains session behavior.

The existing `hilfer:case-reconciled` event plays the imported glitch cue at 20% volume for at most 1.5 seconds. The visual microglitch remains 650 ms. Reload/duplicate submissions do not emit another cue; reset/page exit stops playback. Rejected audio playback never interrupts filing or assistant notification.

Checks: `node --test`, existing `node tests/browser.check.js`, and `node tests/assistant.browser.check.js` (same Playwright/Edge environment variables). The assistant check covers fresh play, contextual messages, actual audio start/stop, unread/read reloads, reset/replay, rejected audio, portrait variance, window controls and mobile notification access.

## Graphite appearance

Display Properties → Color scheme → Archive / Graphite switches to Arwa's desaturated artwork across desktop, title bars, taskbar, Start, department folders, record-file glyphs and the logo. Asset choices live in `css/assets.css`; the palette and Altynai's multiply treatment live in `css/arwa.css`. Theme selection is independent of gameplay/distortion and uses the existing session-only selector. Distortion aliases retain the selected theme; returning to Standard restores its original art. `node tests/theme.browser.check.js` checks both directions, actual Jessica reconciliation, reload and mobile.

Display Properties also offers **Use original logo / Use pixelated logo** for live demo comparisons. It sets presentation-only `data-logo-style` on the root and overrides `--art-desktop-logo`; paper/Start logos are unaffected. An explicit choice remains through color-scheme changes during the session, using the matching pixel variant when appropriate. Reload restores the scheme defaults; no game/save state is changed.

## HILFER Mail v1

The fixed corpus is `data/emails.json`, copied without content changes from `hilfer_mail_demo_v1.json` (5 threads, 12 messages). [MAIL_CONTRACT.md](MAIL_CONTRACT.md) preserves the supplied contract. All message dates are provisional demo timestamps, not approved chronology; Inbox contains 3 conversations, Corporate Archive 2, and Sent Mail is intentionally empty. This is the authorized Reconciliation Desk mailbox/archive, not a personal account. No Compose, outgoing mail, attachments or new narrative messages are implemented.

`js/apps/emails.js` exports `validateMailCorpus`, `createMailModel` and `mountMail`. The model defaults to the corpus's `initialGrants`; `requiredGrants` gates list/search/count/lookup/open/reference access before results are returned. `setGrants(grants)` is the future integration seam and clears unauthorized selection/receipts; no progression unlocks are invented. These are gameplay authorization rules in a static app, not a server-side confidentiality boundary for private data.

`listThreads()`, `getThread(id)`, `getMessage(id)`, `openThread(id)`, `openMessage(id)`, `getReference(messageId,recordId)`, `setFolder(id)`, `setQuery(text)`, `markUnread(id)`, `getFolders()`, `getState()` and `subscribe(fn)` own only Mail UI. Search is across authorized folders; results and conversation messages sort by their supplied facility-local timestamps. Opening a conversation marks its messages read. Search, selection and rendering never call game discovery; only the supplied MAIL-004 reference navigates through existing `openRecord('HR-014')` and normal Records inspection. No OH-008 shortcut or finding is added to Mail.

Read IDs/folder/selection persist under `hilfer:mail-ui:v1` with version 1, independently of game/Assistant saves. Invalid or inaccessible storage falls back to safe in-memory reading. `hilfer:progress-reset` clears Mail receipts, query and selection. Keyboard: arrows/Home/End select conversations or folders; F6 moves between conversation list and reader; native Tab/Enter operate search, controls and Records links.

Checks: `node --test` includes fixed-corpus hash, reference/anchor validation, sorting, access denial/direct lookups/counts, revoked grants, receipt persistence/reset/blocked storage and game-state separation. `node tests/mail.browser.check.js` verifies all 12 exact bodies and metadata, five conversations, empty Sent, search, HR-014 navigation and Jessica, reload/reset, restricted fixture, keyboard/mobile/Graphite, malformed/blocked receipts and window controls.

The standard-library static launcher `scripts/serve.py` (also `npm start`) uses a larger connection accept queue. Default Python HTTP-server backlog intermittently refused simultaneous startup asset requests on this Windows host; five cold boots passed with the increased queue. It serves only static files from the repository, binds localhost and adds no runtime backend or dependency.
