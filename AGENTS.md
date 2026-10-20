# HILFER — Repository Agent Instructions

HILFER is a browser-based investigative narrative game staged inside a fictional corporate workstation. Read `docs/PROJECT_CONTEXT.md` and `docs/DESIGN_DECISIONS.md` before making architecture, game-mechanic, or story-dependent changes. Read `docs/INTEGRATION.md` before building Records or Reconciliation.

## Working principles

- Treat **confirmed narrative premises**, **proposed gameplay**, and **unresolved design questions** as different categories. Do not silently promote draft ideas to canon.
- Preserve the foundation of `pollygon-dev/WIN98-template` where it is useful. It is plain HTML, CSS, and vanilla JavaScript; do not introduce React, Next.js, an API server, or heavy infrastructure without a concrete reason and an explicit tradeoff.
- Build a **single playable vertical slice** first: open Reconciliation, investigate Jessica's records, attach evidence from Records, commit a supported resolution, trigger one progressive anomaly, and unlock the next task.
- Records and Reconciliation are distinct applications. Records exposes records; Reconciliation owns case logic. Do not implement competing data stores or duplicate case state across apps.
- Keep static evidence/case definitions versioned in repository JSON; store only mutable player progress in a versioned namespaced `localStorage` key.
- Passing records between applications must use stable IDs, never mutable DOM references or entire JSON objects. Validate unknown/duplicate/irrelevant IDs.
- **Discovering evidence, connecting evidence, and formally reconciling a case are not the same action.** Attachments do not complete a case; completion requires a validated submitted resolution.
- Link visual distortion to meaningful milestones and make it cumulative throughout the investigation. Do not add random glitches for clicks or equate discovery directly with radiation dose.
- Maintain UI readability during ordinary investigation. Full hostile UI takeover is an endgame idea, not part of the first vertical slice.
- Preserve attribution/license notices for the upstream Windows 98 template; don't publish private third-party art or source docs without permission.
- Keep patches focused. Avoid editing your teammates' app/assets files unless needed for a clearly documented integration change. Prefer PRs over direct pushes to `main` when multiple people are contributing.

## Technical expectations

- Provide simple local run instructions and a demo reset control.
- Keep data contracts and event names documented in `docs/INTEGRATION.md`.
- Handle malformed/outdated `localStorage` data gracefully.
- Test at least: two evidence IDs attach; duplicate/invalid drops reject; correct resolution commits once; persistence survives reload; glitch transition occurs once; next case unlocks.
- Before implementing a speculative mechanic (e.g. minigames, fixed evidence counts, single conclusive footage), report its status as **unapproved** and explain its narrative/gameplay purpose.
