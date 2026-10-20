# HILFER — Integration Contracts

Implemented first-prototype interfaces. Static content is read-only; the central store owns all progress. Records is intentionally a temporary adapter for Lyden.

## Run and checks

From the repository root: `python -m http.server 8080 --bind 127.0.0.1`, then open `http://127.0.0.1:8080`. Node 18+ runs pure logic checks with `node --test` (or `npm test`). No build or runtime packages.

Optional browser regression: with Playwright and Microsoft Edge available, run `node tests/browser.check.js`. Set `HILFER_URL` to the local server URL (default `http://127.0.0.1:8080`); set `HILFER_PLAYWRIGHT_MODULE` only if Playwright is outside normal module resolution. This check uses real browser drags and a temporary isolated browser profile. `HILFER_SCREENSHOT` optionally selects an output path.

## Data and ownership

- `data/records.json`: stable ID, type, title, department, employeeId, employee, date (local fictional facility time), workPeriod, fields, caseIds, note. HR-014 and OH-008 cover the same duty period; OH is later. Occupational causation remains NOT_ESTABLISHED.
- `data/cases.json`: requiredEvidence, resolution `{field, value, sourceId}`, statusOptions, initiallyUnlocked and progression `{unlockCaseIds, distortionLevel}`. A placeholder has `placeholder: true` and cannot be completed. Validation and progression follow these definitions.
- `js/core/store.js`: immutable registry, runtime state, validated mutations, subscriptions. `progression.js`: pure validation and milestone transitions. `persistence.js`: versioned saves.
- Lyden replaces `js/apps/records-fixture.js` and its mount call in `js/main.js`; Reconciliation does not import that adapter. Arwa replaces visual tokens/assets in `css/hilfer.css` and desktop glyphs in `index.html`. UI components can use the same store API without editing case logic.

## Registry and state API

`js/main.js` creates one store and exposes it as `window.hilfer` after loading JSON. Imported apps receive the same `store` instance.

```js
const record = hilfer.getRecord('OH-008'); // frozen registry object, undefined if unknown
hilfer.getRecords();                    // frozen array; render text with textContent
hilfer.getCases();                      // frozen case definitions
hilfer.discover(record.id);             // call when inspected; not when merely listed
const caseId = hilfer.getActiveCaseId(); // currently selected Reconciliation case
const state = hilfer.getState();        // independent snapshot; edits do not mutate store
const attached = state.attachedEvidence[caseId] ?? [];
hilfer.attachEvidence(caseId, record.id); // {ok, message}; also discovers if necessary
hilfer.removeEvidence(caseId, record.id);
hilfer.submitResolution(caseId, {
  field: 'workEligibility', value: 'NOT_CLEARED', sourceId: 'OH-008'
});
const unsubscribe = hilfer.subscribe(state => { /* refresh UI */ });
const stopEvents = hilfer.onEvent(({ type, detail }) => { /* react to milestone */ });
hilfer.resetProgress(); // also available in Start > Reset Demo Progress
```

`getActiveCaseId()` can return a locked/placeholder selection; mutations validate availability. Rejecting any mutation leaves completion/progression unchanged. Completed cases have sealed evidence and idempotent commits. Attachments alone never complete a case. Only the small canonical resolution is persisted, not arbitrary caller properties. Reconciliation includes attach-by-ID controls for keyboard access.

## Record drag contract

Resolve IDs through `store.getRecord`; never trust external record objects. Custom MIME is exported from `js/apps/shared.js`. The fixture also exports `beginRecordDrag(event, recordId)`.

```js
event.stopPropagation();
event.dataTransfer.setData('application/x-hilfer-record-id', recordId);
event.dataTransfer.setData('text/plain', recordId);
event.dataTransfer.effectAllowed = 'copy';
```

Drag cards use `draggable="true"` inside window content. Window movement listens only to title bars, excludes controls, and never cancels record dragstart. A successful drop attaches evidence; the player must still submit a supported classification/source pair.

## Progress events

Events use `store.onEvent`, not DOM CustomEvents. Subscribers receive `{type, detail}` after the updated state is saved and UI state subscribers run. No replay on load; read the current state on mount. Unsubscribe with the returned function.

| Type | detail |
| --- | --- |
| `hilfer:evidence-discovered` | `{recordId}` |
| `hilfer:evidence-attached` | `{caseId, recordId}` |
| `hilfer:case-reconciled` | `{caseId, resolution: {field, value, sourceId}}` |
| `hilfer:case-unlocked` | `{caseId, byCaseId}` |
| `hilfer:distortion-changed` | `{previousLevel, level}` |
| `hilfer:progress-reset` | `{}` |

Discovery and milestone events fire once per corresponding transition. Removing/re-attaching may emit another attachment event; removal uses ordinary state subscriptions. Reset starts a fresh progression cycle.

## Persistence and graphics

`hilfer:save:v1` stores version, discoveredEvidenceIds, attachedEvidence, resolutions, completedCaseIds, unlockedCaseIds and distortionLevel. No static record content. Loading filters unknown IDs/duplicates and derives completion/unlocks/distortion by replaying validated resolutions. Malformed/incompatible saves start clean with a visible warning; unavailable storage leaves a playable in-memory session with a warning. Keep the HTTP origin/port unchanged to share saved progress.

`css/hilfer.css` exposes `--wallpaper-clean`, `--wallpaper-distorted` (CSS image values such as `url('../assets/wallpaper.png')`), `--desktop-bg`, `--brand-ink`, `--paper` and titlebar colors. Replace desktop icon glyphs in `index.html` with licensed image assets. `data-distortion="0|1"` controls the persistent appearance; `microglitch` lasts 650ms only after a newly reconciled case. Reduced-motion disables the animation. No glitch replays on reload, rejected drops or repeated commits. CASE-002 is a labeled placeholder, not a second playable case.

Upstream snapshot in `references/WIN98-template/` remains unchanged. Root shell CSS and window-management functions adapt pollygon-dev/WIN98-template (original HTML5-Templates.com foundation); public-domain license is preserved in `LICENSE`.
