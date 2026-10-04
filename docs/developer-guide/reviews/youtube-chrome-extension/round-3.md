# Independent Chrome client review, round 3

Reviewed fixed SHA: 4a0a3d0621467c0eb4435487a552b151d9b0936b in the isolated youtube-extension-review-three worktree. Original implementation: e91369d599005ed7c2e2907ee1ee3870af605369. Behavior fixes read in order: 4040ca858f2feb54e361c48a911f6d57a21d9005, then 4a0a3d0621467c0eb4435487a552b151d9b0936b.

Read CLAUDE.md, design-decisions.md, tests.md, comments.md, review-workflow.md, approved spec including Checked, no action, supervisor-revised R-0, and both completed prior reports. Source is authoritative; prose precision is outside scope. The prior real-browser restoration/stacking evidence is available in round 2 and is not rederived here.

Native baseline: 23 passed, 0 failed. Review in progress; mutation results and independent reproductions will be appended before the terminator.

## Fix verification

The original round-2 reproduction was rerun independently: import the current video to Private/secret folder, then return only Public from the drives API, then select Public root. Source extracted with git archive at 4040ca858f2feb54e361c48a911f6d57a21d9005 returns the saved private success object including Secret title.loft, folder and file URLs; the reproduction fails the no-disclosure assertion. At the fixed SHA it returns operation=null, with exactly one POST, so the round-2 A is resolved.

The additional artifact review-round-3-checks.mjs imports the authoritative reviewed modules and runs five direct command/controller checks. All pass. Its table covers success, unknown and definite-error journal records: bootstrap/status/public selection all hide inaccessible records; unlocking restores the same record ID and state without another POST. Locking during each completion state hides the result while preserving the journal. A hidden pending reservation also blocks another POST even if the caller supplies its repeat ID; its late success stays hidden. An access-list fetch failure after a successful POST leaves the persisted success intact, and a later selection returns that same record without another POST.

The combined controller/commands check exercises lock during private completion, error display, refresh with only Public, another selection and reopening. Every result render after lock has operation=null and unavailable, busy clears, and POST count stays one. Unlocking restores the original success; only an explicit repeat followed by a new selection starts the second POST and gives it a new ID and the Public destination.

## Mutation results

Every mutation was declared want=kill before its run, applied alone and restored in a finally block before the next.

| Mutation | want | observed | Detector |
|---|---|---|---|
| Bypass access filtering only for an existing reservation | kill | kill: private success object instead of null | Native commands locked-drive test |
| Bypass access filtering only after completion | kill | kill: private success object instead of null during lock | Native commands locked-drive test |
| Remove the controller hidden-result error guard | kill | kill: null error instead of unavailable | Native picker inaccessible-operation test |
| Remove pending-state exclusion while retaining repeat-ID comparison | kill | live: all 23 native tests pass; independent command detector kills with two POSTs instead of one | Native suite and artifact pending-reservation case |

## 1. [introduced] A — Pending exclusion is not held when repeatId names the current pending record

Location: extensions/chrome/lib/operations.js:22; missing case in extensions/chrome/tests/operations.test.js.

R-0 requires a selected destination to start one active request. The existing operations test checks an ordinary duplicate while pending and a repeat after success, but does not supply the current pending record's ID as repeatId. Removing only `existing.state === "pending" ||` from the reservation guard leaves every native test green (23 passed). This is a missing invariant test, not an unmodified-source defect.

Independent command reproduction: hold a Private/secret folder import response pending, obtain its journal ID, lock Private, then submit Public root with repeatId equal to that pending ID. The unmodified source returns operation=null and sends exactly one POST; the mutant reserves a second operation and sends a second POST while the first is still pending. The artifact assertion fails with 2 !== 1. The source is restored and the same artifact passes again. The affected module was created by the original implementation, so [introduced] is earned without a parent-side reproduction. This finding concerns the native detector's coverage; it does not claim the current picker offers a repeat button while pending.

## 2. [introduced] C — Successive fixes add handling paths (supervisor-assigned)

Trajectory question: Read the fix diffs in order. Does each round add a branch, a state or a prediction that the round before it also added?

Answer: yes under the literal shape test in review-workflow.md R-4; the design is being patched. Fix 4040ca858f2feb54e361c48a911f6d57a21d9005 introduces the `portal` state, an additional portal ownership check in the outside-click condition, and the pageshow/start path for cached-document restoration. Fix 4a0a3d0621467c0eb4435487a552b151d9b0936b makes the import duplicate and completion paths return hidden null results, then adds `if (!result.operation) throw new Error("unavailable")` in extensions/chrome/lib/picker.js:78 to handle that extra import-result case.

Qualification: the latest commands.js diff also centralizes exposure checking in presentOperation(record, drives) and removes the two duplicated bootstrap/status filtering expressions. That part converges. The newly added picker conditional remains an additional handling branch following the prior fix's added lifecycle/state paths; it is the evidence for the affirmative trajectory answer. These are new extension modules, so [introduced] is earned from their creation by this change.

The reviewer supplied this answer and the diffs to the supervisor. The supervisor explicitly accepted the literal trajectory finding as C with this centralization qualification. The C classification is the supervisor's judgement, not an author's judgement. This report makes no decision to continue, ship or discard.

## Final verification and limits

The round-2 inaccessible-result disclosure is resolved; no unmodified-source violation was observed in the reviewed lock, journal, completion, hidden-result controller or retry paths. One native test-gap A remains above. Final native suite: 23 passed, 0 failed. Independent command/controller artifact: five passed, zero failed. All mutations were restored; git status --short and git diff --exit-code are clean, and HEAD remains 4a0a3d0621467c0eb4435487a552b151d9b0936b. No push or fixes were made.

Earlier page-action restoration, portal stacking and pointer behavior were already measured and mutation-tested in round 2. Native host-permission prompting and native toolbar popup interaction remain manual user checks; the headless browser evidence mounts the popup controller in an extension tab. This review adds no claim that those manual checks have been completed. No pre-existing findings.

TOTAL: 2 findings
