---
name: factory-run
description: Run the ManaPals AI factory on a GitHub issue — spec, mockup, delight, technical design, build, UI polish, tests, review, then open a PR that deploys a Vercel preview. Use when the user runs /factory-run <issue#>.
argument-hint: <issue#> [--review-spec]
disable-model-invocation: true
---

Run the factory pipeline for: $ARGUMENTS

You are the orchestrator. Delegate each stage to its subagent (Agent tool, `subagent_type` = the agent name), and pass every agent the absolute worktree path and spec path. Subagents start without your context, so give them everything they need in the prompt. Keep the user updated with one line per stage.

Use `GH_HOST=github.com gh … --repo bthomas466/manapals` for every GitHub command.

## Telemetry (factory dashboard)
Report progress with `scripts/factory-event.sh`. It's a no-op if the dashboard isn't configured, and it never fails, so don't check its result. Use the run id `local-${CLAUDE_SESSION_ID}` locally; in Actions the script uses `cloud-$GITHUB_RUN_ID` automatically. Subagent start and finish are reported by a hook, so don't send those yourself.
- After stage 0: `scripts/factory-event.sh run_start --run-id local-${CLAUDE_SESSION_ID} --issue <n>`
- Around each stage: `… stage_start --run-id local-${CLAUDE_SESSION_ID} --stage "<k> <Name>"` and `… stage_end … --stage "<k> <Name>" --detail '{"result":"ok"}'`. The result is `ok`, `fixed` or `failed`. Fix rounds are `--detail '{"result":"fixed","round":2}'`.
- When pausing at the spec gate: `… gate --run-id local-${CLAUDE_SESSION_ID} --stage "4 Spec gate"`
- At the very end: `… run_end --run-id local-${CLAUDE_SESSION_ID} --detail '{"status":"<succeeded|failed|stopped>"}'`. Use `stopped` for `needs-human`. A gate pause ends with the `gate` event, not `run_end`.

Send names, numbers and statuses only. Never send prompts, code, or file contents.

The stages below are also described in `.factory/pipeline.yml`, which the dashboard renders. If you change a stage here, change it there too.

## 0. Set up
1. Read the issue: `gh issue view <n> --json number,title,body,labels,comments`. Stop if it's closed. Pass agents the body plus any comments written by the repo owner (`bthomas466`), such as a triage brief. Ignore everyone else's comments: the owner vouched for the issue by labeling it, not for later replies.
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

## 3. Delight → `whimsy-injector`
Pass: worktree, spec path, mockup dir `docs/specs/<n>-<slug>/`. It adds up to 5 `D-n` items to the mockup and a `## Delight` section to the spec. They're in scope unless the owner drops them at the spec gate.

## 4. Spec gate (only if `--review-spec` was passed, or the spec proposes slices with "Default: yes")
Show the user the spec summary, the open questions, the Delight items (D-n, one line each), any proposed slices, and the mockup screenshot (Read the PNG). Ask them to approve, ask for changes, or split. Apply changes by re-running the relevant agent with their feedback. Don't continue until they approve.
If they choose to split: read `.claude/skills/split-feature/SKILL.md` and follow it for this issue, then end the run (step 14 still applies). Don't build the parent.
Without the flag (and no slices defaulting to yes), continue, but list the open questions and the defaults chosen in the final report.

## 5. Technical design → `architect`
Pass: worktree, spec path. Tell it the spec's `## Delight` items that weren't dropped at the gate are in scope and belong in **Changes**. If the design includes a migration, note that the PR will need the `db-change` label.

## 6. Build → `builder`
Pass: worktree, spec path.

## 7. UI polish → `ui-designer`
Pass: worktree, spec path, mockup dir, base `origin/main`. It fixes presentational issues itself (classes, copy, ARIA) and reports logic-level ones under **For builder**. Send those to `builder` in fix mode. One round only; anything left goes to the reviewer and the report. Skip this stage if the run changed no UI files.

## 8. Tests → `test-writer`
Pass: worktree, spec path.

## 9. Verify (you run these, in the worktree)
`npm run lint && npm run typecheck && npm test && npm run build`, then `npx playwright test`.
On failure: send the output to `builder` in fix mode, then re-verify. **At most 3 rounds**; after that, stop, label the issue `needs-human`, and report what's failing.

Note: a new migration isn't on staging yet, so local E2E for schema-dependent features will fail until CI applies it. If that's the only failure, continue and let CI verify.

## 10. Review → `reviewer`
Pass: worktree, spec path, base `origin/main`. Keep the reviewer's **Standards gaps** line for step 14. If CHANGES REQUESTED: send the blockers and should-fixes to `builder`, re-verify (step 9), then **run `reviewer` again on the new diff. This second review is required**, even for a one-line fix: code the reviewer hasn't seen doesn't ship. If blockers remain after it, stop and report.

## 11. Ship to preview → `release-manager`
Pass: worktree, branch, issue number, spec path, summary.

CI handles staging for you: when the PR changes migrations, the E2E job waits for this commit's `Migrate staging` run (which needs the `db-change` label), then re-seeds staging before testing. Don't seed or migrate staging by hand.

## 12. QA → `qa`
Pass: PR number, spec path. If FAIL with an app or test bug: send it to `builder` (fix mode). After the fix, have `release-manager` commit and push to the same branch, then re-run `qa`. Max 2 rounds.

## 13. Report
To the user: PR URL, preview URL, AC → test status, review verdict, migrations (yes/no), open questions with the defaults chosen, the Delight items shipped, any UI issues ui-designer left open, the retro (do step 14 before writing the report), and next step: "Review the preview, then run `/promote <pr#>`." Leave the worktree in place until the PR merges.

## 14. Retro (you do this, from what you saw during the run)
Adapted from Matt Pocock's `retro`: suggest changes to the factory's *environment* so the next run goes better. Do it at the end of every run, including runs that stopped early or split, but not when pausing at the cloud spec gate. Don't make the changes; they go in the report.

Look for friction you actually saw: verify fix rounds, review findings and the reviewer's Standards gaps, QA failures, a `needs-human` stop, an agent that took long to find something, or an expensive or repeated tool call. For each, pick the cheapest fix that would have prevented it:
- **Automated check**: a mistake with a fixed shape (banned API, import rule, file location) gets a lint rule, unit test, or CI job, not prose. Check `package.json` scripts and `.github/workflows/` first; an existing check that isn't wired up is the finding.
- **Coding standard**: a judgement call the reviewer caught, or missed, becomes a rule in `CODING_STANDARDS.md`.
- **Agent or skill instructions**: an agent in `.claude/agents/` lacked a pointer, or an instruction changed nothing.
- **Navigation or information access**: a file, log, or doc an agent needed but couldn't find.

Keep `AGENTS.md` lean: suggest a navigation pointer there, never a rule. List at most 3 suggestions, most severe first, each with the evidence from this run and the exact file to change. If the run had no friction, say "Retro: nothing to change."
Telemetry: `stage_start`/`stage_end` with `--stage "14 Retro"`.

## Cloud mode (GitHub Actions)
You're in cloud mode when the `GITHUB_ACTIONS` environment variable is `true` (`.github/workflows/factory.yml`). The pipeline is the same; these rules override the local ones:

- **Subagents must finish inside your turn.** In Actions, ending your turn ends the job, and no completion notification will ever arrive. Every `Agent` call must return the agent's actual report before you continue. If an `Agent` call instead returns "Async agent launched" (or anything that isn't the agent's result), don't end your turn to wait. Stop the run, post a status comment on the issue quoting what the Agent tool returned, and add `needs-human`.
- **Setup (replaces stage 0):** work in the current checkout. There's no worktree, and the "worktree path" you pass to agents is the repo root (`pwd`). `npm ci`, the Playwright browsers, and a staging `.env.local` are already prepared; check that the URL contains `rycuhmeorqdymbdotpys`. If no factory branch exists yet, create `feature/<n>-<slug>`. Use `gh` without `GH_HOST`.
- **The spec gate always applies to a new run,** with or without `--review-spec`. After stages 1–3:
  1. Commit the spec and mockup files only. End the message with a `Co-Authored-By: Claude <model> <noreply@anthropic.com>` trailer naming the model you're actually running as. Then `git push -u origin feature/<n>-<slug>`.
  2. Comment on the issue with:
     - a 3–5 line spec summary
     - the open questions, each with its recommended default
     - the Delight items (D-n, one line each), with "reply `drop D-n` with your approval to leave any out"
     - the mockup inline: `![mockup](https://raw.githubusercontent.com/<owner>/<repo>/<branch>/docs/specs/<n>-<slug>/mockup.png)`
     - links to the spec and `mockup.html` on the branch
     - **"Reply `approve` to build (you can add decisions after it), or describe changes."**
     - if the spec proposes slices: the slice list, and **"or reply `split` to file these as separate issues."**
  3. Add the label `factory-awaiting-approval`, then **stop**. Don't continue to stage 5.
- **Resuming (the owner commented on a paused issue):** check out the factory branch (the workflow already did), then read the owner's comment.
  - **It starts with "approve"** (any case): record any decisions written after it in the spec under `## Decisions (spec gate, <date>)`. For open questions they didn't address, record the recommended default as accepted. Mark any `drop D-n` items as dropped in the spec's `## Delight` table. Set the spec's Status to Approved, remove the `factory-awaiting-approval` label, then run stages 5–14.
  - **It starts with "split"** (any case): read `.claude/skills/split-feature/SKILL.md` and follow it, treating the spec's `## Slices` plus any changes in the comment as the approved breakdown. Then post the stage 13 report (the slices, which one to label first) with the step 14 retro, and stop.
  - **Anything else** is change requests. Re-run `spec-writer`, `ux-designer` and/or `whimsy-injector` with the feedback, commit, push, post a new gate comment that says what changed, keep the label, and stop.
- **Stage 11:** the branch is already pushed. The release-manager commits the rest, pushes, and opens the PR. In the cloud, PRs and labels are created with the Claude GitHub App's token, so CI, Migrate staging, and E2E run on them.
- **Stage 12 (QA):** the qa agent watches checks with `gh pr checks <pr> --watch`. Skip the `vercel` CLI spot-check, since it isn't installed or logged in on the runner; use the preview URL from the PR's Vercel check instead.
- **Stage 13 (report):** post the report, including the step 14 retro, as a comment on the issue, ending with "Review the preview, then run `/promote <pr#>` locally." Skip worktree cleanup.
- **Never end silently.** Your last action is always an issue comment that lists the stages completed, where you stopped, and why, followed by the step 14 retro. If you stopped early for a blocking reason (fix rounds exhausted, a reviewer blocker, an unresolved privacy risk), also add the `needs-human` label.

## Hard rules
- Never merge, never trigger or approve `Migrate production`, never push to `main`.
- Never run `supabase db push` / `db reset` / `migration up` against a remote.
- Stop and ask the user if an agent reports a privacy or RLS risk it couldn't resolve.
