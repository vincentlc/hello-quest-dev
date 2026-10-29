# Working conventions for this repo

Read `PROGRESS.md` first in any new session — it has the project context,
lessons learned, and step-by-step status; this file is just process rules.

## Branch + PR for all new development

Every new step or feature gets its own branch and pull request. Never commit
new development straight to `main`.

- Before creating a new feature branch, always refresh `main` from GitHub:
  run `git fetch origin`, switch to `main`, and run
  `git pull --ff-only origin main`. Then create the feature branch from
  the updated `main` (or directly from `origin/main`). Never branch from
  a stale local `main`, even if a local `main` branch already exists.
- When resuming an existing feature branch, fetch first and integrate the
  latest `origin/main` when it has advanced.
- Commit the work on that branch as it's completed.
- Push the branch and open a pull request against `main` (use `gh pr create`
  if the `gh` CLI is available; otherwise push the branch and hand the user
  the GitHub compare URL to open it manually).
- Leave merging to the user unless they explicitly ask for the merge too.

Small fixes requested mid-session on an already-open branch can land as
additional commits on that same branch rather than spawning a new one.
