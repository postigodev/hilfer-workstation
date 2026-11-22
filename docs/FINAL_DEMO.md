# Classroom demonstration — visible navigation

Use Start → Reset Demo Progress. The existing Consolidated Report opens. All instructions below are player-visible labels; no record codes or developer console are needed.

| Time | Actions in the existing applications |
| --- | --- |
| 0:00–1:30 | In the Consolidated Report, Begin review → Open HR status. In Records, Review Occupational Health clearance → select its clearance claim → Update report. |
| 1:30–2:30 | Return to Reconciliation. Open central archive index, then Inspect local Engineering recorder (Operations transfer is an alternative). Compare archive sources → Establish relationship → the enabled Update report. |
| 2:30–3:15 | Review recovered corridor footage → Recovered CAM-R03. Play normally while visible. Opening or seeking is insufficient. |
| 3:15–4:30 | Return to Reconciliation. Read earlier recovery closeouts, Read third-entry authorization, Inspect authorized asset annex. Compare recovery purpose → establish the three-authorizations relationship → Update report. |
| 4:30–5:15 | Read approved incident summary → Compare official classification → establish the approved recovery classification relationship → enabled Update report. Medical/Legal routes are optional. |
| 5:15–6:15 | Read Guy’s unfinished revision in Records. Compare approved and unfinished accounts → acknowledge after both originals were inspected. |
| 6:15–7:15 | Return to Reconciliation. Inspect prior operator sessions, Read site occupancy protocol, Read operator medical restriction. Review current occupancy warning → acknowledge. |
| 7:15–8:30 | Read Communications routing policy → Prepare external request. Edit/save the existing draft if desired, Attempt external disclosure. Escape dismisses the recoverable warnings. Keep draft and submit through gateway. |
| 8:30–9:20 | Open Sent Mail opens its real authorized Mail reader. Read the outgoing body. Return to Reconciliation → Return to saved draft → Record the discrepancy in the Sent copy. |
| 9:20–10:00 | Read the evaluation notice → acknowledge → END OF SHIFT. Reload retains completion. |

Return to Reconciliation with its existing Records toolbar button or Start → Reconciliation. Other departmental leads are optional inline links to the actual Records and Mail applications, not completion quotas. Existing source content has not been rewritten.

The schedule is a speaking/read-through target, not a measured novice human playtest. For a 4–5-minute contingency, use the same Engineering and Operations-classification route and shorten spoken commentary; do not bypass source inspection, explicit relationships or natural playback. Mute audio if necessary. Escape/Clear visual effects cancels cosmetics without granting progress.

Automated visible-navigation coverage: `node tests/guided-game.browser.check.js`. Set `HILFER_URL` and optionally `HILFER_PLAYWRIGHT_MODULE`; `HILFER_DEMO_LARGE=1` checks 1920×1080. Default classroom viewport is 1366×768. The test uses visible labels, original application controls, real playback, reload and Reset Demo Progress. It does not use hidden source-ID search, engine dispatch or seeded saves.

Local fallback: `python scripts/serve.py --port 8080`, then open http://127.0.0.1:8080. Keep the origin unchanged to retain progress.
