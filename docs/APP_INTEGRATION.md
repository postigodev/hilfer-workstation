# Application authorization and inspection (PR 2)

**Status:** implemented and squash-merged through PR #8 (`f8e7e8a`). This is a current contract reference;
the [verification report](APPLICATION_INTEGRATION_REVIEW.md) preserves its test and review history.

The engine remains authoritative. Applications present approved content; neither opening a container nor
receiving a DOM announcement is proof of inspection or player comprehension. Production content is unchanged.

## Schema and migration

Production progression uses schemaVersion 2 / contentVersion 2. Saves remain `hilfer:save:v2`. Original schema-1
definitions still validate, including `createStore()` without explicit progression. The bootstrap supplies an
identity content-1→2 migration with the actual prior definitions/cases retained in `data/history/`. Original v1
discovery is still only registration, not inspection; accepted v2 inspections, filings and receipts stay accepted.

Schema-2 `contentCatalog` entries:

```js
{id:'CASE-002',kind:'case',caseId:'CASE-002',requiredGrantIds:[]}
{id:'record:OH-008',kind:'artifact',app:'records',artifactId:'OH-008',artifactType:'document',requiredGrantIds:[]}
{id:'mail:MAIL-010',kind:'artifact',app:'mail',artifactId:'MAIL-010',artifactType:'message',requiredGrantIds:[]}
```

Mail artifactType is thread, message or attachment. Records uses document; Footage uses media. IDs and bindings
are unique. Every availability policy target and evidence artifact must exist. Bootstrap also validates bindings
against the actual supplied sources and checks Mail grants against the central registry. Unknown source IDs,
duplicate bindings, message/thread mismatches or unsupported inspection policies fail before apps mount.

Content without an availability policy is unrestricted by progression, but still requires its grants. Cases
have explicit catalog entries. A narrow compatibility check for the exact demo ID CASE-002 retains its authored
placeholder presentation while locked, still subject to grants. placeholder:true alone never grants visibility
to another case. Restricted cases and source metadata are filtered. Historical retired definitions may remain
for save provenance but cannot be opened or newly inspected.

## Shared boundary

`createArtifacts({store,records,emails,mail,footage,policies})` creates a small runtime boundary. It owns no
progress facts, only immutable source identity mappings, subscribers and pending cancellation tokens.

- `canOpen(app,id)` and `get(app,id)` deny unknown/unavailable IDs uniformly. An attachment getter returns
  the authorized attachment itself, not its parent message.
- `listRecords()` filters before search, counts or department folders. Record objects come from the frozen
  store registry. `caseVisible(id)` filters report/register entries while preserving the existing placeholder.
- `begin(viewer,app,id)` cancels the viewer's previous operation and authorizes a new presentation.
- `complete(token,presentation)` evaluates the registered policy, then checks authorization and token identity
  again before dispatching logical inspectEvidence. `present()` combines begin/complete.
- `cancel(viewer)` and `cancelAll()` permanently abort those operations. `subscribe(fn)` refreshes affected views.

Grant/availability changes invalidate pending operations before refreshing apps, even if access is restored
immediately afterward. Selection, replacement, close/minimize and reset also cancel their relevant tokens.
Tokens are in-memory AbortControllers, not saved capabilities. Reopening starts a fresh operation; a canceled
completion never becomes valid again. Rendering errors, missing content and unsatisfied policies credit nothing.
This is correctness for a local static game, not a browser anti-tamper security boundary.

## Actual policies and app routes

| Policy | Requirement |
| --- | --- |
| document-presented | Connected, visible rendered record article with the expected artifact ID. |
| message-body-presented | Its own open message details and visible body in an authorized reader. |
| attachment-presented | Matching ID, explicit ready state and a visible, nonempty rendered text-content child. |
| media-frame-presented | A real advancing decoded playback frame, not paused, in a visible authorized player. |

Original schema-1 `document-open` explicitly resolves to document-presented at the adapter boundary; schema-2
definitions use the canonical policy name. This changes new app presentation, not saved inspection history.
Native media-frame callbacks are used where supported, with a decoded advancing timeupdate fallback. Neither
policy establishes that the player understood or watched the complete content. Footage proving injury never
automatically proves death. The actual CAM 4 preview is unmapped and never inspects CAM-R03.

Records credits after rendering, not while listing or before replacing preview content. Report/Reconciliation
source links recheck access. Report findings and provisional official assertions remain facts even when their
sources become unavailable; source labels/links use a generic unavailable reference, not restricted metadata.

Mail retains **one** authorization model: its existing thread-grant filter. The model additionally accepts
availability/reference predicates, so list/search/counts/lookups/readers use the same filtered projection.
Main passes centrally derived grants and updates them through setGrants(). No second thread authorization
implementation is introduced. Restricted readers close, and partly restricted readers lose hidden messages.
Opening a thread may mark its existing UI receipts read, as before, but does not inspect all messages.
Only mapped, actually expanded message bodies count. A parent message never credits a separate attachment.

There are no authored attachments or attachment viewer in the current production corpus. The attachment policy
and independent identity/getter are executable and tested with an injected synthetic presentation; adding an
actual narrative attachment/viewer remains a separately authored content task. No definitive inference UI is added.

The minimal text-attachment contract is `data-attachment-id` on the presentation root,
`data-attachment-state="loading"|"error"|"ready"`, and a child marked `data-attachment-content`.
A renderer must keep loading during fetch/render, set error on failure, and set ready only after successful
content population. The policy independently rejects a missing/empty/whitespace-only or hidden content child,
even when the root claims ready. A loading/error root never counts, including when it displays spinner/error
text. A completed load starts a fresh authorized presentation operation. This contract does not claim readiness
for binary/image-only attachments; those need an explicit resource-specific policy if a real viewer is approved.

## Effect ownership

The mounted presentation module binds authored Assistant signals, the existing glitch asset and the existing
microglitch animation. Unknown signals skip rather than load arbitrary assets. Receipts still distinguish
presentation acceptance from voice completion. In-flight engine work cancels on reset/access/availability changes.

Jessica's legacy reconciled-event cue remains its sole configured audio/animation owner. Engine cue playback
has its own Audio instance and animation class, so invalidating generic effects does not truncate that cue.
Assistant delivery/read/voice-completion keys stay intact. Canceling a queued engine voice never stops another
cue already narrating or falsely records a completed voice. No new dialogue, sounds or narrative effects are authored.

## Checks

Run `npm test` and all five browser scripts documented in INTEGRATION.md. Original migration tests retain
their original schema-1/content-1 fixtures; new tests additionally validate current content-2 migration. The
existing Mail browser restriction fixture now declares its synthetic grant and catalog entries, retaining
all original denial/search/count/revocation assertions. No guarantees are removed.

Only test fixtures add cross-app evidence relationships or restricted artifacts. Drive documents, canonical
cases, actual story evidence maps, inference UI, revisions and ending mechanics remain outside this PR.
