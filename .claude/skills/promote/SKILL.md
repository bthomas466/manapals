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
Summarize: what ships, the migrations (if any), and the release order below. **Ask for an explicit "yes" before merging.**

Production is **staged**: Vercel's "Auto-assign Custom Production Domains" is off, so merging builds a production deployment that does NOT serve traffic until it's promoted. That lets the prod migration land before the new code goes live.

## 3. Merge
`gh pr merge <pr> --rebase --delete-branch`, then sync local `main` with `git pull --ff-only`.

## 4. Wait for the staged production build
Find the deployment **by the merge commit's SHA**, not by position in `vercel ls`. Earlier merges leave staged production builds that were never promoted, so "the newest Ready Production row" can be the wrong one.

```
export MSHA=$(git rev-parse HEAD)   # after step 3's pull
vercel api "/v6/deployments?projectId=manapals&target=production&limit=10" --scope bran4 --raw | python3 -c '
import json, os, sys
d = json.loads(sys.stdin.read(), strict=False)  # commit messages contain raw control characters, which jq rejects
for x in d["deployments"]:
    if x.get("meta", {}).get("githubCommitSha") == os.environ["MSHA"]:
        print(x["url"], x.get("state") or x.get("readyState"))'
```
Repeat every ~10s until that deployment is `READY` (stop if `ERROR`: the build failed, nothing is live, so investigate with `vercel inspect <url> --logs`). Use **that** URL for every step below. Check it isn't live yet: `vercel inspect manapals.vercel.app` should still show the previous deployment. Before promoting, confirm the URL's commit equals `$MSHA`.

## 5. Prod migration (only if `supabase/migrations/**` changed)
The `Migrate production` workflow starts on its own and waits for approval. Find the run with `gh run list --workflow migrate-prod.yml --limit 1`, and give the user the link: "Approve **db-production** at <url>." Never approve it yourself. Watch it after they approve, report the dry-run output and the result, and **don't promote until it succeeds**. If it fails, stop: the old deployment keeps serving, and nothing user-facing has changed.

## 6. Promote and verify
1. Smoke-test the staged deployment before promoting: `vercel curl /sign-in --deployment <staged-url> --yes` returns the sign-in page.
2. Promote: `vercel promote <staged-url> --scope bran4 --yes`.
3. Confirm `vercel inspect manapals.vercel.app` now shows the new deployment, and `curl -s -o /dev/null -w "%{http_code}" https://manapals.vercel.app/sign-in` returns 200.
4. Mark it shipped on the board: `scripts/board-sync.sh Shipped <pr-url> --with-linked-issues`. This needs your local `gh` login to have the `project` scope; if it doesn't, tell the user to run `gh auth refresh -h github.com -s project`.
5. Ask the user to check the feature on prod themselves (only they can sign in with their real account).
6. Rollback, if needed: `vercel rollback --scope bran4` puts back the previous deployment instantly. Migrations are additive, so the old code keeps working against the new schema.

## 7. Clean up
- Remove the run's worktree if one exists: `git worktree remove ../manapals-worktrees/<n>-<slug>`.
- The PR body's `Closes #n` closes the issue. Confirm it closed.

Report: what shipped, the migration result, the prod URL, and the closed issue.
