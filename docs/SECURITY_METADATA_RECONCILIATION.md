# Security metadata reconciliation — content v5

User-approved editorial follow-up to PR #12, stacked on that branch. No PR is merged
by this work. Arwa's animation and every pixel of its clock remain unchanged.

## Approved narrative correction

The 27-second interval belongs to the indexed parent `SEG-R03-01`, not the duration
of the recovered playable extract. AM-12 now explicitly describes the 14.375-second
extract. Its extraction addendum distinguishes the acquisition event log from the
non-advancing `TCR 10-09 18:37:11` picture text. No cause for that stale text, corrected
picture clock, missing frames or exact per-frame absolute timestamps are invented.

AM-13 now distinguishes carrier indexing from readable extract length. Its addendum
checks the received extract against the physical collection/custody entry and compares
Operations' own contemporaneous corridor movement log for OP-R03 after 06:34. That
operational corroboration is separate from Systems Integrity's extraction check.
The 29 October addendum does not cite the 30 October verification by ID.

These are approved new fictional documentary assertions, not facts discovered in the
MOV's binary metadata. Source documents in Drive were not modified. The animation
still does not establish R-17, Tito's visual identity, death or cargo contents.

## Evidence and access contract

Two separately inspectable addenda belong to the existing informational origins:

| Addendum artifact/evidence ID | Existing origin |
| --- | --- |
| `ENG-LOCAL-SEGMENT:association` | `ENG-LOCAL-CAPTURE` (AM-12) |
| `OPS-TRANSFER:association` | `OPS-TRANSFER-CUSTODY` (AM-13) |

The record corpus has 20 presentation documents: the prior 18 plus these two addenda.
They are not extra independent witnesses or cases. In particular, a parent and its
addendum cannot count as two distinct source groups.

`E-I3` requires all three inspected sources: the two addenda and
`CAM-R03:transport-visual`, after `CASE-ARCHIVE:filed`. The player establishes this
association explicitly through the existing F case view. Reading or watching alone
does not infer it. The existing footage source link opens Footage.

`security.timeline.verified` is derived from `E-I3`; it is never an initial grant or
a new administrative command. Existing declarative rules then reach the transport
milestone and authorize AM-16. Its purpose remains hidden until AM-16 is actually
inspected. F still requires R01/R02 closeout, OP-R03 routing and asset custody; G-OPS
still needs the explicit classification comparison and filing. Neither requires
injury playback, E-I2, Medical/Communications optional inferences or personal identity.

The video UI reads the authoritative grant to show documentary association while
retaining the warning that personal identity is unverified. This is not a changed
video timestamp or a claim that every picture frame has been dated.

## Persistence and compatibility

Save envelope remains v2. Definition content advances v4→v5 with exact v4 snapshots
of definitions, cases and records. Historical accepted facts and receipts survive;
no new E-I3 or addendum inspection is manufactured.

The two addendum identities are necessary because a saved inspection of the old AM-12
or AM-13 does not prove the player read information authored later. A v4 player who
already watched transport can retain that legitimate visual fact, inspect both new
addenda and establish E-I3. The video bytes and observation windows are unchanged.

`store.js`, `rules.js`, `persistence.js`, footage proof logic, Mail and Assistant logic
are unchanged. A mobile-only scroll clearance prevents the final filing control from
being trapped under the docked Assistant portrait; tests use normal clicks, never a
forced click or hidden portrait.

## Scope remaining

Tito identity/E-I2 and the static camera art numbering remain unresolved. No final
confrontation, outbound gateway, full archive viewer, new investigation or Drive edit
is included. Completing four assigned cases does not mean completing the full game.

## Verification

Windows, Node 24.12.0, Edge/Playwright, local HTTP port 8084. Browser suites were
executed sequentially. No initial grant or test-only editorial approval was injected
in the new end-to-end suite.

| Command | Result |
| --- | --- |
| `npm test` | 105 passed; 0 failed, skipped or cancelled. |
| `python tests/serve_test.py` | Passed; nine byte-range subcases. |
| `node tests/browser.check.js` | Passed. |
| `node tests/assistant.browser.check.js` | Passed. |
| `node tests/mail.browser.check.js` | Passed. |
| `node tests/theme.browser.check.js` | Passed. |
| `node tests/applications.browser.check.js` | Passed. |
| `node tests/security.browser.check.js` | Passed. |
| `node tests/security-reconciliation.browser.check.js` | Both real J→E→association→F→G-OPS routes passed: Engineering/desktop and Operations/mobile. |

The new unit coverage verifies missing support, explicit inference, repeated commands,
no premature prototype value, no duplicate origin count, preservation of actual v4
transport observations without new addendum knowledge, historical migrations and reset.
The new browser coverage checks no premature media request or grant, real playback,
AM-16 inspection before revealing its purpose, persisted E-I3 without repeated rule
activation, final report with four filed cases, no injury/E-I2 requirement, reload and reset.

Initial failures: the three new route tests failed before E-I3 existed. The first
mobile browser run reached the final G control but the Assistant portrait intercepted
its normal click. Added mobile scroll clearance and an assertion that the control
can scroll above the portrait; both routes then passed. No forced click was used.
No existing assertion was removed: v3/v4 content tests are pinned to their exact
historical snapshots while these tests exercise the new v5 production definitions.

Browser verification is local; CI runs Node and Python. Original PR #12 failures
remain historical in [SECURITY_INTEGRATION.md](SECURITY_INTEGRATION.md).

Screenshots: [documentary association](images/security-associated-v5.png),
[final desktop report](images/security-report-v5.png),
[final mobile report](images/security-report-mobile-v5.png).
