# HILFER Workstation

A playable institutional-horror prototype inside a fictional corporate Windows 98 desktop. Reconcile Jessica's conflicting work-clearance records and observe the first workstation anomaly.

## Run

From this folder:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Open [HILFER locally](http://127.0.0.1:8080). No build or packages required. Use a modern desktop browser; keyboard users can attach evidence by ID.

Open **Reconciliation** to inspect the initial unverified personnel entry (AVAILABLE / HR-014). Then open **Records** and inspect Jessica's HR and Occupational Health forms. Select the work-clearance claim inside a document to compare it with the existing report entry. Choose **Use OH-008 in report** to file the supported correction (NOT_CLEARED). The living report updates immediately; the first glitch and next case unlock. No dragging, dropdowns, or separate Commit button are required. Reload preserves progress. **Start → Reset Demo Progress** starts over.

Only CASE-001 is playable. CASE-002 is an explicit unlocked placeholder. Clearance does not establish the cause of illness. The shell uses Arwa's graphics from Altynai's adaptation; [asset credits and provenance](assets/arwa/CREDITS.md). The personnel portrait remains a neutral placeholder.

## Checks and integration

- `node --test` or `npm test`: validation, claim flow, provisional report, progression, idempotence, persistence and reset; Node 18+.
- `tests/browser.check.js`: optional Playwright/Edge regression for document claim selection, comparison, report update, source navigation and persistence. See [integration instructions](docs/INTEGRATION.md) for setup.
- [Integration contracts](docs/INTEGRATION.md): data schemas, central store, drag IDs, events, persistence and graphics replacement.
- [Project context](docs/PROJECT_CONTEXT.md), [design decisions](docs/DESIGN_DECISIONS.md), [agent instructions](AGENTS.md).

HTML/CSS/vanilla ES modules, static JSON and localStorage. The shell adapts [pollygon-dev/WIN98-template](https://github.com/pollygon-dev/WIN98-template), based on HTML5-Templates.com. Public-domain license preserved in [LICENSE](LICENSE). The upstream snapshot in `references/WIN98-template/` is unchanged.
