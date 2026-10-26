# HILFER Workstation

A playable institutional-horror prototype inside a fictional corporate Windows 98 desktop. Reconcile Jessica's conflicting work-clearance records and observe the first workstation anomaly.

## Run

From this folder:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Open [HILFER locally](http://127.0.0.1:8080). No build or packages required. Use a modern desktop browser; keyboard users can attach evidence by ID.

Open **Reconciliation**, select **CASE-001**, then open **Records**. Inspect and drag HR-014 and OH-008 into the evidence tray. Commit the supported work-eligibility determination and authoritative source. Reload preserves progress. **Start → Reset Demo Progress** starts over.

Only CASE-001 is playable. CASE-002 is an explicit unlocked placeholder. Clearance does not establish the cause of illness. The shell uses Arwa's graphics from Altynai's adaptation; [asset credits and provenance](assets/arwa/CREDITS.md). The personnel portrait remains a neutral placeholder.

## Checks and integration

- `node --test` or `npm test`: validation, progression, idempotence, persistence and reset; Node 18+.
- `tests/browser.check.js`: optional Playwright/Edge regression, including native record drags and window controls. See [integration instructions](docs/INTEGRATION.md) for setup.
- [Integration contracts](docs/INTEGRATION.md): data schemas, central store, drag IDs, events, persistence and graphics replacement.
- [Project context](docs/PROJECT_CONTEXT.md), [design decisions](docs/DESIGN_DECISIONS.md), [agent instructions](AGENTS.md).

HTML/CSS/vanilla ES modules, static JSON and localStorage. The shell adapts [pollygon-dev/WIN98-template](https://github.com/pollygon-dev/WIN98-template), based on HTML5-Templates.com. Public-domain license preserved in [LICENSE](LICENSE). The upstream snapshot in `references/WIN98-template/` is unchanged.
