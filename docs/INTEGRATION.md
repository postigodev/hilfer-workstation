# HILFER — Integration Contracts

**Current experiment:** source-to-report reconciliation. This is the implemented vertical-slice UX for Jessica, not a finalized rule for every future case. Static evidence/case content lives in JSON. The central store owns gameplay state. The report remains a derived projection — never a second save.

The engine and application integrations are complete on main through PRs #7 and #8. See the
[documentation index](README.md) for current references versus historical implementation records.

## Run and checks

From the repository root:

    python scripts/serve.py --port 8080

Open http://127.0.0.1:8080. The launcher binds to localhost and serves static files. Use Node.js 24, the verified test runtime, for `node --test` or `npm test`.

For browser checks, keep the server running and install Playwright and Microsoft Edge in your test environment. Set `HILFER_PLAYWRIGHT_MODULE` to the absolute path to Playwright's `index.mjs` if it is installed outside the project. `HILFER_URL` defaults to `http://127.0.0.1:8080`.

```sh
node tests/browser.check.js
node tests/assistant.browser.check.js
node tests/mail.browser.check.js
node tests/theme.browser.check.js
node tests/applications.browser.check.js
```

Run the suites sequentially. The final recorded verification passed 78 unit tests and all five browser suites;
it was local verification, not a CI run. An initial concurrent Assistant run failed its pre-first-click audio
assertion; the unchanged check then passed alone and in the final sequential run. See the
[verification report](APPLICATION_INTEGRATION_REVIEW.md#2026-11-21--final-review-follow-up) for the record.

For content v5, also run `node tests/security.browser.check.js` and
`node tests/security-reconciliation.browser.check.js`. The latter uses production
definitions, actual video playback and explicit E-I3/F/G actions, with no granted test
shortcut. Current content and migration contracts are in
[metadata reconciliation](SECURITY_METADATA_RECONCILIATION.md).

In PowerShell, a separately installed Playwright module and a different server port can be selected with:

```powershell
$env:HILFER_PLAYWRIGHT_MODULE = 'C:\absolute\path\to\playwright\index.mjs'
$env:HILFER_URL = 'http://127.0.0.1:8080'
```

The module must already be installed; these environment variables do not install dependencies. Serve over HTTP
rather than opening index.html directly. Saves belong to the exact browser origin: changing host or port changes
which save is visible. Storage warnings permit in-memory play; incompatible saves are preserved and writes blocked
until migration or an explicit reset. Assistant narration retries after a trusted interaction when autoplay is blocked.

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

Those case fields preserve the demo and legacy APIs. General progression lives in `data/progression.json`:
logical evidence, individually identified determinations, explicit inference support, rule conditions, milestone
consequences, grants, content catalog and presentation policies. One investigation can contain multiple
determinations; the Jessica case definition is not a universal narrative template.

## Ownership and APIs

`js/main.js` loads the current datasets and retained migration sources, creates
`createStore({records,cases,storage,progression,contentMigrations})`, then constructs a shared artifact boundary
and mounts the apps. `createStore({records,cases,storage})` remains the legacy-compatible factory for callers
without explicit progression definitions; it is not the current production bootstrap.

Public store methods (legacy adapters remain supported; see [ENGINE.md](ENGINE.md) for v2 commands):

- `getRecord(id)`, `getRecords()`, `getCases()`, `getState()`, `getWarning()`.
- `discover(recordId)`: explicitly inspect the logical evidence mapped to a Records document. Filing/attachment register provenance without marking inspection. The legacy `discoveredEvidenceIds` projection remains registration, not inspection history. Browsing search results does not inspect records.
- **`reconcileClaim(caseId, recordId, field)`**: use a *previously inspected*, case-relevant field. Reject locked, unknown, unsupported or baseline-only selections. For a valid revised source, link only the valid baseline and chosen records (any other required evidence must already be attached), validate against the case definition, atomically file the canonical resolution and emit progression events. Repeating an accepted filing returns alreadyCompleted without replaying consequences. This remains Jessica's primary filing action.
- `attachEvidence(caseId, recordId)`, `removeEvidence(caseId, recordId)`, `submitResolution(caseId, resolution)`: existing validated **legacy domain APIs** retained for compatibility and tests. They are not player-facing requirements for this iteration.
- `getSnapshot()`, `dispatch(command)`, `getAccess()`, `getAvailability()`, `getCompletedCaseIds()`, `evidenceForArtifact(app,id)`: canonical v2 engine interfaces.
- `isContentAvailable(id)`, `isArtifactAvailable(app,id)`, `canInspectEvidence(id)`: derived permission queries used by the shared artifact boundary. Raw registry getters remain trusted internal/debug APIs, not app authorization filters.
- `subscribe(fn)`, `onEvent(fn)`: subscribe to compatible state and the unchanged legacy event stream. `onEngineEvent(fn)` additionally receives logical inspection, inference, individual determination, milestone, access and availability events.
- `resetProgress()`: revert to a fresh session.

The Records adapter is `mountRecords(root, store, {onClaim,artifacts})` from `js/apps/records-fixture.js`. It uses authorized queries before listing departments/files, then registers inspection only after the rendered document policy succeeds. `renderRecord(record)` generates a visually differentiated employee/medical form and a `data-claim-record` + `data-claim-field` button where appropriate. New record types need field-specific interaction metadata; **do not hardcode all records as `workEligibility`**.

Reconciliation is `mountReconciliation(root, store, {openRecord,artifacts})` from `js/apps/reconciliation.js`, returning `focusComparison()`, `presentClaim(recordId,field)`, `getActiveCaseId()` and `showReport()`. `js/main.js` bridges Records' `onClaim` to Reconciliation's `presentClaim`, then focuses the Reconciliation window. The link back to Records is `openRecord(id)`, which rechecks authorization, clears search filters and opens the requested source. `window.hilfer` exposes trusted store and Reconciliation APIs for development and tests.

### Claim workflow contract

`Records → onClaim(recordId, field) → Reconciliation.presentClaim(...)`

That action opens a comparison but does **not** mutate the official finding. When the player chooses the new source:

`Reconciliation → store.reconcileClaim(caseId, recordId, field) → saved resolution + milestone events`

This keeps UI selection, provenance validation, and administrative commitment distinct without forcing separate manual forms. The comparison's "Continue reviewing" option dismisses the proposal but **does not** falsely mark the discrepancy resolved.

## Living report

`js/apps/report.js` exports `deriveReport(cases,state,getRecord,{getSourceForValidation}?)` and
`renderReport(report,{canOpenRecord}?)`. The original three-argument/default calls remain compatible. Current
integration filters source metadata while separately validating the preexisting official claim; inaccessible
source links render as unavailable without deleting accepted findings. There is no separately persisted report.

Source references navigate to Records. Report case links navigate to Case Register. The report is the player's work product and a later storytelling device about what HILFER permits to be entered into an official record.

## Persistence and progression

Current key: `hilfer:save:v2`. Saves contain canonical facts and rule/effect receipts; `getState()` is the historical v1-shaped projection, not the persisted object. No static datasets or separate report copy are stored.

`hilfer:save:v1` remains an untouched migration source. Valid historical determinations and links survive; discoveries become registration, never retrospective inspection. v2/content validation preserves incompatible saves and blocks writes rather than replacing them or loading stale v1. Storage failure permits in-memory play with warning. Explicit reset writes fresh v2 and resets existing UI receipts. Detailed schema, sequential content migrations, effect acknowledgment and limitations are documented in [ENGINE.md](ENGINE.md).

`data/progression.json` now uses definition schema/content 2 and a validated contentCatalog. `data/history/` retains the original migration sources; the save envelope remains v2. Distortion remains milestone-derived and Jessica retains her one existing transient cue. Applications use the shared authorization/presentation boundary; Mail retains its internal thread-grant model and UI receipts. See [APP_INTEGRATION.md](APP_INTEGRATION.md) for message/attachment granularity, policy aliases, cancellation and mounted effects. No restricted narrative content is added.

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

The Security integration adds `data/footage.json`, `mountSecurity`, and the
closed `media-sequence-presented` policy. `createArtifacts` supplies immutable source
metadata to the policy, overriding presentation-provided metadata. Transport and
injury observations have separate logical evidence/artifact IDs for the same file.
Only contiguous visible decoded playback at normal speed can satisfy them. Partial
coverage is transient; reset, pause, seek, replacement and revoked access invalidate
pending operations. `store.js` and the save envelope are unchanged; content v3→v4
uses explicit historical definition snapshots. Editorial validation is separate from
visual inspection. Content v5 derives the timeline grant only from explicit E-I3,
which requires both freshly inspected documentary addenda and actual transport observation.

Run `node tests/security.browser.check.js` after the five existing browser suites,
and `python tests/serve_test.py` for local HTTP byte-range responses.

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

`js/apps/shared.js` formats display values, dates and document titles. Canonical enums, IDs and save data stay unchanged. Records prioritizes employee, document type and issued date; exact references and classifications live in native **Record details** disclosures. The report shows readable status/source/context, with audit provenance inside details. Report rendering omits placeholders. The case register retains only the explicitly authored CASE-002 locked teaser; future placeholders must satisfy normal availability.

## Contextual HILFER Assistant (demo)

`data/assistant.json` owns English correspondence for the configured case. `deriveAssistant(state, records, content)` in `js/apps/ai.js` projects welcome, investigating (relevant evidence discovered) and filed (committed resolution) phases. `mountAI` uses the existing store subscriptions/events; it never changes evidence, resolutions or progression. There is no LLM or Next-message sequence.

The Assistant is docked above the taskbar. An unseen dialogue signal opens its balloon without taking focus. The portrait, report notification and shell shortcut also open it manually. The shell dispatches `hilfer:assistant-open` for those shortcuts. Opening the correspondence manually acknowledges the report update in `hilfer:assistant:v1`. Demo reset clears the receipts and delivers the welcome again. Unavailable storage retains session behavior.

The existing `hilfer:case-reconciled` event plays the imported glitch cue at 20% volume for at most 1.5 seconds. The visual microglitch remains 650 ms. Reload/duplicate submissions do not emit another cue; reset/page exit stops playback. Rejected audio playback never interrupts filing or assistant notification.

Checks: `node --test`, existing `node tests/browser.check.js`, and `node tests/assistant.browser.check.js` (same Playwright/Edge environment variables). The assistant check covers fresh play, contextual messages, actual audio start/stop, unread/read reloads, reset/replay, rejected audio, portrait variance, balloon dismissal and focus, and mobile notification access.

## Graphite appearance

Display Properties → Color scheme → Archive / Graphite switches to Arwa's desaturated artwork across desktop, title bars, taskbar, Start, department folders, record-file glyphs and the logo. Asset choices live in `css/assets.css`; the palette and Altynai's multiply treatment live in `css/arwa.css`. Theme selection is independent of gameplay/distortion and uses the existing session-only selector. Distortion aliases retain the selected theme; returning to Standard restores its original art. `node tests/theme.browser.check.js` checks both directions, actual Jessica reconciliation, reload and mobile.

Display Properties also offers **Use original logo / Use pixelated logo** for live demo comparisons. It sets presentation-only `data-logo-style` on the root and overrides `--art-desktop-logo`; paper/Start logos are unaffected. An explicit choice remains through color-scheme changes during the session, using the matching pixel variant when appropriate. Reload restores the scheme defaults; no game/save state is changed.

## HILFER Mail

`data/emails.json` is the fixed demo corpus of five conversations and twelve messages. Inbox has three conversations, Archive has two, and Sent has no messages from Reconciliation Desk. All timestamps are provisional. See [MAIL_CONTRACT.md](MAIL_CONTRACT.md) for the original corpus contract.

`createMailModel` applies the configured grants before listing, searching, counting, opening or resolving a reference. `setGrants(grants)` updates those gameplay permissions and removes access to any now-restricted reader. The corpus is part of the static app bundle.

- `listThreads()` returns one row per authorized conversation, ordered by its latest applicable message. The row includes a preview. Search expands a matching message when the conversation opens. Sent derives membership from mail actually sent by Reconciliation Desk.
- `selectThread(id)` selects without marking mail read. `openThread(id)` marks the whole conversation read. Each thread has one independent desktop window with dates, sender details and expandable messages. Readers can coexist, are not restored on reload, and close on demo reset or revoked access.
- `setThreadDeleted(id, value)` moves or restores a thread locally. Deleted Items has its own search scope and is excluded from ordinary search. Restore returns the thread to its authored folder and any applicable Sent view.
- `getReference(messageId, recordId)` resolves authorized references. MAIL-004 opens HR-014 through the existing Records API. Reading or moving mail does not change formal Reconciliation state.

Read receipts, selection and optional deleted thread IDs persist under `hilfer:mail-ui:v1`. Demo reset clears them. The message-level APIs remain available for integrations. Use arrows or Home/End to select, Enter to open, Ctrl+F to search, and Esc to close a reader or menu. The table scrolls horizontally in narrow windows.

### Demo voice and Footage

Assistant dialogue is authored in `data/assistant.json`. Each entry names its delivery signal in `on` and has one `text` for the visible bubble and the rendered MP3. Its optional `voice` contains the file path and a versioned ID. The demo maps assignment, evidence inspection and filing to these signals. Future gameplay can dispatch `hilfer:assistant-dialogue` on window with `detail: {signal}` to deliver the matching entry independently of the demo mapping. `hilfer:assistant-delivery:v1` records delivered signals so duplicate events and reloads do not reopen the balloon. Only the current entry narrates when the balloon is open; earlier entries remain as readable history. The `hilfer:assistant-dialogue:v1` checkpoint stores completed voice IDs by case. Closing the balloon leaves playback running. A new cue waits for the current clip to finish. If the browser blocks autoplay, playback retries on the next trusted interaction. Demo reset clears the checkpoint. When the text changes, regenerate the MP3 from that text and advance its voice ID.

Footage exposes the supplied CAM 4 clip as a read-only demo preview. It uses native video controls and pauses when its window is closed or minimized. The MP4 retains the source clip audio. No case or gameplay state depends on playback.
