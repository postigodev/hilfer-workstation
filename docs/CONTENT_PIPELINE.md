# HILFER content integration — November 2026

This branch imports the nineteen authored fictional documents from the shared **Fictional Document Corpus v0.1**. It is intentionally not a claim that all seven beats or the final footage are already implemented.

## Source of truth

- Story and characters: Storyline: Prose
- Calendar: Master Chronology v1.0
- IDs: Identifier Crosswalk v1.0
- Artifact text: Fictional Document Corpus v0.1
- Evidence relations: Master Evidence Graph v0.2, Artifact Manifest v0.1

Google Docs drafts are editorial source material. Runtime reads only repository JSON. Do **not** fetch Google Docs, connected Gmail, faculty correspondence, or private content at runtime.

## Data ownership

- `data/records.json`: two preserved Jessica records + 16 new dated departmental Records. New sources have `body`, `sourceGroupId`, `designId` and indexed `fields`; the Records viewer escapes and formats the human text.
- `data/emails.json`: five historical demo threads + three authored internal threads (`MAIL-013`–`018`). Mail keeps its folder/permission contract and per-message inspection.
- `data/cases.json`: preserves Jessica and the CASE-002 demo teaser; defines E/F/G tasks.
- `data/progression.json`: schema 2, content version 3. Defines independent origin groups, optional inference support, alternative E paths, immutable determinations, milestones, grants, and catalog availability.
- `data/history/*-v2.json`: exact previous data definitions for the 2→3 save migration.

## Critical limitations

**Issue #11 branch update:** content v4 adds the actual 14.375-second review clip and
two separately validated visual observations. The paragraph below records the v3
baseline. The delivered picture clock differs from the canonical interval, so the
new production rules additionally require an unissued timeline-verification grant.
AM-16 and F/G remain blocked. See [Security audit](SECURITY_INTEGRATION.md).

`CAM-R03` is not currently available as a real video asset. The existing `CAM4-PREVIEW` is a demo video and **MUST NOT** be treated as proof that the player saw Tito's injury or sealed transport. Therefore the production `CAM-R03:transport-observed` milestone deliberately has no producer. `ASSET-CUSTODY-03` remains locked and F/G cannot yet be finished in production. The test fixture temporarily supplies that milestone to validate hypothetical downstream reachability; this is *not* a gameplay bypass and is never bundled in the runtime.

The future video integration requires a genuine media source and two independently validated observation milestones: visible transport context around 00:09 and Tito injury/assistance around 00:23. Do not award either on file open or the first decoded frame.

The player-facing implementation of J remains unchanged; E/F/G use explicit evidence relations. The outbound gateway and finale are not implemented by this content import.

## Validation

Run `npm test` in the repository root. The new `tests/content-corpus.test.js` contains 11 focused tests for schema, content counts, independent E alternatives, gated sources, all three G branches, a hypothetical final path, and migration from an actual content-v2 save. Existing browser suites require the local server/Playwright described in `docs/INTEGRATION.md`. This branch has not been verified against a real browser until those suites run.

Before merge, test old content-v2 saves, Jessica field comparison, Mail search authorization, Records rendering for new documents, and the absence of restricted information in search results and direct links.

Sources: [Corpus](https://docs.google.com/document/d/1o5JdlHcnU-3L7fUqMHYIMxBbAzyH9msypwdMahxXaQA/edit) · [Crosswalk](https://docs.google.com/document/d/1bhJF-gKd2BsirMQNAWyQr74IapRtnmZ7ZrUKVhPvncI/edit) · [Chronology](https://docs.google.com/document/d/1N76fAczbKn_wI6iWSVgv-hWaUUemEzLlaHtIymE-YCs/edit)

## Backward-compatible test fixtures

Original Jessica and five-thread Mail fixtures are preserved under `data/history/*-v2.json` and used by legacy tests that intentionally pin their old counts and text. New tests validate the current full v3 corpus. This avoids weakening historic behavior checks or pretending the corpus still contains only two Records.

CI on PR #10 runs `npm test` using Node 24. Browser/Playwright suites remain a separate manual integration check; a passing Node workflow does not certify actual browser UI presentation.
