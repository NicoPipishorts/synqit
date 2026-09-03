---
name: ship
description: Land the current working tree following Synqit's branch flow — clean stray files, run checks, commit on dev or a feat/* branch, push, and open a PR. Use when asked to ship, land, commit and PR, or clean up the working tree.
---

# Ship the working tree

Follow these steps in order. Stop and report if a check fails; do not push red code.

## 1. Confirm the branch

- `git status --short` and `git branch --show-current`.
- On `main`: stop. Switch to `dev` (or create `feat/<topic>` off `dev`) and carry the changes over.
- On `dev` or `feat/*`: continue.

## 2. Remove stray artefacts

- Finder duplicates such as `Something 2.tsx` — confirm they are unreferenced, then delete.
- `.DS_Store` files — never stage them.
- Empty directories under `apps/api/prisma/migrations/` — delete them (they break `migrate deploy`).

## 3. Run the checks that match the change

| Touched                               | Run                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| anything                              | `yarn typecheck`                                                                |
| `apps/api/**`                         | `yarn infra:up:local`, `yarn prisma:migrate:deploy`, `yarn test:api:regression` |
| `apps/web/src/locales/**` or web copy | `yarn i18n:check`                                                               |
| `packages/shared/**`                  | `yarn build:shared` first, then typecheck                                       |

`yarn lint` on the touched workspace is cheap and worth running.

## 4. Update the tracker

If a feature landed, tick or add a line in `docs/progress-checklist.md` in the same commit.

## 5. Commit

- Group unrelated changes into separate commits.
- Message: short imperative subject, optional body explaining why.
- End every commit message with the `Co-Authored-By: Claude ...` trailer the harness specifies.

## 6. Push and open the PR

- `git push -u origin <branch>`.
- From `dev`: `gh pr create --base main`. From `feat/*`: `gh pr create --base dev`.
- Body: a Summary section, a Test plan section listing the checks that ran, and the
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)` footer.
- Do not merge. Report the PR URL and what CI still needs to confirm.
