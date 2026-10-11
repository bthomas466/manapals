---
name: promote
description: Promote a reviewed ManaPals factory PR to production — final checks, merge, approval-gated prod migration, and a post-deploy smoke test. Use when the user runs /promote <pr#>.
argument-hint: <pr#>
disable-model-invocation: true
---

Promote PR $ARGUMENTS to production. Use `GH_HOST=github.com gh … --repo bthomas466/manapals` for every GitHub command.

## 1. Pre-flight (stop on any failure)
- `gh pr view <pr> --json state,mergeable,mergeStateStatus,labels,files,headRefName`: must be open and mergeable.
- `gh pr checks <pr>`: `checks` and `e2e` must pass. With the `db-change` label, `Migrate staging` must have succeeded too.
- If there are migrations, show the user each migration file's SQL and a plain-English summary of what it does to prod data.

## 2. Confirm with the user
Summarize: what ships, the migrations (if any), and that prod migrations will wait for their approval in GitHub. **Ask for an explicit "yes" before merging.** Merging deploys to production.

## 3. Merge
`gh pr merge <pr> --rebase --delete-branch`, then sync local `main` with `git pull --ff-only`.

## 4. Prod migration (only if `supabase/migrations/**` changed)
The `Migrate production` workflow starts on its own and waits for approval. Find the run with `gh run list --workflow migrate-prod.yml --limit 1`, and give the user the link: "Approve **db-production** at <url>." Never approve it yourself. Watch it after they approve, and report the dry-run output and the result.
Order matters: the app deploy and the migration run in parallel. If the new code depends on the new schema, warn the user that prod may briefly error until they approve the migration, and suggest approving right away.

## 5. Verify production
- `vercel ls manapals`: the newest Production deployment is Ready.
- `vercel curl /sign-in --deployment <prod-url> --yes`: returns the sign-in page.
- Ask the user to check the feature on prod themselves (only they can sign in with their real account).

## 6. Clean up
- Remove the run's worktree if one exists: `git worktree remove ../manapals-worktrees/<n>-<slug>`.
- The PR body's `Closes #n` closes the issue. Confirm it closed.

Report: what shipped, the migration result, the prod URL, and the closed issue.
