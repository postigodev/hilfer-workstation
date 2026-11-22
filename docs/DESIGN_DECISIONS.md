# HILFER — Decision Log

## 2026-11-21 — User-approved recovered-extract documentary association

The user approved preserving Arwa's 14.375-second animation and its displayed TCR,
distinguishing it from the 27-second indexed parent, and adding independent AM-12/13
verification. Two separately inspected addenda preserve old save knowledge boundaries;
explicit E-I3 derives the timeline grant. F/G depend on observed transport, documentary
association and custody, not a visual identification of Tito or injury playback.
No corrected picture clock, missing frames, E-I2, death conclusion or ending is added.
Implementation and verification: [metadata reconciliation](SECURITY_METADATA_RECONCILIATION.md).

This document prevents a brainstorm, a technical placeholder, or an AI suggestion from silently turning into a requirement. Update it when the team explicitly decides something.

Entries describe decisions at their stated date. Current technical contracts are indexed in [README.md](README.md);
historical references to pending work do not override the later implementation-completion entry below.

## Established direction

| Topic | Current status | Notes |
|---|---|---|
| Medium | Agreed direction | Fictional corporate OS, interactive investigation; not a 3D labyrinth. |
| Incident | Current story canon | Radiological containment incident, not the older biochemical-weapon pitch. |
| Player role | Current story canon | HILFER employee assigned to Post-Incident Data Reconciliation, replacing Losurdo. |
| Narrative structure | Current story design | Seven beats; beats 2–4 interconnect nonlinearly rather than acting as chapters. |
| Theme | Current story design | Harm emerges from institutional incentives and fragmented accountabilities; no singular cartoon villain. |
| Ending | Preferred creative direction | Whistleblower confrontation, apparent send, sanitized Sent Mail, friendly AI reset. Exact mechanics unresolved. |
| Aesthetics | Current creative direction | OS grows gradually more unsettling as the player makes meaningful progress, not only at the ending. |
| Demo vertical slice | Current prototype experiment | Report starts with provisional HR-014. In Records, select an evidence field; compare current vs OH-008; file supported replacement directly -> updated report -> first glitch -> next case. |
| Storage | Prototype technical choice | Static JSON in repo, player state in versioned `localStorage`; no backend initially. |
| OS foundation | Prototype technical choice | `pollygon-dev/WIN98-template`, vanilla HTML/CSS/JS; preserve useful behaviors. |

## Proposals — NOT approved game rules

- A fixed total of five decisive evidence items or five mandatory cases.
- One footage clip as the definitive explanation of HILFER's systemic history.
- An area-capture / fishing-style AI boss minigame.
- Two separately implemented complete endings.
- All actual app names, record IDs, file paths, and UI widgets beyond those needed for the first vertical slice.
- A fully simulated AI or chatbot rather than scripted assistant behavior.
- A literal physical/radiation explanation for every visual glitch triggered by discovering information.

## Questions to resolve through prototype testing

1. Does the player *discover* a contradiction on opening two records, by selecting particular fields, by attaching evidence, or only after a formal decision? These should be distinct telemetry/game-state events even if the UI later simplifies them.
2. Are reconciliation outcomes data-validated, reversible, disputable, or constrained by corporate procedure? First demo should use an unambiguous supported correction.
3. Which discoveries trigger one-off anomalies, and which milestones increase persistent distortion? Never require a fixed ordering of the nonlinear investigation threads.
4. How does progressive distortion remain legible and useful while becoming unsettling?
5. Which essential case files and short audio/footage clips earn their production cost?
6. What precisely causes or enables the outbound message to be sanitized? Foreshadow the institutionally controlled gateway rather than relying on arbitrary AI magic.

## Approval practice

When implementing a decision that changes story or core mechanics, add a dated line here explaining **what was chosen**, **why**, **by whom/after what group discussion**, and **what remains open**. Do not mistake this assistant-authored initial log for a substitute for team approval.

## 2026-10-20 — Living report (user-approved prototype iteration)

The user requested a structured Consolidated Incident Report inside Reconciliation, derived from current attachments and committed decisions. Pending references are provisional; only valid commits create formal determinations. Source links revisit records. Jessica's eligibility decision does not adjudicate occupational causation. Later comparisons/disclosure mechanics remain unimplemented.

## 2026-10-26 — Claim-based Reconciliation (user-requested prototype iteration)

The user approved experimenting with a simpler primary gameplay loop: **inspect provisional official report → inspect sources in Records → select a claim in the document → compare claims → apply supported source directly to the report**. This replaces the *player-facing* drag/drop, paired dropdowns and Commit button in CASE-001, but keeps domain validation, the evidence registry, state, persistence and report projection.

- Starting report: HR-014 / AVAILABLE is **existing and unverified**, not a validated outcome and not a spoiler for the OH finding.
- Records: work-eligibility field itself becomes a contextual interaction. Other medical classifications remain informational.
- Reconciliation: select one of the competing sources in a compact case comparison; choosing the original entry does not complete a case. An accepted replacement automatically files the resolution, with a traceable audit of both sources.
- Distortion remains milestone-triggered and idempotent.
- Earlier drag/attach API is retained at the domain layer for compatibility, **not** as a primary gameplay requirement.
- This is an experimental interaction validated on Jessica only. More complex cases, alternative procedural choices, and deliberate player complicity remain open design questions.

## 2026-11-04 — Contextual assistant for the classroom demo (user approved)

The user approved selective integration of Altynai's assistant and short glitch audio. Assistant correspondence reacts to existing assignment/discovery/reconciliation state, without an LLM or arbitrary message advancement. A filed report produces one unread notification; opening the assistant acknowledges it, and reload/reset remain consistent. The neutral portrait has a slight distortion-level-1 treatment. No new revelations, hostile takeover, causality findings or additional playable cases are introduced. Existing documentary layouts, validation and progression remain authoritative; unused desktop apps and the large ambient recording are excluded.

## 2026-11-04 — HILFER Mail v1 (user-approved demo corpus)

The user authorized the exact five-thread/twelve-message corpus and its implementation contract. Mail is the shared Reconciliation Desk's legitimate mailbox plus authorized Corporate Archive. Reading is UI state only; HR-014 is the sole explicit Records link, with all existing Jessica validation unchanged. Sent Mail exists but is empty, with no Compose or finale implementation. The supplied timestamps, character prose and archival sequence remain demo-only proposals, not a final Incident/Losurdo chronology. No contradictory canon was added: later administrative reviews are retrospective, and the incident/reassignment dates remain unfixed. PR #4 was merged at the user's request before branching Mail from main.

## 2026-11-04 — Classic Mail UI (user-approved second iteration)

The user supplied a 1990s mail-client screenshot as the structural reference and a HILFER mockup as a palette/layout interpretation only. Mail changes from an integrated conversation preview to a folder tree/message table plus non-modal OS message windows. Single-click selects; double-click/Enter opens and marks only that message read. Several actual messages can be compared independently; outgoing actions remain disabled. Corpus, chronology, authorization, game state, Assistant and Jessica are unchanged. At this iteration's design stage, Mail v1's pending PR was not merged; the iteration branched from that implementation and was proposed to main as a new PR containing both. The current conversation-level reading contract is documented in INTEGRATION.md.

## 2026-11-21 — Investigation engine implementation completed (user approved)

The user approved the Engine Foundation specification and addendum, then the application integration design
with explicit Mail granularity, irreversible cancellation and legacy-policy compatibility. PR #7 was
squash-merged as `f9f3305`; PR #8, including final-review fixes, was explicitly authorized for squash merge
and integrated as `f8e7e8a`. The user closed the motor/engine implementation scope after those merges.

- One authoritative store separates registered/inspected logical evidence, explicit inference, independently
  identified immutable determinations and persistent milestones. Availability, access, report and distortion
  remain derived; audiovisual receipt acknowledgment is distinct from completed voice playback.
- Schema/content 2 adds a validated catalog and app presentation policies. Save v2 and the original v1 migration
  source are preserved; legacy schema-1 factory callers remain functional. Canceling presentation is irreversible
  across revoke/regrant, closure, replacement and reset.
- Only the exact authored CASE-002 demo placeholder retains a locked teaser, subject to its grants. Future
  placeholders follow normal availability. Text-attachment inspection requires ready state and actual visible,
  nonempty content; no production attachment viewer was introduced.
- Final recorded verification: 78 unit tests and five browser suites passed locally. The integration review
  records an earlier concurrent Assistant failure and subsequent isolated/sequential passes; this is not CI evidence.

No new cases, canonical evidence map, inference UI, revisions, seven-beat gameplay or ending mechanics were approved
or implemented. Future Investigation & Evidence Architecture work with the team is a separate design task;
these repository updates do not authorize Google Drive changes.
