# Investigation Engine (PR 1 and PR 2)

The engine runs in vanilla JavaScript with no dependencies. It separates source inspection, explicit
inferences, immutable administrative determinations and persistent milestones. The playable Jessica demo
is unchanged; its dates, record IDs and answer are demonstration content. Nothing in either synthetic
fixture is story canon. In particular, footage showing severe injury does not establish death.

## Files and ownership

| File | Responsibility |
| --- | --- |
| `js/core/store.js` | One authoritative snapshot, validated commands, transactional publication, compatibility adapters. |
| `js/core/rules.js` | Closed schema validation, cycle rejection, pure conditions/projections and finite rule settlement. |
| `js/core/progression.js` | Historical resolution validator and v1 loading helper, legacy-definition compiler and legacy state projection. |
| `js/core/persistence.js` | Snapshot validation, verified v2 storage, original-v1 and sequential content migrations. |
| `js/core/effects.js` | Delivery harness for registered handlers, cancellation and durable acknowledgment. |
| `js/core/artifacts.js` | Catalog/source validation, authorized queries and irreversible presentation tokens. |
| `js/apps/inspection.js` | Rendered document/message/attachment and actual media-frame policies. |
| `js/apps/presentation.js` | Mounted fixed dialogue/audio/animation adapters; preserves Jessica's existing cue owner. |
| `data/progression.json` | Explicit production definition for the existing demo only. |

`main.js` loads production progression alongside the existing datasets. Callers that omit it get definitions
compiled from their existing records/cases. No demo IDs occur in the store or evaluator.
`records-fixture.js` renders through the artifact boundary, then credits its mapped logical source after
the document-presented policy succeeds. Reconciliation checks that history rather than manufacturing it.
Filing may register the displayed baseline as provenance without claiming it was inspected in Records.

## Read interfaces and state

```js
const store = createStore({records, cases, progression, storage, contentMigrations: []});
store.getSnapshot();       // deep copy of canonical v2 facts/receipts
store.getState();          // v1-shaped compatibility projection, version: 1
store.getAccess();         // effective grant IDs
store.getAvailability();   // available content IDs
store.getCompletedCaseIds();
store.evidenceForArtifact('records', 'HR-014'); // logical evidence ID, or null
```

Catalog getters return frozen definitions and remain trusted internal integration surfaces. Applications use
the authorized artifact boundary; the low-level logical command remains available to tests/legacy callers.
See [APP_INTEGRATION.md](APP_INTEGRATION.md) for the schema-2 registry, actual app policies and cancellation.

The canonical save has exactly this structure (ID-keyed entries shown as examples):

```js
{
  version: 2, contentVersion: 2,
  facts: {
    registeredEvidenceIds: [], inspectedEvidenceIds: [], attachedEvidence: {},
    inferences: { /* inferenceId: {evidenceIds: []} */ },
    determinations: { /* determinationId: {
      caseId, claimId, field, value, sourceEvidenceId,
      provenanceEvidenceIds: [], origin: 'claim' | 'legacy-api' | 'migration-v1'
    } */ },
    milestones: { /* milestoneId: {ruleId} */ }
  },
  ruleReceipts: { /* ruleId: {activationCount, conditionWasTrue} */ },
  effectReceipts: { /* serialized occurrence tuple: {
    effectId, ruleId, activation, status: 'pending' | 'claimed' | 'delivered' | 'skipped'
  } */ }
}
```

ID arrays have set semantics; inspection/registration insertion order is retained for historical consumers.
Neither report, case completion, effective access, availability nor distortion is persisted separately.
`getState()` retains the original resolutions, completed/unlocked lists and distortion fields. Its historical
post-load empty attachment lists are normalized in that view only. `deriveReport()` remains unmodified.
One explicit `legacy:true` determination per case supplies its old single-resolution projection. A new case
can have multiple individual determinations and a completion policy requiring any/all of them.

## Commands

All writes go through `dispatch({type, ...payload})`:

| Type | Payload | Meaning |
| --- | --- | --- |
| `inspectEvidence` | `evidenceId` | Record content access, after grant validation. |
| `establishInference` | `inferenceId, evidenceIds` | Explicitly accept one exact supported relationship. |
| `fileDetermination` | `determinationId, sourceEvidenceId` | File a declared value with immutable provenance. |
| `attachEvidence` | `caseId, recordId` | Legacy ID adapter; register/link without inspection. |
| `removeEvidence` | `caseId, recordId` | Remove an uncommitted legacy link. |
| `submitResolution` | `caseId, resolution` | Legacy validated administrative API; does not invent inspection. |
| `ackEffect` | `occurrenceId, status` | Claim or finish an existing effect occurrence. |
| `resetProgress` | none | Explicit fresh v2 state and existing UI reset event. |

Results contain `{ok, changed, code, message}`, with `alreadyCompleted` for repeated filings. Unknown keys,
types, IDs, unsupported sources or missing authorization reject without a partial transition. Identical
inspection/inference/filing is a no-op; conflicting inference support or filing is rejected. Legacy duplicate
attachments remain rejected. Accepted provenance includes every required source; the selected source must
be inspected for the new filing command. Additional sources must already be inspected or linked. Jessica's
baseline is linked automatically exactly as before; other required records cannot be fabricated by comparison.

Existing `discover`, `attachEvidence`, `removeEvidence`, `submitResolution`, `reconcileClaim`, `resetProgress`
methods delegate to these commands. Explicit legacy submission remains possible from validated attachments,
with origin `legacy-api`; its administrative acceptance is not proof of inspection or player understanding.

Transactions clone state, validate, settle rules, check snapshot invariants, attempt persistence, then publish
one stable state and its events. Storage failure retains in-memory play with a warning. A **delivery claim**
is the exception: it must persist successfully before a handler can run. Reentrant commands return `QUEUED`
and run after all current listeners. A throwing listener cannot prevent other consumers from being notified.

## Events

`subscribe(fn)` receives the compatible state. New integrations read `getSnapshot()` in that callback.
`onEvent(fn)` retains exactly the historical event stream (names, payloads and relative order): discovery,
attachment, case reconciliation, unlock, distortion change, reset. This avoids changing existing consumers.

`onEngineEvent(fn)` receives those events plus:

| Event | Detail |
| --- | --- |
| `hilfer:evidence-inspected` | `{evidenceId}` |
| `hilfer:inference-established` | `{inferenceId,evidenceIds}` |
| `hilfer:determination-filed` | `{determinationId,caseId,sourceEvidenceId}` |
| `hilfer:milestone-reached` | `{milestoneId,ruleId}` |
| `hilfer:access-changed` | `{addedGrantIds,removedGrantIds}` |
| `hilfer:availability-changed` | `{addedContentIds,removedContentIds}` |

Restoration emits no historical domain or presentation events. New canonical events intentionally use a
separate subscription so existing exact-sequence consumers remain compatible.

## Definition schema

Top-level required properties: `schemaVersion:1|2`, integer `contentVersion`, `evidence`, `inferences`,
`determinations`, `milestoneIds`, `grants`, `initialGrantIds`, `initialCaseIds`, `caseCompletionPolicies`,
`accessPolicies`, `availabilityPolicies`, `presentationPolicies`, `effects`, `rules`.
Schema 2 additionally requires `contentCatalog` and validates availability targets, bindings and supported
inspection policies. Schema 1 remains accepted for original callers and historical migration sources.
IDs must be unique safe strings; unknown properties and references are rejected. Array order is not a rule priority.

- Evidence: `{id,sourceGroupId,department,tags,artifacts,fields,caseIds,requiredGrantIds,retired?}`.
  Each artifact is `{app:'records'|'mail'|'footage',artifactId,inspectionPolicyId}`. A presentation can map to
  only one evidence; many presentations may share that evidence. Inspection policy IDs describe an adapter
  contract, not executable JSON. Only explicitly mapped artifacts count. Mail threads are containers; individual
  message bodies and attachments are separately inspectable. `document-open` is an explicit legacy adapter alias
  of document-presented; schema-2 definitions use the canonical name. Saved inspections are not reinterpreted.
- Inference: `{id,supportAlternatives,requires,retired?}`. Each support alternative is a nonempty exact set
  of known evidence IDs. Sources must be inspected and currently authorized. Availability never establishes it.
- Determination: `{id,caseId,claimId,field,value,sourceEvidenceIds,provenanceEvidenceIds,requires?,legacy?,retired?}`.
  Sources must contain the declared string field/value. Multiple immutable claims per case are supported;
  competing definition IDs for the same case/claim are rejected. No revisions are implemented.
- Case completion policy: `{caseId,when}`. Completing an arbitrary claim does not implicitly complete a case.
- Access policy: `{grantId,when}`. Effective grants are initial grants plus satisfied policies.
- Availability policy: `{contentId,when}`. Any future application must still recheck grants when opening content.
- Presentation policy: `{id,when,distortionLevel}`. `when` uses positive milestones/all/any only. The derived
  level is the maximum satisfied level, initially zero. Supported levels are 0 and 1, matching current artwork.
- Effect: `{id,adapter:'dialogue'|'audio'|'animation',signal}`. No arbitrary payloads, URLs, HTML or scripts.
- Rule: `{id,mode:'once'|'onRise',when,consequences,retired?}`. Consequences only reach a declared milestone
  (`{reachMilestone:{milestoneId}}`) or queue a declared effect (`{emitEffect:{effectId}}`).

Conditions have exactly one operator:

```js
{all: [condition]}                 // nonempty
{any: [condition]}                 // nonempty alternative routes
{not: condition}
{evidenceInspected: {evidenceId}}
{evidenceCount: {filter: {tagsAll?, tagsAny?, departments?}, distinctBy: 'source'|'department', atLeast: 1}}
{inferenceEstablished: {inferenceId}}
{determinationFiled: {determinationId}}
{milestoneReached: {milestoneId}}
{hasAccess: {grantId}}
```

Counts include inspected active evidence only. Filters combine by AND; tagsAny matches at least one tag,
departments matches any listed department. Distinct source counts use `sourceGroupId`, so extracts do not
count twice. Department counts count distinct source departments. Unknown filter vocabulary, empty filters'
value lists, nonpositive/fractional counts, >16 nesting or >256 nodes per condition are rejected.

## Deterministic evaluation and effects

Dependencies include milestone producers, rule conditions and access policies, even under `not`.
Direct/indirect cycles fail at definition load. Stable topological order with ID tie-breaks allows a single
producer-before-consumer pass to settle this finite language. Case completion and presentation are projections,
not producers. Rules cannot establish inferences or file determinations automatically.

`once` fires only if its activation count is zero. `onRise` fires only on false→true between stabilized states;
its prior truth and count persist. Repeated evaluation/no-op commands never repeat consequences. Milestones
remain when their old prerequisites stop being true. Access and availability may reverse; accepted history remains.

An effect occurrence key is `JSON.stringify([ruleId, activationCount, effectId])`. The harness `drainEffects(store,
handlers)` claims pending occurrences durably before invoking a supplied adapter. Handlers return true to
acknowledge accepted delivery. Failures become skipped, and interrupted pending/claimed occurrences become
skipped on reload. Reset cancels acknowledgments from earlier asynchronous deliveries. Concurrent drains
cannot claim an occurrence twice. At-most-once delivery accepts possible omissions on interruption.

The harness is mounted through fixed presentation adapters. Jessica still has exactly one existing reconciled-event
audio/microglitch path; its progression config adds no duplicate effects. Generic engine sound/animation instances
are separate from that legacy cue, so cancellation cannot stop Jessica's own transition. Assistant delivery,
notification and completed-voice receipts remain separate. Cancellation stops only a freshly delivered engine
voice cue, without marking it completed or stopping another cue that was already narrating.
No engine acknowledgment claims that a voice clip completed. Persistent unread notifications remain UI projections.

## Save and content migration

Current key: `hilfer:save:v2` (`V2_SAVE_KEY`). Original `hilfer:save:v1` (`SAVE_KEY`) is retained unchanged.
v1 discoveries become registration only. Historical valid attachments/resolutions reconstruct progress;
inspection/inferences remain empty. A migrated determination records its origin and full validated provenance.
Even v1 arriving after a later content release first uses retained content-1 validators, then upgrades sequentially.

Every definition change must bump contentVersion and supply one migration for each step, including additive
identity changes. This version discipline is developer-owned; there is no content fingerprint or remote service.
Migrations are trusted functions in versioned repo modules passed as `contentMigrations`, never JSON scripts:

```js
{
  from: 1, to: 2,
  sourceDefinition: previousProgression,
  sourceCases: previousCases,
  ids: { // optional; absent entries retain identity
    evidence: {'OLD-EVIDENCE':'NEW-EVIDENCE'},
    rules: {'OLD-RULE':'NEW-RULE'}
  },
  migrate(snapshot) { /* explicitly remap facts/references/receipts */ return {...snapshot, contentVersion:2}; }
}
```

Allowed ID-map namespaces: evidence, inferences, determinations, milestones, rules, effects, cases, claims,
fields. The supplied function performs the mapping; the manifest makes conservation auditable. The loader
rejects collisions and lost/invented inspections, lost registrations/attachments/inferences/determinations/
milestones, and lost/reactivated rule/effect receipts. Historical filed values and origins stay fixed.

Keep retired definitions or explicitly map their IDs; do not delete history. Retired evidence is unavailable
for new inspection and quantitative counts; retired inference/determination/rule definitions accept historical
facts but reject new actions/activation. Individual condition references expressly admit the retained fact;
otherwise it has no active effect. Updated prerequisites govern future commands and do not re-adjudicate history.
Retired milestone IDs and effect definitions remain in their registries for provenance and receipts.

Source-version definitions validate before transformation, target definitions validate afterward. New rules
satisfied on restore are consumed without retrospective transient cues. Migrations preserve original v2 bytes
under `hilfer:save:v2:backup:<contentVersion>` (numbered suffixes preserve distinct originals). Writes and
backups are read back for verification. Failed storage permits migrated in-memory play with warning; an
unverifiable backup blocks writes. Malformed/future v2 or missing/invalid migrations preserve the original
and block progress writes; they do not silently load older v1. Explicit reset may replace that save with fresh
v2. Reset clears UI receipts through the existing reset event; the retained v1 cannot resurrect the old game.

## Verification and remaining scope

Run `npm test`, then serve with `python scripts/serve.py --port 8080` and run the four browser checks in
INTEGRATION.md. No new test dependency is added. The only changed existing unit assertion reads the new
save key rather than the old key, preserving its original no-static-document-data guarantee.

`tests/fixtures/investigation.js` validates the technician/incomplete-footage model, 24 orders, explicit
relationships and multiple administrative claims. `tests/fixtures/calibration.json` demonstrates a completely
different investigation from JSON and public commands alone, with two application presentations of one source.
Neither fixture is loaded by the production app.

`tests/artifacts.test.js` and `tests/applications.browser.check.js` additionally validate catalog errors, granular
Mail authorization/inspection, separate attachments, real media frames, effect adapters and stale work after
revoke→regrant. Run that fifth browser suite alongside the four existing checks. Production uses schema/content
2 with an explicit identity migration from retained `data/history/` definitions. No narrative fixture is installed.

New narrative content, determination revisions, inference UI and ending mechanics remain unapproved/out of scope.
