# HILFER — Integration Contracts

**Current experiment:** source-to-report reconciliation. This is the implemented vertical-slice UX for Jessica, not a finalized rule for every future case. Static evidence/case content lives in JSON. The central store owns gameplay state. The report remains a derived projection — never a second save.

## Run and checks

From the repository root:

    python -m http.server 8080 --bind 127.0.0.1

Open http://127.0.0.1:8080. Node 18+ runs domain tests with \`node --test\` / \`npm test\`. Optional browser checks: \`node tests/browser.check.js\` with Playwright and Microsoft Edge installed. \`HILFER_URL\` defaults to localhost:8080, \`HILFER_PLAYWRIGHT_MODULE\` can specify the local Playwright package, and \`HILFER_SCREENSHOT\` controls the screenshot path.

## Player-facing flow

1. Reconciliation opens with the **Consolidated Report**. CASE-001 already contains HR-014's **unverified** work-eligibility claim: AVAILABLE. The report does not reveal the competing Occupational Health claim.
2. Open Records; select a department and inspect a document. The \`workEligibility\` field is a single contextual button, \`Compare with report\`. Other metadata and medical classifications remain ordinary information.
3. Selecting the field invokes the \`onClaim(recordId, field)\` callback and opens Reconciliation's **Case Register** with an inline comparison of the initial source and the inspected source. The player sees actual values, source IDs and dates.
4. Selecting the existing HR source does not complete the case. The player can keep the existing entry to investigate further. Choosing **Use OH-008 in report** immediately validates and files the supported replacement; there is **no extra Commit button, dropdown, or required drag**.
5. The consolidated report becomes filed, explicitly cites both HR-014 and OH-008 and shows \`NOT_CLEARED\`. Occupational causation remains \`NOT_ESTABLISHED\`, a distinct sourced assertion rather than an adjudicated incident-causality claim.
6. CASE-002 unlocks and distortion level rises to 1 exactly once. Reload restores the filed report; Start → Reset Demo Progress resets it to the provisional HR baseline.

## Data model

\`data/records.json\` defines stable record ID, type, title, department, employeeId, employee, timestamp/date, workPeriod, fields, caseIds and note. Static JSON is immutable in the store. Records exposes browsable documents rather than raw JSON.

\`data/cases.json\` defines \`requiredEvidence\`, authoritative \`resolution: {field,value,sourceId}\`, unlock rules, report metadata and optional **\`provisional: {field,value,sourceId}\`**. A provisional source must exist in the registry and support the specified value. It is an **existing report assertion**, not a correct or committed finding. No uninspected evidence or supported replacement value is leaked by the initial report.

\`CASE-001\` is the only fully playable example. \`CASE-002\` remains an explicitly reserved/unimplemented placeholder. Do not invent other tasks simply to show a progress bar.

## Ownership and APIs

\`js/main.js\` creates \`createStore({records,cases,storage})\` and mounts both apps using the same store.

Public store methods:

- \`getRecord(id)\`, \`getRecords()\`, \`getCases()\`, \`getState()\`, \`getWarning()\`.
- \`discover(recordId)\`: mark a record as inspected. Browsing search results does not discover it.
- **\`reconcileClaim(caseId, recordId, field)\`**: use a *previously inspected*, case-relevant field. Reject locked, completed, unknown, unsupported or baseline-only selections. For a valid revised source, link the baseline and chosen records, validate against the case definition, atomically file the canonical resolution and emit progression events. This is the new primary action.
- \`attachEvidence(caseId, recordId)\`, \`removeEvidence(caseId, recordId)\`, \`submitResolution(caseId, resolution)\`: existing validated **legacy domain APIs** retained for compatibility and tests. They are not player-facing requirements for this iteration.
- \`subscribe(fn)\`, \`onEvent(fn)\`: subscribe to state and milestone events.
- \`resetProgress()\`: revert to a fresh session.

The Records adapter is \`mountRecords(root, store, {onClaim})\` from \`js/apps/records-fixture.js\`. \`renderRecord(record)\` generates a visually differentiated employee/medical form and a \`data-claim-record\` + \`data-claim-field\` button where appropriate. New record types need field-specific interaction metadata; **do not hardcode all records as \`workEligibility\`**.

Reconciliation is \`mountReconciliation(root, store, {openRecord})\` from \`js/apps/reconciliation.js\`, returning \`presentClaim(recordId,field)\`, \`getActiveCaseId()\` and \`showReport()\`. \`js/main.js\` bridges Records' \`onClaim\` to Reconciliation's \`presentClaim\`, then focuses the Reconciliation window. The link back to Records is \`openRecord(id)\`, which clears search filters and opens the requested source. \`window.hilfer\` exposes the store and Reconciliation APIs for development and tests.

### Claim workflow contract

\`Records → onClaim(recordId, field) → Reconciliation.presentClaim(...)\`

That action opens a comparison but does **not** mutate the official finding. When the player chooses the new source:

\`Reconciliation → store.reconcileClaim(caseId, recordId, field) → saved resolution + milestone events\`

This keeps UI selection, provenance validation, and administrative commitment distinct without forcing separate manual forms. The comparison's "Keep existing" option dismisses the proposal but **does not** falsely mark the discrepancy resolved.

## Living report

\`js/apps/report.js\` exports \`deriveReport(cases,state,getRecord)\` and \`renderReport(report)\`. It renders provisional values before reconciliation and authoritative source/context references after reconciliation. It does not persist a second document or imply that every sourced field is independently verified.

Source references navigate to Records. Report case links navigate to Case Register. The report is the player's work product and a later storytelling device about what HILFER permits to be entered into an official record.

## Persistence and progression

Key: \`hilfer:save:v1\`. Contents: version, discoveredEvidenceIds, attachedEvidence, resolutions, completedCaseIds, unlockedCaseIds, distortionLevel. No images, static JSON or separate report copy.

Save loading validates known/relevant IDs and reconstructs unlocks/distortion by replaying valid resolutions. Invalid/incompatible saves start clean; inaccessible storage allows in-memory play and displays a warning.

Milestone events are delivered by \`store.onEvent\` after state changes:

| Event | Detail |
| --- | --- |
| \`hilfer:evidence-discovered\` | \`{recordId}\` |
| \`hilfer:evidence-attached\` | \`{caseId,recordId}\` |
| \`hilfer:case-reconciled\` | \`{caseId,resolution}\` |
| \`hilfer:case-unlocked\` | \`{caseId,byCaseId}\` |
| \`hilfer:distortion-changed\` | \`{previousLevel,level}\` |
| \`hilfer:progress-reset\` | \`{}\` |

The distortion module listens for reconciliation milestones, not clicks or elapsed browser time. Replaying the same filed case must not duplicate milestones.

## Asset boundaries

Original art is in \`assets/arwa/\`, with provenance and usage guidance in \`assets/arwa/CREDITS.md\`. \`css/assets.css\` centralizes shell asset paths; \`css/arwa.css\` styles the shell, and \`css/hilfer.css\` supplies game document layouts, claim comparisons and effects. Original upstream desktop snapshot in \`references/WIN98-template/\` remains unchanged.

The initial medical/HR document graphics are placeholders pending Arwa's application-specific work. Prioritize legibility and believable paper/report composition, not more instructions or giant panels.

## Legacy drag contract — not the primary mechanic

The original store still validates ID-based attachment and explicit submission; the \`beginRecordDrag(event,recordId)\` helper is retained for compatibility. MIME was \`application/x-hilfer-record-id\`. Current document views do **not** require a drag or file tray. Do not reintroduce them without a considered UX test.

## Review questions

- Does selecting a highlighted status field feel discoverable without revealing its significance?
- Does comparing existing/current source claims communicate why one supersedes another?
- Can a first-time player finish Jessica without being coached?
- How should genuinely ambiguous evidence, official procedural constraints, and later nonlinear cases differ without multiplying UI controls?
