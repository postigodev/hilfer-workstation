# HILFER — Demo Integration Contracts (Proposal)

**Status:** proposed implementation interfaces for the first demo. The developer implementing them should confirm exact names in code and amend this document as needed. No separate backend required.

## Static game data

Static JSON files in the repository (`data/records.json`, `data/cases.json`) are the source of truth for evidence and the case-definition rules. Example shape:

```json
{
  "id": "OH-008",
  "type": "occupational_health_record",
  "title": "Jessica — Work Clearance",
  "department": "Occupational Health",
  "employeeId": "EMP-JESSICA",
  "fields": {
    "workEligibility": "NOT_CLEARED",
    "occupationalCausation": "NOT_ESTABLISHED"
  },
  "caseIds": ["CASE-001"]
}
```

Case example:

```json
{
  "id": "CASE-001",
  "title": "Personnel Availability Mismatch",
  "requiredEvidence": ["HR-014", "OH-008"],
  "resolution": {
    "field": "workEligibility",
    "value": "NOT_CLEARED",
    "sourceId": "OH-008"
  },
  "onComplete": ["UNLOCK_CASE_002", "SET_DISTORTION_LEVEL_1"]
}
```

Ensure HR and OH records refer to the *same time period* and the discrepancy is truly about work eligibility, not the noncontradictory distinction between job assignment and medical condition.

## Player state

Use a single versioned `localStorage` namespace, for example `hilfer:save:v1`. Persist IDs and small state objects, **not** complete records or asset bytes. Handle malformed/stale state and provide Reset Demo Progress.

## Records → Reconciliation

Records owns **listing, searching, inspecting, and drag origin**. Reconciliation owns **case eligibility, evidence linking, validation, commit and progression**. They use the shared record registry and game store.

```js
function beginRecordDrag(event, recordId) {
  event.dataTransfer.setData('application/x-hilfer-record-id', recordId);
  event.dataTransfer.setData('text/plain', recordId);
  event.dataTransfer.effectAllowed = 'copy';
}
```

The receiving drop zone resolves the ID in the registry, checks that it is relevant to the case, rejects unknown/duplicate IDs, and links it in player state. Provide an attach-by-ID method as a fallback for accessibility/tests. Dragging an OS window by its title bar must not start evidence dragging.

## Events (proposed)

- `hilfer:evidence-discovered` — a record becomes known to the player.
- `hilfer:evidence-attached` — a valid evidence ID is linked to an active case.
- `hilfer:case-reconciled` — the player has committed a validated resolution, once.
- `hilfer:case-unlocked` — new case now available.
- `hilfer:distortion-changed` — persistent visual state changed.

Prefer a central store with UI subscribers and dispatch explicit events only for cross-module reactions. Events should be idempotent and should include stable IDs. A rejected drop must not mark a case complete.

## Definition of done for CASE-001

- Records fixture or Lyden's Records UI opens and displays both files.
- Dragging HR-014 and OH-008 to Reconciliation works, with duplicate/invalid-drop feedback.
- The UI requires an explicit supported resolution (work eligibility NOT_CLEARED from OH-008).
- Successful commit updates state, moves the case to completed, unlocks a placeholder CASE-002 and triggers one subtle glitch / persisted distortion level 1.
- Reload restores progress; demo reset clears it.
- CSS effects do not block ordinary use or require final art assets to exist yet.

## Upstream shell compatibility

`WIN98-template` is vanilla HTML/CSS/JS with existing global window management and title-bar dragging. Understand its selectors and event handlers before modularizing. Preserve original license/attribution. Avoid a framework rewrite for the initial demo.
