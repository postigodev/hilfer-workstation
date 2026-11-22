# Interactive Design final — rehearsal script

Spoilers for the complete assignment. Use a new browser profile, or **Start → Reset Demo Progress**. No console commands, seeded saves or unlocked presentation build are needed. Audio is optional; all new correspondence has captions. Escape / **Clear visual effects** recovers cosmetic interruptions without completing any investigation.

The 8–10-minute schedule below is a suggested speaking/read-through pace, not a measured human rehearsal. Automated runtime is reported separately in FINAL_VERIFICATION.md.

## 8–10 minutes

| Time | Exact controls | What to explain |
| --- | --- | --- |
| 0:00–0:40 | Start → Reconciliation; Consolidated Report | The HR entry is provisional. An administrative classification is not the whole incident. |
| 0:40–1:30 | Start → Records; search `OH-008`; click its result; **Compare status with report**; **Update report** | Jessica was not cleared for work. Work-related cause remains unestablished. One filing, one original audiovisual cue. |
| 1:30–2:20 | Records search `SEC-INDEX`, click result; repeat for `ENG-LOCAL-SEGMENT`. Start → Reconciliation → Consolidated Report → Central Archive Review; establish the enabled E-I1 relationship; file its Engineering determination | The independent local record contradicts central availability. Operations' `OPS-TRANSFER` is an alternative verifier. Rebuild the cosmetic local index if prompted. |
| 2:20–3:00 | Start → Footage → CAM-R03; focus the video; press Space (or native Play). Watch naturally through the cargo scene | The 14.375-second recovered extract supports movement. Seeking/opening does not count. Its overlay, unreadable identifier and personal identity are not silently corrected. |
| 3:00–4:15 | Records: search and open `REC-01-02-CLOSEOUT`, `REC-03-APPROVAL-ROSTER`, `ASSET-CUSTODY-03`. Reconciliation → Consolidated Report → Third Recovery — Purpose; establish F-I1; scroll to and file operational purpose | Two recoveries are closed out; the third is a different authorized objective. Authorization does not prove completed retrieval. |
| 4:15–5:00 | Records: open `INC-SUMMARY`. Reconciliation → Consolidated Report → Classification Source Review; establish F-I4; file recovery classification | The approved summary collapses distinctions. This G-OPS route does not certify Tito's identity or death. |
| 5:00–6:00 | Records: open `GUY-UNFINISHED-DRAFT`. Start → Work Review / Communications → Guy / language; read both source panels; **Acknowledge the statement comparison** | Guy's unfinished, unapproved work differs from the institutional account. It is not a sent message or medical finding. |
| 6:00–7:00 | Records: open `LOS-AUDIT`, `AREA-OCCUPANCY`, `OH-LOSURDO`. Work Review → Losurdo / occupancy; read warning; **Acknowledge warning and continue the pending work** | Prior operator and current player share a restricted workstation. Ninety-minute limit, incomplete decontamination, removal with cause under assessment. No diagnosis. |
| 7:00–8:10 | Records: open `COMM-GATEWAY-POLICY`. Work Review → Archive / disclosure. Read/edit draft; **Attempt external disclosure**. Dismiss warnings or Escape; **Keep draft and submit through gateway** | The original is preserved. The institution controls circulation. No real external mail or network submission occurs. |
| 8:10–9:15 | Start → Mail → Sent Mail; double-click **Incident review package**. Read actual released body. Work Review → **Record the discrepancy in the Sent copy** | Apparent success concealed a sanitized copy: names to categories, specific objective to consolidated recovery, originals withheld. |
| 9:15–9:45 | Read evaluation notice; **Acknowledge evaluation notice** | Report complete, temporary access suspended pending evaluation, **END OF SHIFT**. Reload preserves END and does not replay anomalies. |

Search means the Records search box; always click the result and let its full text present. The available inference/determination labels are authored descriptions; E-I1/F-I1/F-I4 above are stable references for rehearsal, not a required visible code entry.

## 4–5-minute contingency

Use the same fresh-save clicks and G-OPS route. Spend 20s Jessica, 30s Security documents, 20s actual footage, 40s F sources/filing, 25s G, 35s Guy, 40s Losurdo, 50s disclosure/Sent/END. Summarize optional departmental branches verbally. Do not skip playback proof, source inspection, Guy comparison or occupancy acknowledgment. If a machine cannot sustain that pace, use the normal route; there is no evidence-bypass shortcut.

## Automated walkthrough

Run the static server, then:

```sh
node tests/full-game.browser.check.js
```

Set `HILFER_URL` for another origin, and `HILFER_PLAYWRIGHT_MODULE` to an installed Playwright module if it is outside the project. The script uses installed Edge. `HILFER_DEMO_LARGE=1` uses 1920×1080; `HILFER_DEMO_MOBILE=1` uses 390×844. `HILFER_E_OPERATIONS=1` selects the independent Operations route; `HILFER_G_COMMS=1` selects the Communications lineage route. Default is 1366×768, Engineering and G-OPS.

The walkthrough uses real UI actions and native playback, with read-only snapshot assertions. It never dispatches engine commands, calls `openRecord`, seeks through mandatory footage or injects localStorage. Screenshots go to the system temporary directory.

## Recovery

- Cosmetic index: **Rebuild local index**, Escape, Clear visual effects, or automatic expiry. No source is deleted.
- Audio: **Mute audio**; preference survives reload. Captions remain available.
- Obstructions: close/Keep working, Escape, or Clear visual effects. Gateway submission remains available.
- Lost window: Start → app; **Arrange workspace** if needed.
- Bad saved data: preserve the warning/export first; Reset Demo Progress starts anew. Reset is destructive to that origin's fictional player progress.
- Local fallback: `python scripts/serve.py --port 8080`. Keep host/port unchanged to resume. Use the separate ZIP only if supplied in the verification report.
