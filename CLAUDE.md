# Working conventions for this repo

Read `PROGRESS.md` first in any new session — it has the project context,
lessons learned, and step-by-step status; this file is just process rules.

## Branch + PR for all new development

Every new step or feature gets its own branch and pull request. Never commit
new development straight to `main`.

- Before starting a step's work, create a branch off `main` (e.g.
  `step-4-hit-reactions`, `fix-trajectory-dots`).
- Commit the work on that branch as it's completed.
- Push the branch and open a pull request against `main` (use `gh pr create`
  if the `gh` CLI is available; otherwise push the branch and hand Vincent
  the GitHub compare URL to open it manually).
- Leave merging to Vincent unless he explicitly asks for the merge too.

Small fixes requested mid-session on an already-open branch can land as
additional commits on that same branch rather than spawning a new one.
