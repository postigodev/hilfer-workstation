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
