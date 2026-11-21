# HILFER PR 2 — authorization and application integration

**Status: APPROVED for implementation, including the three clarifications below (2026-11-21).**

Implemented and squash-merged in PR #8 (`f8e7e8a`), including final-review corrections. This specification records
the approved design; use [APP_INTEGRATION.md](../../APP_INTEGRATION.md) for the current contract and readiness details.

Base: main `f9f3305c8f33f4e7fa14818b5796d0efae99ff32`, the squash merge of PR #7.
The user authorized preparing this specification after final interactive Jessica acceptance. It incorporates
the two review findings: availability targets need a real registry; inspection policy IDs need executable
application adapters. This document proposes technical contracts, not narrative evidence or inference design.

## Existing behavior and scope

At the start of this design, PR 1 owned logical evidence, explicit inferences, independent immutable determinations, milestones, derived
access/availability/presentation and validated persistence. Its 61 tests and original four browser suites
must retain their guarantees. Jessica remains the single playable case. Mail has authorization internally
and setGrants(); Assistant owned delivery/read/voice receipts; the effect harness was not yet mounted. The
completed integration now mounts it as described in the current application contract linked above.

PR 2 will consistently authorize application presentation and connect supported artifacts to logical inspection.
It will not add canonical cases, dialogue, restricted production evidence, inferred death from injury,
an inference workbench, determination revisions, a graph/chatbot, ending mechanics or Drive documents.

## Approaches

1. **Recommended: one small artifact integration boundary plus existing app models.** A catalog validates
   content identity; shared queries authorize; registered adapters render and report policy satisfaction.
   Mail keeps its internal filtering and receives centrally derived grants. This centralizes the contract
   while preserving each app's existing presentation and receipts.
2. **Implement checks independently in every app.** Smaller first edits, but listing/search/open/inspection
   can disagree, and policy logic is likely to drift. Not recommended.
3. **Use DOM events as proof of inspection.** Easy wiring but events can precede rendering, outlive reset,
   or bypass current access. Events remain notifications, not authoritative inspection proof. Not recommended.

## A. Explicit content registry

Add required `contentCatalog` to progression definitions. Entries have stable unique `id` and one binding:

```js
{id: 'CASE-002', kind: 'case', caseId: 'CASE-002'}
{id: 'record:OH-008', kind: 'artifact', app: 'records', artifactId: 'OH-008'}
```

These examples identify existing demo objects only. Mail and Footage content entries also bind actual existing
artifact IDs, without automatically associating them with narrative evidence. Logical evidence continues to
be a separate registry. One artifact may map to zero or one evidence; several artifacts may map to one evidence.

At bootstrap validate:

- Every availabilityPolicies.contentId exists in contentCatalog; syntactically valid typos fail startup.
- Every case binding exists in the case definitions. Every artifact binding resolves in the supplied app corpus.
- Every logical evidence artifact resolves to exactly one catalog binding. Reject ambiguous/duplicate bindings.
- Every required grant and inspectionPolicyId is declared and supported by the registered adapter for that app.
- Retired historical bindings remain available to migration validation, but not new presentation or inspection.

Content registry validation does not copy message bodies, Records fields, media data or read receipts into state.
Static definitions stay versioned JSON. Unknown definitions fail before mounting applications; malformed player
saves continue to use the existing preservation/write-blocking behavior.

Availability remains derived. A catalog entry without an availability policy has no progression restriction;
required grants still apply. A policy-controlled entry is available only when its condition is satisfied, except
for an explicitly initially unlocked case. Existing CASE-002 can retain its authored locked-placeholder label;
that demo exception must not expose metadata of restricted evidence or messages.

## B. One authorization boundary across surfaces

Add a small `js/core/artifacts.js` integration module; do not create another store or general workflow layer.
It consumes the store, validated catalog and fixed registered application adapters. It provides app-facing
authorized list/search/lookup/open queries and artifact-to-evidence resolution. Catalog getters remain internal.

The effective permission to present an artifact requires: known active binding, satisfied availability and
required grants. Inspection additionally requires its explicitly mapped evidence and the evidence grants.
Listing/search/counts must filter first; no title, snippet, attachment name, department count or reference label
from a restricted object may leak. Unknown and unauthorized direct IDs return the same public unavailable result.

All routes use this boundary: Records folders/search/keyboard selection; Mail lists/search/counts/readers and
reference links; Report source links; Footage selection; direct integration entry points. Store commands remain
the final domain check. An inspected source does not grant continued access after revocation.

On access change, clear restricted selections/previews, close affected Mail readers, stop affected media and
remove restricted results. Retain accepted historical facts. A source reference in a filed report may retain
the fact of its provenance, but must not expose newly restricted source metadata/body. Display a generic
unavailable reference rather than resolving restricted content. No real restricted production content is added
as part of proving these behaviors; restrictions use injected synthetic fixtures.

## C. Executable inspection policies

The adapter path is:

```text
openArtifact(app, artifactId)
  → authorize catalog binding
  → present content through its registered app adapter
  → observe the declared inspection policy
  → recheck current authorization and session/reset generation
  → dispatch inspectEvidence(evidenceId)
```

Only imported, registered adapter functions implement policies. No scripts in JSON and no caller-selected
policy override. Failed rendering, missing assets, canceled loading, reset or revoked permission must not create
inspection. Stale asynchronous completions cannot inspect an artifact in a new session or after revocation.
Use a small in-memory generation counter/cancellation mechanism, not persistent observation tokens or event sourcing.

Proposed policy meanings:

- **document-presented:** the selected authorized document has successfully rendered its content. Listing a
  record or opening an empty Records window does not count. Use this for the existing two Records sources.
- **message-body-presented:** an explicitly evidence-mapped message body is rendered/expanded in an authorized
  reader. A conversation row or collapsed summary is insufficient. Ordinary mail keeps UI receipts only.
- **attachment-presented:** an explicitly mapped attachment has opened successfully; reading its parent email
  does not count. No new attachment corpus or viewer is required for the current demo.
- **media-frame-presented:** an explicitly mapped media item presents an actual playback frame in a visible
  authorized viewer. Opening a window, loading metadata or showing a poster is insufficient. This means access
  to content, not watching an entire recording, understanding it or establishing an inference.

Keep the low-level inspectEvidence command as a trusted engine API for deterministic tests and compatibility.
Do not claim browser-side adapters constitute an anti-tamper security boundary: this is a local static game.
Production UI routes must use the integration path rather than calling the logical command prematurely.
The CAM 4 preview remains unmapped evidence and never registers CAM-R03 inspection or grants its access.

## D. Mail and presentation integration

Progression supplies the one effective grant set. Declare the existing Mail grant names/initial values in the
progression definition, preserving today's visible corpus. Keep corpus.initialGrants as the legacy standalone
Mail-model default, validate its consistency at bootstrap, and pass store.getAccess() to the mounted Mail model.
On changes call its existing setGrants(); do not reproduce the model's internal message authorization logic.
Reading/deleting/restoring mail remains UI state in hilfer:mail-ui:v1 and does not establish inference or filing.

Mount the existing effect harness after applications are ready; bind only known dialogue/audio/animation
adapters. Preserve Assistant delivery, unread and voice-completion receipts. Engine delivery acknowledgment
means presentation was accepted, not that narration finished. Reset/revocation cancel stale work; autoplay retry
remains the voice adapter's responsibility. Durable notification visibility derives from facts plus read receipts.

Do not configure new canonical effects. Jessica keeps one presentation owner: its existing case-reconciled
handler for the short glitch and audio. Do not also add an engine occurrence for that same cue. Prove the generic
mounted adapter route through synthetic browser fixtures, while preserving the production demo signals.

## E. Versioning and delivery plan

Adding a required registry is a schema change: bump definition schemaVersion to 2 and contentVersion to 2.
Retain a small explicit schema-1 normalization/validation path for original content and migration source
definitions. The save envelope remains version 2: its facts and receipts do not need a new shape.
Supply the content-1→2 identity migration with historical schema-1 definitions/cases; do not invent inspection
or reactivate receipts. Registry additions and Mail grant declarations are static; grants stay derived.
Tests for older content versions, future saves and lossy migrations must continue to pass.

Implementation order, after approval:

1. Catalog and supported-policy validation, schema compatibility and explicit content migration.
2. Small shared authorization/open boundary, cancellation and synthetic adapters.
3. Records/Reconciliation/Report routes, then Mail grants/readers/references, then Footage policy support.
4. Presentation harness adapters without duplicate Jessica effects.
5. Documentation, all existing tests and synthetic end-to-end authorization/inspection tests; open PR 2 without
   merging. Do not design real investigations or an inference UI in that implementation.

## Acceptance criteria

- Loader rejects unknown availability targets, nonexistent bindings, unsupported policy IDs and duplicate maps.
- Unauthorized synthetic objects are absent from list/search/count/reference results and cannot open/inspect
  through direct IDs. Revocation closes readers/previews and stops media without erasing accepted history.
- Authorized render success records only the mapped logical evidence, once. Failed/canceled/stale presentation
  records nothing. Two applications can present the same evidence without double-counting.
- Ordinary email, collapsed messages, attachment parent mail, posters/metadata and the CAM 4 preview create no
  unintended evidence. Synthetic media inspection still proves no death or inference.
- Availability of sources never auto-establishes an inference; inference UI remains out of scope.
- Reload preserves accepted facts and unread notifications, without repeating old transient effects. Reset
  cancels pending adapters and permits a new playthrough. Assistant voice receipts and playback are preserved.
- Jessica provisional comparison, supported filing, provenance, placeholder unlock and one audiovisual cue
  remain unchanged, including keyboard/mobile use. All 61 existing tests and four browser suites pass.
- New synthetic browser tests cover grant/revoke, direct links, asynchronous rendering, mapped Mail/media,
  effects, storage failure, reload/reset and receipt migration. Production narrative datasets remain unchanged.

## Required implementation clarifications

- Mail threads are navigation/authorization containers. Individually mapped messages are inspectable only
  when their own body is presented; attachments have separate identities and presentation. Thread opening
  never credits all its messages. Keep thread authorization in the existing Mail model.
- Each pending presentation has an irreversible cancellation token. Revoke, availability loss, close,
  selection change, content replacement and reset invalidate it. Regrant never rehabilitates an old token;
  test revoke → regrant → old completion, then a fresh successful open.
- Preserve schema-1 `document-open` through an explicit alias to document-presented at the adapter boundary.
  Original source definitions remain valid for historical migrations and createStore() without explicit
  progression continues to compile the legacy schema. Saved inspections are retained as accepted history.

## Approval boundary

Requested review decisions: the explicit catalog and schema-2 compatibility path; uniform app authorization;
the four inspection policy meanings (especially frame access versus full review); preservation of Jessica's
current effect owner. The user approved these choices and authorized PR 2 only, on a feature branch with
tests and a reviewable PR; no automatic merge, narrative additions, inference UI or Drive changes.
