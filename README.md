# HILFER Workstation

HILFER is an interactive narrative investigation game built around a fictional corporate desktop OS.

This repository currently contains the **project context pack for Codex and other contributors**. The game implementation and the Windows 98 template are separate steps.

## Start here

- [AGENTS.md](AGENTS.md) — repository instructions for coding agents.
- [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — story premise, gameplay direction, immediate demo, and team responsibilities.
- [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) — current directions, explicitly unapproved ideas, and open questions.
- [docs/INTEGRATION.md](docs/INTEGRATION.md) — proposed evidence/case schemas, cross-app drag contract, progression events, and local persistence.

These documents are **working context, not final team approval or a full export of private Drive sources**. The design decisions log distinguishes agreed story direction from experimental mechanics.

## Planned technical foundation

Adapt [pollygon-dev/WIN98-template](https://github.com/pollygon-dev/WIN98-template), preserving its attribution and license. Prefer HTML, CSS, and vanilla JavaScript for the initial demo; keep static game data in JSON and store only player progress in `localStorage`.

The first planned vertical slice: find Jessica's HR and Occupational Health records in Records → attach them to CASE-001 in Reconciliation → commit the supported resolution → trigger the first persistent distortion and unlock the next case.

**Note:** This repository is public. Do not add private source documents, unapproved team art, secrets, or confidential material without permission.
