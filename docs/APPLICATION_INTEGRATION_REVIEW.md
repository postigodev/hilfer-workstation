# PR 2 — application integration review

[Review pull request #8](https://github.com/postigodev/hilfer-workstation/pull/8).
Branch: `codex/progression-application-integration`. Base: verified main
`f9f3305c8f33f4e7fa14818b5796d0efae99ff32`. The user approved the specification and all three clarifications.
This delivers PR 2 for review only; do not merge automatically or begin narrative investigation design.

## Delivered contracts

1. **Mail granularity:** threads retain existing authorization/container semantics. Only an individually mapped,
   expanded message body is inspected. Attachment identity, lookup and presentation policy are separate; parent
   mail does not credit it. Availability is filtered inside the existing Mail model, before search/counts/readers.
2. **Irreversible cancellation:** pending artifact operations abort on grant or availability changes, close,
   minimize, selection, replacement and reset. Regrant cannot revive the canceled token; only a fresh authorized
   presentation can succeed. Both unit and browser regression tests execute revoke→regrant→old completion.
3. **Legacy compatibility:** original schema-1 definitions validate; omitted-progression createStore callers keep
   their compiler and APIs. document-open explicitly aliases document-presented at the application boundary.
   Existing saved inspections remain accepted, and v1 discoveries remain registration only.

Schema-2 contentCatalog checks known availability targets, case/artifact bindings and supported policies.
Production uses contentVersion 2 and an explicit identity migration with original validators retained in
data/history. The save envelope remains v2. No second progress store, rule engine or framework is introduced.

The shared artifacts boundary authorizes Records, Mail, source references and Footage before presenting them.
Hidden Records departments/files are absent from queries; restricted Mail readers close, partial readers lose
restricted messages, and media stops on revocation. Report findings remain accepted while restricted source
metadata/links become a generic unavailable reference. Case authorization also gates direct comparisons/filing.

Actual DOM/frame policies verify successful presentation; DOM notifications alone do not count. Current CAM 4
remains unmapped evidence even during playback, and never inspects CAM-R03. Synthetic media inspection establishes
content access, not full viewing, comprehension, inference or death.

Fixed presentation adapters are mounted for existing Assistant signals, the existing glitch asset and animation.
Jessica keeps its single legacy cue owner. Generic engine audio/animation has independent cancellation so it
cannot truncate that cue. Assistant completion receipts stay separate; canceling an engine cue does not interrupt
an unrelated baseline clip or mark an unplayed voice completed.

## Actual verification

| Check | Result |
| --- | --- |
| `npm test` | **76 passed, 0 failed, 0 skipped**; original 61 tests retained plus 15 focused regressions. |
| `node tests/browser.check.js` | PASS: Jessica/report/OS shell/desktop/mobile and unmapped Footage playback. |
| `node tests/assistant.browser.check.js` | PASS: actual audio, correspondence, notification, focus, reload/reset and mobile. |
| `node tests/mail.browser.check.js` | PASS: Mail readers/search/receipts/navigation, restricted fixture, revocation and blocked storage. |
| `node tests/theme.browser.check.js` | PASS: theme/assets/Jessica/reload/mobile. |
| `node tests/applications.browser.check.js` | PASS: injected cross-app evidence, granular messages, shared logical evidence, separate attachment presentation, actual media frames, mounted effects, stale revoke/regrant completion and blocked game storage. |
| `git diff --check` | PASS. |

Browser runs used the existing localhost static server, bundled playwright-core and Microsoft Edge headless.
No dependency was added. Representative synthetic integration and mobile Assistant screenshots were inspected.
No environment limitation prevented the agreed verification.

An intermediate Mail browser run failed because its old injected corpus declared a restricted thread without
the now-required grant/catalog declarations. Its fixture now supplies those declarations while keeping all
original authorization/search/count/revocation assertions. Existing migration tests explicitly retain their
original content-1 definitions; new tests also cover the current schema/content-2 upgrade. No guarantees weakened.

## Changed-file inventory

| Area | Files |
| --- | --- |
| Engine | js/core/rules.js, store.js, progression.js, effects.js; new artifacts.js |
| Apps | js/main.js; Records, Reconciliation, Report, Mail and Assistant adapters; new inspection.js and presentation.js; targeted voice-cancellation method in assistant-voice.js |
| Presentation | css/hilfer.css adds an independently owned engine animation class using the existing animation |
| Definitions/history | data/progression.json adds schema/content 2 catalog/grants/policies; data/history retains exact prior progression/cases |
| Tests | artifacts.test.js, applications.browser.check.js, fixtures/application.js; focused additions to Assistant/persistence/browser suites and Mail's synthetic manifest |
| Documentation | ENGINE.md, APP_INTEGRATION.md, INTEGRATION.md, this report, approved specification and implementation plan |

Verified unchanged against main: data/records.json, cases.json, emails.json and assistant.json. No art/media assets,
canonical relationships, new cases, dialogue or Drive documents are added. The preexisting untracked
references/win98-icons directory remains outside commits.

## Explicit limits and remaining work

- There is no authored attachment in the production corpus and no new generic attachment viewer. Its independent
  identity/getter and executable presentation policy are tested through an injected synthetic viewer. A real
  narrative attachment/viewer requires separately approved content work.
- Low-level catalog getters and inspectEvidence remain trusted engine/debug APIs, not an anti-tamper boundary.
  Production UI routes use authorized adapters. This is a static browser game; bundle contents are not secrets.
- Media-frame inspection means actual access to a frame, not complete review or comprehension. No inference UI
  is included. Existing at-most-once effects may be omitted on interruption rather than replayed on restore.
- Narrative evidence maps, real nonlinear investigations, determination revisions and ending mechanics remain
  outside scope. Do not begin implementing the seven beats or create Drive narrative documents automatically.

See [APP_INTEGRATION.md](APP_INTEGRATION.md) for teammate-facing API and policy details.
