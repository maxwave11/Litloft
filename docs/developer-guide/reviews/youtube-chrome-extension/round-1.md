# Independent Chrome client review, round 1

Reviewed fixed SHA: e91369d599005ed7c2e2907ee1ee3870af605369 in the isolated youtube-extension-review worktree. Source is authoritative; approved spec and R-0 were read as design material. Native `node --test` baseline: 20 passed, 0 failed.

Actual touch points: new extension client and docs only; existing auth status, drives, folders, addon policies, addon status and public media_import link APIs. No changed shared backend/frontend functions, tables or WS events outside the R-0 touch-point list.

## 1. [introduced] A — Late tab-change protection has no regression case

Location: extensions/chrome/tests/commands.test.js:43; protected guard: extensions/chrome/lib/commands.js:96.

R-0: content messages cannot import a video outside the current YouTube tab; changing video prevents stale asynchronous work from submitting. The suite changes the tab URL only before running a command. It does not cover a navigation while the persistent pending reservation is being written.

Mutation declared `want=kill`: remove only the final `context(...)` check immediately after reservation and before POST. `node --test tests/commands.test.js` stays green (4 passed, 0 failed). Verified repro: switch the tab from dQw4w9WgXcQ to abcdefghijk when storage.set persists the pending operation. Original code sends zero POSTs and returns an error operation. The mutant sends one POST importing dQw4w9WgXcQ and returns success while the current tab is abcdefghijk. Restore performed. This is a missing invariant test, not an unmodified-source defect.

## 2. [introduced] A — Invalid creation responses are not tested at the command/UI boundary

Location: extensions/chrome/tests/commands.test.js:13; protected guard: extensions/chrome/lib/commands.js:98.

R-0: UI success requires a valid creation response. Every command-suite import stub returns a valid file_id and filename; API tests cover broken JSON but not valid JSON missing these creation fields.

Mutation declared `want=kill`: replace only the creation-response validation condition with false. `node --test tests/commands.test.js` stays green (4 passed, 0 failed). Verified repro: API import returns JSON `{}`. Original code returns unknown; mutant returns success without a file ID or filename, which picker-view renders as Added. Restore performed. This is a missing invariant test, not an unmodified-source defect.

## 3. [introduced] B — Returning through BFCache permanently loses the YouTube page button

Location: extensions/chrome/content.js:72.

Reachable reproduction in Edge 154.0.4258.48 with the fixed-SHA unpacked extension and an isolated temporary profile: open a supported YouTube watch document containing the extension's existing button anchor; observe one litloft-add-video element; follow a link to another origin; use Back. The browser emitted PAGEHIDE true followed by PAGESHOW true and preserved the exact window token (0.029541460085386273), confirming a cached-document restoration. After Back the button count was zero. The pagehide listener removes the host and disconnects its MutationObserver permanently, and no pageshow listener recreates either. The page action stays absent until reload; the toolbar popup remains usable.

This is B under the declared R-0 because its current invariants do not require restoration/visibility of the page entry point. It is a reachable feature defect for the supervisor's consideration, not a CSS inference. Evidence: browser-round-1/before-back.png and browser-round-1/after-back.png beside this report. Fixture routing changes only the YouTube document/network; the extension source is the immutable reviewed tree. Playwright's default disable-back-forward-cache launch flag was omitted so normal browser restoration could run.

## Mutation results

All mutations were isolated, declared before execution and restored before the next mutation.

| Mutation | want | observed | Applicable suite |
|---|---|---|---|
| Remove sender-ID authentication | kill | kill (1 failed) | commands |
| Remove final tab recheck | kill | live (4 passed) | commands |
| Remove creation-response validation | kill | live (4 passed) | commands |
| Send credentials: omit | kill | kill (1 failed) | api |
| Allow stale drive response to replace current folders | kill | kill (1 failed) | picker |
| Allow another reservation after worker restart without explicit repeat | kill | kill (2 failed) | operations |

Reviewed sender authentication, host/path validation, scoped drive payload, cookies, pending/unknown persistence, stale video/server/drive responses and popup/content lifecycle. No unmodified-source security bypass found in these paths. No pre-existing findings. Final native Node suite: 20 passed, 0 failed. Isolated review source restored to the fixed SHA; no author source edits or push.

TOTAL: 3 findings
