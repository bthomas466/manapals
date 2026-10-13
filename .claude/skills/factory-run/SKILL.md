---
name: factory-run
description: Run the ManaPals AI factory on a GitHub issue — spec, mockup, technical design, build, tests, review, then open a PR that deploys a Vercel preview. Use when the user runs /factory-run <issue#>.
argument-hint: <issue#> [--review-spec]
disable-model-invocation: true
---

Run the factory pipeline for: $ARGUMENTS

You are the orchestrator. Delegate each stage to its subagent (Agent tool, `subagent_type` = the agent name), and pass every agent the absolute worktree path and spec path. Subagents start without your context, so give them everything they need in the prompt. Keep the user updated with one line per stage.

Use `GH_HOST=github.com gh … --repo bthomas466/manapals` for every GitHub command.

## 0. Set up
1. Read the issue: `gh issue view <n> --json number,title,body,labels`. Stop if it's closed.
2. Slug: 3–5 lowercase words from the title, joined with hyphens. Branch: `feature/<n>-<slug>`.
3. Worktree, so the user's checkout is never touched:
   ```
   git fetch origin main
   git worktree add ../manapals-worktrees/<n>-<slug> -b feature/<n>-<slug> origin/main
   cp .env.local ../manapals-worktrees/<n>-<slug>/.env.local
   cd ../manapals-worktrees/<n>-<slug> && npm ci
   ```
   Before copying, confirm `.env.local` points at staging (its NEXT_PUBLIC_SUPABASE_URL contains `rycuhmeorqdymbdotpys`). If it doesn't, stop and tell the user.
4. Spec path: `docs/specs/<n>-<slug>.md` (inside the worktree).
5. Comment on the issue: "🏭 Factory run started".

## 1. Spec → `spec-writer`
Pass: issue number, title, body, worktree, spec path.

## 2. Mockup → `ux-designer`
Pass: worktree, spec path, output dir `docs/specs/<n>-<slug>/`.

## 3. Spec gate (only if `--review-spec` was passed)
Show the user the spec summary, the open questions, and the mockup screenshot (Read the PNG). Ask them to approve or give changes. Apply changes by re-running the relevant agent with their feedback. Don't continue until they approve.
Without the flag, continue, but list the open questions and the defaults chosen in the final report.

## 4. Technical design → `architect`
Pass: worktree, spec path. If the design includes a migration, note that the PR will need the `db-change` label.

## 5. Build → `builder`
Pass: worktree, spec path.

## 6. Tests → `test-writer`
Pass: worktree, spec path.

## 7. Verify (you run these, in the worktree)
`npm run lint && npm run typecheck && npm test && npm run build`, then `npx playwright test`.
On failure: send the output to `builder` in fix mode, then re-verify. **At most 3 rounds**; after that, stop, label the issue `needs-human`, and report what's failing.

Note: a new migration isn't on staging yet, so local E2E for schema-dependent features will fail until CI applies it. If that's the only failure, continue and let CI verify.

## 8. Review → `reviewer`
Pass: worktree, spec path, base `origin/main`. If CHANGES REQUESTED: send the blockers and should-fixes to `builder`, re-verify (step 7), then re-review once. If blockers remain, stop and report.

## 9. Ship to preview → `release-manager`
Pass: worktree, branch, issue number, spec path, summary.

CI handles staging for you: when the PR changes migrations, the E2E job waits for this commit's `Migrate staging` run (which needs the `db-change` label), then re-seeds staging before testing. Don't seed or migrate staging by hand.

## 10. QA → `qa`
Pass: PR number, spec path. If FAIL with an app or test bug: send it to `builder` (fix mode). After the fix, have `release-manager` commit and push to the same branch, then re-run `qa`. Max 2 rounds.

## 11. Report
To the user: PR URL, preview URL, AC → test status, review verdict, migrations (yes/no), open questions with the defaults chosen, and next step: "Review the preview, then run `/promote <pr#>`." Leave the worktree in place until the PR merges.

## Cloud mode (GitHub Actions)
You're in cloud mode when the `GITHUB_ACTIONS` environment variable is `true` (`.github/workflows/factory.yml`). The pipeline is the same; these rules override the local ones:

- **Subagents must finish inside your turn.** In Actions, ending your turn ends the job, and no completion notification will ever arrive. Every `Agent` call must return the agent's actual report before you continue. If an `Agent` call instead returns "Async agent launched" (or anything that isn't the agent's result), don't end your turn to wait. Stop the run, post a status comment on the issue quoting what the Agent tool returned, and add `needs-human`.
- **Setup (replaces stage 0):** work in the current checkout. There's no worktree, and the "worktree path" you pass to agents is the repo root (`pwd`). `npm ci`, the Playwright browsers, and a staging `.env.local` are already prepared; check that the URL contains `rycuhmeorqdymbdotpys`. If no factory branch exists yet, create `feature/<n>-<slug>`. Use `gh` without `GH_HOST`.
- **The spec gate always applies to a new run,** with or without `--review-spec`. After stages 1–2:
  1. Commit the spec and mockup files only. The message's last line must be exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Then `git push -u origin feature/<n>-<slug>`.
  2. Comment on the issue with:
     - a 3–5 line spec summary
     - the open questions, each with its recommended default
     - the mockup inline: `![mockup](https://raw.githubusercontent.com/<owner>/<repo>/<branch>/docs/specs/<n>-<slug>/mockup.png)`
     - links to the spec and `mockup.html` on the branch
     - **"Reply `approve` to build (you can add decisions after it), or describe changes."**
  3. Add the label `factory-awaiting-approval`, then **stop**. Don't continue to stage 4.
- **Resuming (the owner commented on a paused issue):** check out the factory branch (the workflow already did), then read the owner's comment.
  - **It starts with "approve"** (any case): record any decisions written after it in the spec under `## Decisions (spec gate, <date>)`. For open questions they didn't address, record the recommended default as accepted. Set the spec's Status to Approved, remove the `factory-awaiting-approval` label, then run stages 4–11.
  - **Anything else** is change requests. Re-run `spec-writer` and/or `ux-designer` with the feedback, commit, push, post a new gate comment that says what changed, keep the label, and stop.
- **Stage 9:** the branch is already pushed. The release-manager commits the rest, pushes, and opens the PR. In the cloud, PRs and labels are created with the Claude GitHub App's token, so CI, Migrate staging, and E2E run on them.
- **Stage 10 (QA):** the qa agent watches checks with `gh pr checks <pr> --watch`. Skip the `vercel` CLI spot-check, since it isn't installed or logged in on the runner; use the preview URL from the PR's Vercel check instead.
- **Stage 11 (report):** post the report as a comment on the issue, ending with "Review the preview, then run `/promote <pr#>` locally." Skip worktree cleanup.
- **Never end silently.** Your last action is always an issue comment that lists the stages completed, where you stopped, and why. If you stopped early for a blocking reason (fix rounds exhausted, a reviewer blocker, an unresolved privacy risk), also add the `needs-human` label.

## Hard rules
- Never merge, never trigger or approve `Migrate production`, never push to `main`.
- Never run `supabase db push` / `db reset` / `migration up` against a remote.
- Stop and ask the user if an agent reports a privacy or RLS risk it couldn't resolve.
