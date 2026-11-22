<p align="center"><img src="assets/arwa/logo.webp" alt="HILFER" width="152"></p>

# HILFER Workstation

HILFER is a browser-based institutional-horror investigation set inside a fictional corporate Windows 98 workstation. Inspect contradictory departmental sources, decide what belongs in the official incident report, and watch the desktop react.

[Play locally](#run-the-demo) · [Current scope](#current-scope) · [Engine](#investigation-engine) · [Documentation](docs/README.md)

## Current scope

The investigation engine and application integrations are implemented and merged into `main`: [Engine Foundation #7](https://github.com/postigodev/hilfer-workstation/pull/7) and [Application Integration #8](https://github.com/postigodev/hilfer-workstation/pull/8).

This development branch stacks the corpus from PR #10 with the Security work in issue #11.
Jessica and both independent Security archive routes are playable. Recovery 03 and lineage
definitions remain blocked in production pending reconciliation of the delivered video's
clock with the canonical interval. CASE-002 remains a placeholder; ending mechanics are
not implemented. See the [Security audit](docs/SECURITY_INTEGRATION.md).

## Run the demo

Requires Python 3 and a modern browser. From the repository root:

```sh
python scripts/serve.py --port 8080
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). The demo runs on local HTML, CSS, vanilla JavaScript and JSON, with no build step or runtime packages. If the port is in use, pass a different port and open the matching URL. Saves are local to the browser and origin.

> [!TIP]
> Keep the same host and port to resume a save. Use **Start → Reset Demo Progress** for a fresh playthrough.

## What to try

| App | What it does |
| --- | --- |
| **Reconciliation** | Opens the Consolidated Report with a provisional claim. Inspect Jessica's clearance in Records and select **Compare status with report** to compare sources. **Update report** files an accepted correction. |
| **Records** | Browse HR and Occupational Health files, inspect the source fields, and open the comparison from the record itself. |
| **Mail** | Double-click a conversation or press Enter to open its reader. Browse Inbox and Archive, search correspondence, and move threads to Deleted Items or restore them. One message links to Records. Sent has no outgoing mail in this demo. |
| **HILFER Assistant** | The portrait sits above the taskbar. New dialogue opens a balloon without moving keyboard focus. The portrait also opens it manually. If the browser blocks automatic narration, it waits for the first interaction. |
| **Footage** | Preview remains non-evidence. On this development branch, completing Security opens a recovered clip for review; unresolved date/identity joins keep later narrative access blocked. |
| **Display Properties** | Switch between Standard and Archive / Graphite or toggle the desktop logo treatment. |

Start with **Reconciliation → Consolidated Report**, then inspect relevant source fields in Records. Choosing the initial source leaves the discrepancy unresolved. Filing a supported correction updates the report, unlocks CASE-002 and triggers one audiovisual anomaly. Reload preserves progress; the clearance decision does not establish occupational causation. Footage's CAM 4 preview creates no narrative evidence.

## Investigation engine

```text
UI action → authorized artifact presentation → validated command
          → authoritative state → rule evaluation → consequences and effects
```

Evidence inspection, explicit player-established inferences, official determinations and persistent milestones are separate facts. Logical evidence IDs work across applications; reading enough files never automatically establishes an inference. Cases can contain multiple determinations and progress through declarative alternative routes.

The engine validates catalog references and access, rejects rule cycles, and cancels stale presentation operations after revocation, replacement or reset. Mail retains its thread-level authorization and separate UI receipts; only mapped, presented message bodies or attachments count as evidence.

Progress uses `hilfer:save:v2`. Explicit migration preserves valid v1 progress without inventing inspection history. The report, effective access and distortion remain derived projections. Transient effect receipts prevent historical cues replaying on reload.

| Location | Responsibility |
| --- | --- |
| `js/core/` | Authoritative store, commands, rules, saves, artifact authorization and effect receipts. |
| `js/apps/` | Application UI, inspection policies and presentation adapters. |
| `data/` | Authored corpus, media catalog and schema-2/content-4 progression definitions. |
| `data/history/` | Original definitions retained for migration validation. |
| `tests/` | Unit checks and browser regressions; additional relationships exist only in synthetic fixtures. |

## Checks

Use **Node.js 24**, the verified test runtime, for unit checks:

```sh
npm test
```

The final engine verification recorded **78 unit tests and five browser suites passing locally**, not a GitHub CI run. Browser checks require Playwright and Microsoft Edge plus the running local server. Run them sequentially; setup, all five commands and the recorded Assistant concurrency failure are covered in the [integration guide](docs/INTEGRATION.md#run-and-checks) and [verification report](docs/APPLICATION_INTEGRATION_REVIEW.md).

The issue #11 branch additionally verifies 98 Node tests, Python range responses, and
`node tests/security.browser.check.js`. Current results and known editorial blockers
are recorded in the [Security verification](docs/SECURITY_INTEGRATION.md#verification).

## Documentation

| Guide | Read it for |
| --- | --- |
| [Documentation index](docs/README.md) | Current guides, completed implementation records and remaining scope. |
| [Integration contracts](docs/INTEGRATION.md) | Local setup, app interfaces, signals and browser checks. |
| [Engine reference](docs/ENGINE.md) | State, commands, condition language, persistence and migration. |
| [Application integration](docs/APP_INTEGRATION.md) | Catalog validation, authorization, inspection readiness and cancellation. |
| [Project context](docs/PROJECT_CONTEXT.md) / [decisions](docs/DESIGN_DECISIONS.md) | Working narrative premises, approved technical decisions and unresolved mechanics. |

Template, icons, typography and team artwork are documented in [credits](CREDITS.md) and [artwork provenance](assets/arwa/CREDITS.md).
