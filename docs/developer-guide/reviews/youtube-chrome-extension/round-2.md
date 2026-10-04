# Independent Chrome client review, round 2

Reviewed fixed SHA: 4040ca858f2feb54e361c48a911f6d57a21d9005 in the isolated youtube-extension-review-two worktree. Previous implementation: e91369d599005ed7c2e2907ee1ee3870af605369. Only behavior fix round so far: 4040ca858f2feb54e361c48a911f6d57a21d9005.

Read CLAUDE.md, design-decisions.md, tests.md, comments.md, review-workflow.md, DESIGN.md, globals.css theme tokens, approved spec, round 1 findings and supervisor-revised R-0. Source is authoritative; prose precision is outside scope.

Review in progress; baseline and mutation/browser observations will be appended incrementally.

## 1. [introduced] A — A public-drive selection reveals a now-locked import destination

Location: extensions/chrome/lib/commands.js:93, the !reservation.created early return.

R-0: closed drives are absent from destination lists and stale inaccessible destinations do not bypass access control. The design-decisions.md Access control rule excludes locked-drive names from API responses entirely. The command validates the newly selected drive, then returns an existing reservation for the same origin/tab/video without checking whether that reservation's own drive remains accessible.

Unmodified-source reproduction: import video dQw4w9WgXcQ to Private/secret folder, with creation response {file_id: private-id, filename: Secret title.loft}; change api.drives to return only Public. Bootstrap returns drives=[Public], lastDestination=null and operation=null; status also returns operation=null. Send import for the same video to Public root. It returns the original success operation with drive=Private, folder=secret folder, filename=Secret title.loft and the private file/folder URLs. The picker renders these fields as a success result even though its current destination is Public. POST count remains 1, so this is disclosure and a misleading result, not a server-side authorization bypass.

The affected command module is new in the original implementation, so this is [introduced] for this change, present before the fix commit. It is a newly verified round-2 finding, not caused by the BFCache/portal fix. The existing locked-drive test covers only bootstrap/status and misses the duplicate import return.

## Verification so far

Native baseline: 22 tests pass. Removed final tab recheck alone, declared want=kill: new navigation-during-reservation test fails with one POST instead of zero. Restored. Removed creation validation alone, declared want=kill: new invalid-confirmation test fails with success instead of unknown. Restored. Both former survivors from round 1 are killed.

Current browser-smoke passes in Chrome 153.0.8010.54 using an isolated temporary profile, CDP unpacked installation and temporary fixture-host pregrant. BFCache token identity and persisted pageshow are confirmed. Screenshots: browser-round-2-baseline. Repeated Back and 320px stacking checks remain in progress.

## Completed browser verification

Chrome 153.0.8010.54, isolated disposable profile, temporary fixture-only HTTP host permission, no real library or backend involved. Enhanced harness is browser-round-2.mjs beside this report. The fixture uses a transformed actions container with overflow:hidden and z-index:1, plus an overlapping fixed sibling with z-index:2000.

At viewport 320x720 the loaded and expanded page picker measures left=16, right=304, top=170.828125, bottom=704. Its width and height stay within the viewport. A real mouse click at (61,560.296875) hits LITLOFT-PICKER above the overlap layer and expands 日本語; POST count remains zero. Closed-shadow DOM boxes were inspected through CDP, and browser-round-2/youtube.png was visually inspected.

After the original smoke's Back restoration, three further cycles each open the picker, navigate away, and restore the same cached document. Every restoration preserves the exact random window token and persisted pageshow state, has exactly one page action, and has no old picker portal. A subsequent SPA change to another watch ID still opens the picker; the later unsupported-page SPA transition removes the page action. Original smoke's public API/cookie, nested-folder, success, uncertain-response and no-retry checks also pass.

Native Chrome permission prompting and native toolbar popup interactions remain unverified: the temporary fixture host is pregranted, and the popup controller is mounted in an ordinary extension tab. The page action and portal themselves run as the unpacked extension content script in Chrome. This round's live YouTube network page was not requested; the named restoration/stacking cases use controlled YouTube-origin document fixtures.

## Mutation results

All mutations were declared before execution, applied one at a time, and restored before the next. No fixes were made.

| Mutation | want | observed | Detector |
|---|---|---|---|
| Remove final tab recheck after pending reservation | kill | kill: one POST instead of zero | New navigation-during-reservation Node case |
| Remove creation-response validation | kill | kill: success instead of unknown | New invalid-confirmation Node case |
| Remove pageshow restoration listener | kill | kill: page action missing after verified cached Back | Real-browser harness |
| Remove portal from pointerdown ownership condition | kill | kill: click closes picker instead of expanding folder | Enhanced real-browser harness |
| Lower portal stacking level beneath page overlap | kill | kill: pointer hits DIV instead of LITLOFT-PICKER | Enhanced real-browser harness |

Final native suite: 22 passed, 0 failed. git status --short and git diff --exit-code are clean in the reviewed worktree; its fixed SHA remains 4040ca858f2feb54e361c48a911f6d57a21d9005. No push, no author source edits, no pre-existing findings.

## Trajectory answer

Only one behavior fix round exists in this review's record: 4040ca858f2feb54e361c48a911f6d57a21d9005. It adds a portal reference, portal ownership in the outside-click condition, and a pageshow restart path. It also adds two observable regression tests. There is no earlier fix round to compare for repeated additions, so the two-successive-round design-patching criterion from review-workflow.md R-4 is not met. This review does not infer C from one repair round.

Round-1 findings 1 and 2 are resolved: their previously surviving mutations now fail the newly added tests. The supervisor-revised BFCache invariant is satisfied in repeated real-browser restoration and subsequent SPA checks. One introduced A remains in the reviewed SHA: finding 1 above. This round reports evidence only; continuation and triage belong to the supervisor/user under R-4.

TOTAL: 1 findings
