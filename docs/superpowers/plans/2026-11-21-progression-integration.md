# PR 2 implementation plan

**Goal:** Authorized artifact presentation across Records, Mail and Footage, with verified logical inspections.
**Architecture:** Schema-2 catalog + existing authoritative store + one small artifacts boundary. Keep Mail's model and presentation receipts.
**Tech stack:** Existing vanilla JS/JSON, Node tests, existing Edge browser checks. Inline execution.

## Constraints

No new narrative, cases, inference UI, ending, Drive writes or auto-merge. Keep all 61 tests and four browser checks.

### 1. Catalog, migration and legacy compatibility
- [x] Add schema-2 catalog validation and explicit document-open alias; schema-1 stays valid.
- [x] Add content-1→2 identity migration with original definitions and centralized Mail grants.
- [x] Test unknown availability IDs/bindings/policies, migration, no-progression createStore callers.

### 2. Artifact boundary and policies
- [x] Add artifacts.js: known/authorized lookup, sources validation, begin/present/cancel with irreversible tokens.
- [x] Test grant/revoke/regrant, availability loss, replacement/selection/close/reset, delayed failures, shared evidence and ordinary mail.

### 3. Application wiring
- [x] Route Records, Report/Reconciliation, Mail and Footage through authorization before metadata/body presentation.
- [x] Keep Mail thread authorization in its model; message/attachment inspection is separate and explicit.
- [x] Wire successful rendered body/frame policies; revoke closes/stops viewers and cancels stale work.
- [x] Mount known effect adapters while retaining Jessica's single existing transient cue owner.

### 4. Verification and delivery
- [x] Add synthetic browser coverage for real adapters, grant revocation and asynchronous cancellation.
- [x] Run all unit and browser suites, inspect screenshots, document actual outcomes/limits.
- [x] Commit explicit paths, push feature branch, open PR against main without merging.

Delivered: [PR #8](https://github.com/postigodev/hilfer-workstation/pull/8); see [verification report](../../APPLICATION_INTEGRATION_REVIEW.md).
