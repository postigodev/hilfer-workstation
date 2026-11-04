# HILFER Mail v1 — Codex implementation contract (2026-11-04)

## Source of truth
- Use the accompanying `hilfer_mail_demo_v1.json` as the *fixed demo corpus*. There are **5 threads and 12 messages**, not 11; THREAD-DESK-HANDOFF has three messages. **Do not add, rewrite or omit prose** to make the mailbox look fuller. If editorial revision is needed, report it rather than silently editing copy.
- `sentAt` dates are **provisional demonstration timestamps**, not canonical Incident chronology. The older archive messages and retrospective administrative reviews are compatible with the two existing record timestamps, but the Incident date and Losurdo reassignment date are not fixed.
- Use the repo's `docs/PROJECT_CONTEXT.md`, `docs/DESIGN_DECISIONS.md`, `docs/INTEGRATION.md`; read `data/records.json`, `data/cases.json`, and new Assistant integration. Preserve them.

## Repository state
- Canonical repo: `postigodev/hilfer-workstation`.
- PR #3 (`feature/contextual-assistant-demo`, `ff486ad`) **is merged to `main`** as verified through GitHub on 2026-11-04. Base the new feature branch on current `main`. Do **not** merge or revert #3 and do not duplicate its code.
- No use of Git CLI or manual review is expected from the user. Codex may do all Git operations and testing, opening a PR without merging.

## Fixed scope
- HILFER Mail is an authorized shared Reconciliation Desk mailbox plus Corporate Archive, not a private email account and not a hacking activity.
- Functional `Inbox`, `Sent Mail` and `Corporate Archive`, with `Sent Mail` empty in this demo but structurally real for the future communications-gateway finale. No Compose or arbitrary outgoing mail yet.
- Thread and message views; sender/recipients/CC, date, subject, text body; full-text/sender/subject/record-ID search *only among authorized messages*; read/unread receipts; responsive window and keyboard controls.
- One cross-app reference: HR-014 in MAIL-004 opens existing `openRecord('HR-014')` in Records. No direct OH-008 jump; do not reveal supported Jessica resolution through Email.
- The five thread narratives are not all hints: Jessica/Tito threads primarily humanize people. Avoid indicators that tell users which conversation contains a solution.
- Store mail read receipts under a separate versioned UI storage key e.g. `hilfer:mail-ui:v1`. Never copy/replace `hilfer:save:v1`, mutate Reconciliation game state, or create a duplicate evidence store. Reset Demo Progress should clear mail receipts and selection. Blocked/malformed storage should fall back safely to in-memory state.
- Treat `access.requiredGrants` as a real authorization filter before list/search/open/count. Set initial grants from the data file. Future progression grant support must be easy to add, but DO NOT invent progressive mail unlock events now. For tests, inject a restricted thread fixture and prove metadata and direct access are hidden without its grant.
- All messages are authored game fiction. Do not import any real Knox emails, personal addresses, or real-world school signatures.

## Data/implementation
- Materialize fixed content in repo at `data/emails.json`; use a JavaScript module at `js/apps/emails.js` and UI stylesheet at `css/emails.css` if this fits existing architecture.
- Compose existing `js/main.js` with the Mail app, reused `openRecord()`, and OS shell window registration (replace only the Mail placeholder if present). Do not add 13 other empty apps, large unused assets, a backend, React, or an email service.
- Validate JSON fixture and source references on startup or in tests. Message IDs, thread IDs, timestamps, and sender/recipient fields are stable. Sort by message time within threads and last message time across threads.
- Do not add access-locked message teasers. Distinguish mailbox Inbox delivery from searchable archived copies by `folderId`, without duplicating messages.

## Validation / acceptance
1. Inbox has three threads; Archive has two; Sent Mail exists and starts empty. Total: 12 messages.
2. Search finds authorized sender/subject/body and HR-014; opening it navigates to Records; the existing Jessica resolution continues independently.
3. Read/unread survives reload, reset clears it, stale/corrupt/blocked UI storage does not crash the OS.
4. Injected restricted thread is unsearchable and not visible by direct open or unread count without grant.
5. Assistant notification, audio cue, glitch and existing CASE-001 tests remain unchanged.
6. Test via `node --test`, browser checks including mobile/keyboard, fresh play/reload/reset. Inspect screenshots. Open a PR with results; **do not merge**.

## Editorial note
Actual human teaching correspondence supplied only inspiration about variability in brevity, tone and friction. Its contents must not enter the repository. The only authorized fictional prose is in the JSON corpus. Refer to drafts as demo-only, not final canonical character profiles.
