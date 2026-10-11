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

## 10. QA → `qa`
Pass: PR number, spec path. If FAIL with an app or test bug: send it to `builder` (fix mode). After the fix, have `release-manager` commit and push to the same branch, then re-run `qa`. Max 2 rounds.

## 11. Report
To the user: PR URL, preview URL, AC → test status, review verdict, migrations (yes/no), open questions with the defaults chosen, and next step: "Review the preview, then run `/promote <pr#>`." Leave the worktree in place until the PR merges.

## Hard rules
- Never merge, never trigger or approve `Migrate production`, never push to `main`.
- Never run `supabase db push` / `db reset` / `migration up` against a remote.
- Stop and ask the user if an agent reports a privacy or RLS risk it couldn't resolve.
