# Security integration — issue #11

Stacked on PR #10; no changes to canonical document prose or Drive.

## Implementation plan and editorial boundary

1. Audit the authenticated source files and canonical script, Chronology, Crosswalk,
   Manifest and Evidence Graph. Keep originals outside Git.
2. Preserve CAM4-PREVIEW; offer a separate recovered clip only after the archive
   determination. Never load its URL, poster or metadata into the viewer while locked.
3. Use two logical evidence sources, each with a separate media observation artifact
   and a closed `media-sequence-presented` adapter. Both refer to the same video;
   neither observation is an inference or determination.
4. Validate contiguous visible decoded playback using frame callbacks and a decoded
   frame counter fallback. Cancel on seeks, pause, visibility/window changes, media
   replacement, errors, access changes and reset. Persist completed inspections only.
5. Retain the canonical transport/injury milestones behind a separate unissued
   `security.timeline.verified` grant. The source clock and segment association are
   unresolved; visual observations alone cannot release custody documents or identify Tito.
6. Snapshot content v3 and migrate to v4 without inventing inspections or milestones.
7. Run Node, the five existing browser suites sequentially, and a dedicated Security
   browser suite. Submit a stacked draft PR with exact results and remaining blockers.

## Audit — independently measured 21 November 2026

| Drive ID | Original | Measurement / disposition |
| --- | --- | --- |
| `1QviEnvZb_A4hV1ABr4OWY-NJy4u8AFv5` | security footage.mov | 24,584,989 bytes; 14.375 s; 1920×1080; 24 fps; H.264 + PCM s24le. Selected for an optimized review derivative, not a verified canonical segment. |
| `13pDeXB8RbP_rfSLVNJI5OvkKRhUog97-` | ascii-art (1).mp4 | 2.516667 s; 1920×1440; 60 fps; H.264. Not a complete scene; excluded. |
| `1tW6Wt4qCGgA19FxJR1XR5c263dX_dRE2` | ascii-art.mp4 | 2.516667 s; 1920×1440; 60 fps; H.264. Not a complete scene; excluded. |
| `1d0AKwFEN8RqJdOI4tRuhBPPQqTb52FER` | 1.png | Corridor, burned-in CAM 03. |
| `1mTkMO5m-i2JnpO2f7q725219kEr-9eON` | 2.png | Laboratory, burned-in CAM 02. |
| `1tVg6SvY6bkxRVitKQbssWTyRy1gbIGu3` | 3.png | Office, burned-in CAM 01. |
| `17kp8M3bmbCD823WKXhKNx7L24YevKcjX` | Untitled_Artwork 15.png | Corridor without camera overlay. |
| `1NVWB_FBkK1PDJzDvelsinrdWiuqxZxBJ` | Untitled_Artwork 16.png | Office without camera overlay. |
| `1ohABum6sC2WYhU7w42Lb04w50DaEUsE9` | Untitled_Artwork 17.png | Laboratory without camera overlay. |

The six PNGs were visually inspected. Static feeds are withheld: the Crosswalk maps
CAM-01 to Jessica/lab, CAM-02 to José Carlos/medical corridor and CAM-03 to Guy/office;
the numbered art does not establish those joins. Six GIFs (49–100 MB each) were listed,
not decoded or selected; no claim is made about their animation content.

The MOV visibly shows two people moving equipment, one falling and the other
attending, then severe signal corruption. It does not establish a readable R-17,
a shutter strike, a prototype label, a death, or a verified personal identity.
Its burned-in `TCR 10-09 18:37:11` is preserved. The 27-second indexed interval and
28 October 06:43 chronology are not silently changed or represented as video metadata.

Review observation windows in the delivered 14.375-second derivative: transport
2.0–5.5 s; apparent injury/assistance 7.0–9.7 s. These record screen observations of
this specific file only. They do not resolve its relationship to SEG-R03-01.

## Blocking editorial decision

Approve a grounded mapping of this file to the indexed interval, or supply a corrected
export consistent with it. A partial-excerpt label alone cannot reconcile the clock.
Resolve the visible suit/personnel join separately before enabling E-I2. Until then
J and both E routes work; the clip can be reviewed; F/G remain blocked in production.
Synthetic tests may issue the timeline grant to exercise downstream architecture;
production never issues it. There is no player-facing bypass.

## Technical contract

`data/footage.json` contains the preview, recovered source and two bounded observation
definitions. `CAM-R03-TRANSPORT` and `CAM-R03-INJURY` are presentation artifacts;
`CAM-R03:transport-visual` and `CAM-R03:injury-visual` are their logical evidence IDs.
Both share one informational origin; they are not independent corroborating sources.
`createArtifacts` clones/freezes their metadata and supplies it to the policy, rather
than accepting proof windows from a DOM announcement or caller-supplied source object.

`media-sequence-presented` consumes advancing rendered-frame metadata. Its fallback
samples the decoded/non-dropped frame counter on animation frames; absent that counter
it fails closed. Playback must be normal-speed, active, visible and uninterrupted.
The transport window requires at least 60 advancing frames over 2.0–5.5 s; the second
requires 44 over 7.0–9.7 s. Frame gaps above 450 ms, clock discontinuities, pause,
seek, hidden state, replacement, errors and aborted presentation tokens discard partial
proof. A replay must cover the window again. No partial watch position is saved.

The existing validated inspection command persists the visual facts. Declarative rules
require both those facts and `security.timeline.verified` to reach the canonical
milestones. No production policy issues that grant. Inspections never file F or G.
An approved future asset replacement must use new observation identities/windows and
an explicit content migration, never reinterpret old inspections as seeing new frames.

Content v3 snapshots are byte-for-byte retained under `data/history/`; the v4 migration
preserves accepted facts and receipts. Original content tests remain on v3 snapshots;
new Security tests validate the current v4 definitions and the full migration chain.

The local server now supports single HTTP byte ranges, so a requested seek really
seeks. This is playback support, not authentication. Public static asset URLs remain
fetchable outside the game; only in-game discovery, presentation and network requests
are permission-filtered.

## Canonical source references

- [Animation script](https://docs.google.com/document/d/1OYe2lI7gnJY1zgMFfkzdY3kp1lUZFQ8llGyXOCk35qg)
- [Master Chronology](https://docs.google.com/document/d/1N76fAczbKn_wI6iWSVgv-hWaUUemEzLlaHtIymE-YCs/edit)
- [Identifier Crosswalk](https://docs.google.com/document/d/1bhJF-gKd2BsirMQNAWyQr74IapRtnmZ7ZrUKVhPvncI/edit)
- [Artifact Manifest](https://docs.google.com/document/d/19ZPJ8wikZfzuuD5Jt6pHNzNs75jO5pXIN8qDhHYqK5w/edit)
- [Evidence Graph](https://docs.google.com/document/d/1bgFs7-M4ogi4IEOsJtfPUAF2fvaqr8Zy1bx1PASIEo4/edit)

## Verification

Local Windows, Node 24.12.0, Playwright with Microsoft Edge, HTTP port 8083.

| Command | Actual result |
| --- | --- |
| `npm test` | 98 passed; 0 failed, skipped or cancelled. |
| `python tests/serve_test.py` | Passed; 9 full/partial/suffix/invalid range subcases. |
| `node tests/browser.check.js` | Passed: Jessica, report, cue once, reload/reset, desktop/mobile. |
| `node tests/assistant.browser.check.js` | Passed on isolated rerun; see failures below. |
| `node tests/mail.browser.check.js` | Passed, including authorization and storage fallback. |
| `node tests/theme.browser.check.js` | Passed. |
| `node tests/applications.browser.check.js` | Passed, including revoked readers and stale revoke/regrant completions. |
| `node tests/security.browser.check.js` | Passed on the final implementation. |

The browser suites ran sequentially. Security verifies both E routes, real duration and
decoded playback, actual seek-to-end, partial/hidden/minimized/replaced denial, independent
observations, fallback decoding, reset/regrant cancellation, reload, missing asset failure,
mobile containment and no uncaught page exceptions. A passive Assistant covering the
picture blocks observation on mobile. Source URL and decoded duration must match the
trusted catalog. Hypothetical timeline approval exists only in injected tests; it proves
the transport→AM-16→F→G-OPS route without enabling it in production.

Initial failures were retained rather than treated as successful checks:

- The old server returned 200 without byte-range support. Browser seekable range was
  `[0,0]`, so a requested seek returned to zero and the entire clip played. Added range
  handling and explicit seek-target assertions; the real seek now grants no observations.
- Reloading an unchanged preview during reset cancelled downloads and failed Assistant's
  request-failure check. Avoided unnecessary source replacement.
- Assistant's pre-first-gesture audio assertion intermittently failed, as on the baseline
  branch. The unchanged suite passed in the subsequent isolated/sequential invocation.
- A source-element media error need not populate `video.error`. The missing-asset test
  now waits for the actual error UI and verifies no observation was credited.

Node CI is configured for the PR; browser results are local, not CI. No production
end-to-end F/G completion is claimed. Static artwork/GIF attribution and timeline/personnel
identity remain the explicit blockers above. Screenshots: [mobile player](images/security-mobile.png)
and [editorial gate](images/security-editorial-block.png).
