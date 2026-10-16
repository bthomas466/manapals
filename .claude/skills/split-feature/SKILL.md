---
name: split-feature
description: Split a ManaPals feature issue that's too big for one factory PR into tracer-bullet slice issues with native blocking links. Use when the user runs /split-feature <issue#>, or when factory-run's spec gate gets a "split" reply.
argument-hint: <issue#>
disable-model-invocation: true
---

Split this feature into slice issues: $ARGUMENTS

Adapted from Matt Pocock's `to-tickets`. The factory builds one issue as one PR; this turns a big feature into a chain of issues the factory can build one at a time.

Use `GH_HOST=github.com gh … --repo bthomas466/manapals` locally; in GitHub Actions use plain `gh`. `gh api` paths below spell out `repos/bthomas466/manapals`.

## 1. Gather context
- Read the parent issue: `gh issue view <n> --json number,title,body,labels,comments`.
- If a spec exists for it, read it: `docs/specs/<n>-*.md` in the current checkout, or on the `feature/<n>-*` branch (`git ls-remote --heads origin "feature/<n>-*"`, then `git show origin/<branch>:docs/specs/<file>`). Its `## Slices` section is the starting proposal.
- Skim the code the feature touches so slices fit what exists. Look for prefactoring that makes the rest easy; it goes first.

## 2. Draft the slices
Each slice is a **tracer bullet**:
- a narrow but complete path through every layer it needs (schema with RLS, `src/lib` logic, UI, tests), demoable on its own, never one layer alone;
- small enough for one factory run and one reviewable PR;
- with its blocking edges: the slices that must merge before it can start.

Every acceptance criterion of the parent belongs to exactly one slice.

## 3. Confirm the breakdown
- **Interactive** (a user is present): show a numbered list, each with title, blocked by, and what it delivers. Ask whether the granularity and edges are right; iterate until approved.
- **Factory spec gate** (the owner replied "split"): the spec's `## Slices` plus any changes written in the owner's reply are the approved breakdown. Don't ask.

## 4. Publish
Create the issues in dependency order (blockers first), so edges can point at real numbers. For each slice:

```
gh issue create --label ready-for-agent --title "[Feature] <slice title>" --body "<body>"
```

Body, matching `.github/ISSUE_TEMPLATE/feature.yml`:

```
### Idea
<the end-to-end behavior this slice makes work, from the user's side>

### Why
Slice <k> of #<parent>: <one line on how it moves the parent forward>.

### Notes
Part of #<parent>. Parent spec: <link to the spec on its branch, if one exists>.

Acceptance criteria (from the parent spec):
- [ ] <AC text, keeping its parent AC number>

Blocked by: #<n>, #<n> (or "none")
```

Avoid file paths and code in the body (they go stale), except schema or type shapes the parent spec settled.

Then link it to the parent and its blockers using GitHub's native relations. Both take the numeric **database id**, not the issue number:

```
id=$(gh api repos/bthomas466/manapals/issues/<slice> --jq .id)
gh api --method POST repos/bthomas466/manapals/issues/<parent>/sub_issues -F sub_issue_id=$id
blocker_id=$(gh api repos/bthomas466/manapals/issues/<blocker> --jq .id)
gh api --method POST repos/bthomas466/manapals/issues/<slice>/dependencies/blocked_by -F issue_id=$blocker_id
```

If either API call fails, the `Part of` and `Blocked by` lines in the body are the fallback; carry on.

**Never add the `factory` label.** It starts a cloud run, and GitHub keeps only one waiting factory run, so the owner labels slices one at a time as their blockers merge.

## 5. Hand back the parent
- Comment on the parent: the slice list (number, title, blocked by) and "Add the `factory` label to #<first unblocked slice> to start building."
- If the parent has the `factory` label, remove it **first**, then remove `factory-awaiting-approval` if present (the board moves the parent back to Intake only when `factory` is already gone). Don't close or otherwise edit the parent; it tracks the slices.

Return: the slice issues with their blockers, and which one to label first.
