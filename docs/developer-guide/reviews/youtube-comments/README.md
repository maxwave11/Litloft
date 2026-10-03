# YouTube comments, as a Comments tab of the reading row

Round 1 reviewed core `363bc0c6`, media_import `04750c6` and intelligence
`22995eb`: `r1.md`, 11 findings. `invariants.md` is the list it was briefed with,
including the revision made after it on the user's decision.

What became of each finding:

| # | Finding | Disposition |
|---|---|---|
| 1 | A re-read with no answer drops the tab and stops the polling | fixed, media_import `1a1d80c` |
| 2 | A page opened before a fetch started never learns of it | fixed, media_import `1a1d80c` |
| 3 | Lone CR and Unicode separators escape the `>` quoting | fixed, media_import `1e53c50` |
| 4 | Tests did not pin the display name or the `g` flag | tests, media_import `1e53c50`; the facts in a name are in `known-issues.md` |
| 5 | A failing store step is recorded nowhere | fixed, media_import `fd5793d` |
| 6 | Survivors: `fetching` as pending, request spacing, `missing_since`, remount, lower bounds | tests, media_import `fd5793d` and intelligence `f1bb209` |
| 7 | One commit shows file A's tab for file B | closed: not visible, not fixed |
| 8 | Buttons and badge against DESIGN.md | fixed, media_import `6220b2d` |
| 9 | The YouTube provider pattern is a substring match (pre-existing) | `known-issues.md` |
| 10 | No limit on pressing Refresh | `known-issues.md` |
| 11 | `eligible` is true without `filename` | closed: not reachable |

Fix commits so far, in order: media_import `228a1f5`, `fd5793d`, `1a1d80c`,
`1e53c50`, `6220b2d`; intelligence `f1bb209`. Core `5473382d` fixed the tab
row's vertical scrollbar while the round was open; it is unrelated to the review.

Read the code for what the system does now. These files quote it as it stood at
the SHA the round reviewed.
