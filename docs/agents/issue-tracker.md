# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues on `bthomas466/manapals`. Use the `gh` CLI for all operations.

**Always prefix with `GH_HOST=github.com` and pass `--repo bthomas466/manapals`.** This machine's default `gh` host is a different GitHub, so bare `gh` commands hit the wrong server. Below, `GH` stands for `GH_HOST=github.com gh` and every command takes `--repo bthomas466/manapals` (omitted for brevity; `gh api` paths spell out `repos/bthomas466/manapals` instead).

## Conventions

- **Create an issue**: `GH issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `GH issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `GH issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `GH issue create --parent <parent> ...`, or `GH issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `GH api --method POST repos/bthomas466/manapals/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Comment on an issue**: `GH issue comment <number> --body "..."`
- **Apply / remove labels**: `GH issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `GH issue close <number> --comment "..."`

## Specs live in the repo, not on the issue

The issue is only the original idea. The factory's spec for issue `#<n>` is `docs/specs/<n>-<slug>.md` (on `main` once merged, or on the `feature/<n>-<slug>` branch before that), and its mockup is in `docs/specs/<n>-<slug>/`. When a skill looks for "the spec" behind an issue or branch (e.g. `/code-review`), use that file; fall back to the issue only when no spec exists. Don't use `/to-spec` to publish specs as issues.

## Factory labels

This repo runs an AI factory driven by labels (see `AGENTS.md`). Skills must not touch these unless the user explicitly asks:

- **`factory`**: adding it starts a cloud factory run on the issue. Never apply it as part of triage or ticket creation; the owner adds it, one issue at a time. Tickets go to `ready-for-agent` instead. To split a big feature into tickets, prefer `/split-feature <issue#>`, which knows the factory's issue format.
- **`factory-awaiting-approval`**, **`needs-human`**, **`db-change`**: managed by workflows and the factory pipeline.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `GH pr view <number> --comments` and `GH pr diff <number>` for the diff.
- **List external PRs for triage**: `GH api --paginate 'repos/bthomas466/manapals/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `GH pr comment`, `GH pr edit --add-label`/`--remove-label`, `GH pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `GH pr view 42` and fall back to `GH issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `GH issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `GH api --method POST repos/bthomas466/manapals/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`GH api repos/bthomas466/manapals/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`GH issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `GH issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `GH issue comment <n> --body "<answer>"`, then `GH issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
