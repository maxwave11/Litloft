# YouTube Chrome extension review record

This branch adds the YouTube page action and extension picker using the existing public media_import handler. No core or addon behavior was changed.

The independent reviewers inspected fixed SHAs in separate worktrees and restored their mutations. Reports are preserved as written:

- [Round 1](round-1.md): e91369d599005ed7c2e2907ee1ee3870af605369; two missing invariant tests and BFCache restoration.
- [Round 2](round-2.md): 4040ca858f2feb54e361c48a911f6d57a21d9005; earlier fixes verified, saved private-operation disclosure reproduced.
- [Round 3](round-3.md): 4a0a3d0621467c0eb4435487a552b151d9b0936b; disclosure fixed, pending-repeat test gap and supervisor-assigned trajectory concern.
- [Round 4](round-4.md): 4f1b85f22b8d136c54c1947d6ec2780b9fbbe0d3; zero findings, five guard mutations killed and five independent checks passed.

Supervisor triage: both round-1 A test gaps were fixed; the reachable BFCache B was accepted as a revised invariant and fixed. The round-2 A was fixed. The round-3 A now has a pending-repeat table case which fails the demonstrated mutation. The trajectory C prompted 4f1b85f22b8d136c54c1947d6ec2780b9fbbe0d3: the new picker conditional was removed, and the worker reuses its existing drive-access guard before returning import results. No extra operation state was introduced. Round 4 verified that the trajectory converges and reported no new C. The supervisor closes the review with no unresolved A or reachable open B/C from this change.

[Declared invariants](invariants.md) and [browser/backend verification](smoke-test.md) are recorded beside the findings. Full local screenshot and reproduction artifacts remain under docs/superpowers/reviews/youtube-chrome-extension in the author worktree. Installation instructions are in [the Chrome guide](../../../getting-started/chrome-extension.md).

The native permission prompt and native toolbar popup remain manual checks. R-5 user trial applies before any future merge; this task creates a local reviewable extension without merging, deployment or Store publication.
