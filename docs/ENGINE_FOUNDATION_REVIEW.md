# Engine Foundation — implementation review

PR 1: [review pull request #7](https://github.com/postigodev/hilfer-workstation/pull/7),
branch `codex/progression-engine-foundation`, based on verified main
`39c750017daea2ba3116d5bfa896c8cbbf4e73da`. Implementation authorized by the approved Phase A addendum.

## Result

An investigation can now be defined without editing store.js or rules.js. The independent
`tests/fixtures/calibration.json` investigation uses different case/evidence/claim/milestone IDs, has two
application presentations of one logical source, and completes through the public inspection and filing APIs.
`tests/engine.test.js` executes it directly; the technician fixture separately covers 24 discovery orders,
explicit relationships, quantitative departmental conditions and multiple determinations in one case.

## Actual verification

| Check | Result |
| --- | --- |
| `npm test` | **61 passed, 0 failed, 0 skipped**: all 31 original tests plus 30 engine/persistence tests. |
| `node tests/browser.check.js` | PASS: Jessica comparison/filing/report, v2 inspection guard, glitch once, persistence/reset, Footage, desktop/mobile and OS window behavior. |
| `node tests/assistant.browser.check.js` | PASS: automatic/manual correspondence, focus/dismissal, notification, portrait, audio once, reload/reset and mobile. |
| `node tests/mail.browser.check.js` | PASS: conversations/readers/search/receipts, Records navigation and Jessica, authorization fixtures, storage fallback and mobile. |
| `node tests/theme.browser.check.js` | PASS: artwork and theme switching, Jessica/reload, distortion and mobile; no missing assets or JavaScript errors. |
| `git diff --check` | PASS. |

Browser checks used the existing static server at localhost:8080, Microsoft Edge headless, and the bundled
playwright-core module selected with HILFER_PLAYWRIGHT_MODULE. No repository dependency was added.
Desktop report, mobile Assistant and Mail-reader screenshots were inspected. No environment limitation
prevented the agreed checks.

Tests initially exposed compatibility and restoration errors that were corrected: legacy event listeners
received new engine events; an old assertion read the superseded save key; canonical facts gained empty
lists on reload; a lossy content migration could pass structural validation; and an old asynchronous effect
could acknowledge a post-reset occurrence. The final suite includes regression coverage for these behaviors.
The legacy test's only structural change reads V2_SAVE_KEY for its unchanged no-static-source-data assertion.

## Compatibility and decisions

- The original report projection and authored narrative datasets are unchanged. Jessica still compares HR-014
  with OH-008, files the same supported correction, links sources, unlocks only the existing placeholder and
  produces one existing transient audiovisual transition. Appearance now derives from a persistent milestone.
- Mail, Assistant, voice receipts, Footage, theme/artwork and UI persistence implementations are unchanged.
- `getState()` remains the old v1-shaped view; `getSnapshot()` owns v2 facts. Registration, inspection,
  inference and administrative filing are distinct. Legacy submission remains an explicitly identified API
  origin and does not manufacture inspection history.
- `onEvent()` keeps its exact historical stream; `onEngineEvent()` adds logical inspection, inference,
  individual determination and milestone/access/availability notifications. This is a compatibility adaptation,
  not a second state store.
- v1 is retained. Content migrations validate with historical definitions, conserve facts/receipts and reject
  ID collisions or unsupported changes. Missing/future/incompatible v2 blocks writes instead of silently
  replacing progress. New effects do not fire retrospectively during restoration.
- The engine/effect contract is framework-free. Rule producers are acyclic and settle in deterministic
  topological order. No implicit inference, canonical cases, restricted production evidence or scripts in JSON.

## Changed files

| Area | Paths |
| --- | --- |
| Core | js/core/store.js, rules.js, progression.js, persistence.js, effects.js |
| Existing demo wiring | js/main.js, js/apps/reconciliation.js |
| Production definitions | data/progression.json (existing demo content only) |
| Verification | tests/engine.test.js, tests/persistence-v2.test.js, tests/fixtures/investigation.js, tests/fixtures/calibration.json; minimal additions to browser.check.js and save-key adaptation in game.test.js |
| Documentation | docs/ENGINE.md, docs/INTEGRATION.md, this report, approved spec and implementation plan under docs/superpowers/ |

No assets, upstream notices, authored Mail/Assistant prose, Google Drive documents or reference artwork were
modified. The preexisting untracked references/win98-icons directory is excluded from commits.

## Limits and deferred work

PR 2 is not implemented: consistent authorization across app listing/search/open surfaces; dynamic Mail grants
and revocation; Mail/Footage inspection adapters; production effect-dispatcher mounting and integration tests.
PR 1 therefore adds no real restricted content. Registry getters remain internal unfiltered catalog APIs.

Also deferred: inference UI, determination revisions, actual narrative evidence maps, future canonical cases
and ending mechanics. The engine only recognizes the currently rendered distortion levels 0 and 1. Supporting
additional levels requires corresponding presentation work. At-most-once transient delivery can omit a cue
on interruption; it does not guarantee completed playback. Content-version increments and migration manifests
are repository maintenance responsibilities, not inferred automatically from changing file contents.

## 2026-11-21 — final acceptance and follow-up requirements

The user authorized squash merge after a final interactive Jessica check, and authorized PR 2 specification
only. No PR 2 implementation or narrative design is authorized by that instruction.

Final interactive check on the PR branch: opened the provisional report, opened OH-008 in Records, compared
it with HR-014, selected Update report, and observed the filed NOT_CLEARED entry with unchanged causation.
The actual glitch audio element was playing after filing (currentTime 0.133183, paused false). After reload
the filed report persisted, the notification remained, and the cue was stopped at time zero. Reset restored
the provisional HR-014 entry and zero filings, with the cue stopped. The dedicated Assistant browser check
separately verifies the once-only audiovisual count, including repeated filing, reload and reset.

Two accepted PR 1 limitations are mandatory PR 2 acceptance criteria:

1. **Validate availability against a content registry.** Today availabilityPolicies.contentId is syntax-checked
   without verifying an existing target. PR 2 must reject unknown targets and typos at definition load, with
   versioned migration for that schema change. Do not add restricted narrative content before all app surfaces
   enforce authorization.
2. **Execute inspection policies through application adapters.** inspectionPolicyId is currently metadata,
   while inspectEvidence is a trusted logical command. PR 2 must connect authorized artifact presentation,
   inspection-policy satisfaction and logical registration in one validated integration path. Opening ordinary
   mail or the CAM 4 preview must not inspect unrelated evidence or CAM-R03.

These are integration requirements, not automatic player comprehension. A definitive inference interface,
real investigation evidence maps and Drive narrative work remain outside PR 2 implementation scope until
the team designs them separately.
