# HILFER — Decision Log

This document prevents a brainstorm, a technical placeholder, or an AI suggestion from silently turning into a requirement. Update it when the team explicitly decides something.

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
| Demo vertical slice | Current implementation target | Jessica HR vs Occupational Health -> evidence attachment -> supported reconciliation -> first glitch -> next case. |
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
