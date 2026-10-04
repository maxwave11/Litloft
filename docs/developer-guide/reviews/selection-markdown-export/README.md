# Export the selected videos as one Markdown document

Round 1 reviewed core `9d7a8886`: `r1.md`, 12 findings. Round 2 reviewed the fix
commit `909c8c2a`: `r2.md`, 5 findings. `invariants.md` is the list the reviewers
were briefed with, including the revision made after round 1.

The addon providers (intelligence `fb09685`, media_import `845afb1`) and the pin
commit `1f788e96` were not reviewed independently, by the user's decision.

What became of each finding:

| # | Finding | Disposition |
|---|---|---|
| F1 | Page shortcuts stay live under the open dialog | fixed, `909c8c2a` |
| F2 | New `role="dialog"` file missing from `popup-dismissal.test.ts` | fixed, `909c8c2a` |
| F3 | TOC anchors differ from GitHub's slugs | fixed, `909c8c2a`; two title shapes still differ (R2-1) |
| F4 | The original link could forge document structure | fixed, `909c8c2a` |
| F5 | A blank section counted as a section | fixed, `909c8c2a`; zero-width text still counts (R2-3) |
| F6 | Behaviour with no test | tests, `909c8c2a`; `aria-modal` is still untested |
| F7 | No focus management for an `aria-modal` dialog | `known-issues.md` |
| F8 | A backdrop click discards the finished document | `known-issues.md` |
| F9 | Spec and code disagree on Continue with no provider | decided: "Nothing to export", Copy hidden, `909c8c2a` |
| F10 | `unregistered` carries a label in a field named `id` | closed: naming only |
| F11 | `selectedFiles` rebuilt on every render | closed: not measured |
| F12 | Hard-coded `", "` list separator | closed: polish |
| R2-1 | TOC anchor taken from source text, not rendered text | `known-issues.md` |
| R2-2 | Brackets encoded in an IPv6-literal link | `known-issues.md` |
| R2-3 | Zero-width-only section counts as content | `known-issues.md` |
| R2-4 | Tests bound to message key names and a fixed sleep | closed |
| R2-5 | `POPUPS` entry described another file | fixed |

Round 2's answer to the trajectory question: no state was added, three branches
and two predictions were (the anchor rule standing in for GitHub's slugger, and
`trim()` standing in for "empty"). Its reading is that the cheaper design is a
contents list without links, which removes the first prediction; that was not
taken.
