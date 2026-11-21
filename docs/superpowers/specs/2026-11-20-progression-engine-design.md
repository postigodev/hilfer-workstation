# HILFER Engine Foundation — approved specification

Implemented in PR #7 (`f9f3305`). This approved design is a historical delivery record; current engine and app
contracts are indexed in [docs/README.md](../../README.md), including the completed PR #8 integration.

Approved in chat on 2026-11-20, including the Phase A addendum. PR 1 only.

## Scope and authority

Keep vanilla modules and `createStore()`. One authoritative mutable v2 snapshot:
UI → validated command → transaction → finite rule evaluation → persistent facts → delivery receipts.
No event sourcing, backend, arbitrary JSON scripts, new story content or restricted production evidence.
Records, Mail, Assistant, Report and Footage retain their demo behavior. CAM 4 playback does not inspect CAM-R03.

## Facts and projections

The save has `version:2`, `contentVersion`, `facts`, `ruleReceipts`, `effectReceipts`.
Facts contain registered and inspected logical evidence IDs, case attachment lists, explicitly established
inferences with supporting evidence IDs, individually identified immutable determinations, and milestones
with producing rule IDs. A determination contains caseId, claimId, field, value, sourceEvidenceId,
provenanceEvidenceIds and origin (`claim`, `legacy-api`, `migration-v1`).

Evidence identity is independent of presentation. Definitions associate evidence with `{app, artifactId,
inspectionPolicyId}`. Only explicitly mapped artifacts can report inspection. Source groups prevent counting
two extracts twice. Opening ordinary mail is not evidence. Inspection never establishes inference or filing.

`getSnapshot()` exposes cloned v2 facts. `getState()` retains the historical v1-shaped projection;
`getAccess()` and `getAvailability()` expose derived permissions/content. `deriveReport()` stays derived.
CASE-001 maps to its existing workEligibility determination. Multiple determinations may belong to one case;
a declarative completion policy defines which facts complete it. Existing source IDs are projected back to Records IDs.

## Definitions and commands

Repo JSON defines evidence, inferences, determinations, milestones, rules, effects, grants, access,
availability, case completion and presentation policies. Legacy definitions can be adapted for callers
that omit a progression definition. The production demo explicitly loads its progression JSON.

Commands: inspectEvidence(evidenceId), establishInference(inferenceId,evidenceIds),
fileDetermination(determinationId,sourceEvidenceId), attachEvidence, removeEvidence, submitResolution,
ackEffect(occurrenceId,status), resetProgress. Dispatch returns ok, changed, code, message.
Legacy methods remain adapters. `discover(recordId)` explicitly inspects; filing/attachment register only.
`presentClaim()` must not manufacture inspection. Identical facts are idempotent; conflicting filings fail.
Legacy duplicate attachment rejection is preserved. Unknown properties/types/IDs fail without mutation.

## Conditions and execution

Closed operators: all, any, not, evidenceInspected, evidenceCount, inferenceEstablished,
determinationFiled (by determinationId), milestoneReached, hasAccess.
Counts use inspected evidence with tagsAll/tagsAny/departments filters (AND between filters),
distinctBy source or department, integer atLeast >= 1. Conditions have one operator, depth <= 16,
nodes <= 256, nonempty boolean lists. References and filter vocabularies are validated.

Inferences require an exact declared support alternative of inspected sources and a `requires` condition.
Rules cannot establish inferences. Rules are once or onRise, consequences only reachMilestone or emitEffect.
Build a dependency graph through milestone and grant producers; reject cycles, including negated dependencies.
Evaluate deterministically to stability, topological dependencies with ID tie breaks. Reject the whole
transaction on evaluation errors. Milestones persist; access and availability are recomputed and reversible.
One-time receipts and rising-edge state persist. Reentrant commands queue behind current publication.

Presentation policies use positive milestone conditions only and integer supported distortion levels;
distortion is max(0, satisfied levels). They change appearance only. Jessica's existing reconciled event
remains its sole microglitch/sound delivery path; no duplicate engine effect is configured.

## Save and delivery semantics

Use hilfer:save:v2; retain hilfer:save:v1. Validate v1 historically, preserve valid attachments and
determinations/provenance, copy discoveries to registration, never to inspection; no inferred comprehension.
Reconstruct progress and mark historical effects consumed. Preserve existing Assistant/Mail UI receipts.
Restore without historical domain events. Pending/claimed transient effects from prior sessions become skipped.
Occurrence identity is the serialized tuple [ruleId,activation,effectId]. Claim is saved before presentation;
acknowledgment delivered/skipped is validated. Delivery is at-most-once across reload, allowing omissions
on interruption; existing Assistant voice completion remains independent. PR 1 tests simulated delivery only.

Every content version change needs a declared sequential migration, including additive identity migrations.
Migrations carry source definitions/validators, operate on copies, explicitly map IDs and receipts, retain
retired historical definitions/facts and never present effects. New satisfied rules during restoration are
consumed without retrospective transient effects. Changed prerequisites govern future commands, not accepted
historical facts. Unknown/future v2 or missing migration blocks writes and preserves the original; no silent
fallback to stale v1. Verify migration write/read before adoption, preserve original backup. Reset explicitly
writes an empty v2 so v1 cannot resurrect. Blocked storage permits in-memory play with warning.

## Incremental delivery and acceptance

PR 1: engine, validated definitions/commands, v2 persistence/migrations, logical evidence, individually
identified determinations, milestone-derived distortion, receipts, deterministic fixtures/tests, minimal
Records/Reconciliation compatibility edits, docs and four existing browser checks. No dynamic Mail grants
or full cross-app authorization/presentation wiring. No restricted production content during that interval.

PR 2 (not authorized): cross-app adapters, consistently filtered application surfaces, Mail setGrants wiring,
revocation UI and narrative effect adapters. No new narrative is approved by either technical contract.

Preserve all 31 baseline tests. Add 24 discovery permutations; counts and source groups; explicit inferences;
multiple determinations; new definition-only investigation; once/rising rules; chains/cycles; access failures;
malformed schemas and references; v1/v2/content migration/reset; interruption/receipts; distortion restoration.
Browser checks: browser.check, assistant.browser.check, mail.browser.check, theme.browser.check.
Synthetic maintenance technician footage proves severe injury, never death. Keep all relationships in fixtures.
Open a feature PR against main, report actual results and limitations; never merge or begin PR 2 automatically.
