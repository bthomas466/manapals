---
name: feature
description: File a new ManaPals feature idea as a GitHub issue for the AI factory. Use when the user runs /feature or asks to log a feature idea for the factory.
argument-hint: <idea in plain language>
disable-model-invocation: true
---

File this idea for the ManaPals factory: $ARGUMENTS

1. If the idea is too vague to act on (no clear user or outcome), ask the user one or two short questions first. Otherwise don't ask.
2. Check for duplicates: `GH_HOST=github.com gh issue list --repo bthomas466/manapals --label factory --state open --search "<keywords>"`. If one looks like the same idea, show it and ask whether to file anyway.
3. Note any related PRD user stories by grepping `docs/manabox-companion-prd.md` (e.g. US-11).
4. Create the issue, matching the sections of `.github/ISSUE_TEMPLATE/feature.yml`:
   ```
   GH_HOST=github.com gh issue create --repo bthomas466/manapals --label factory \
     --title "[Feature] <short title>" --body "<### Idea / ### Why / ### Notes sections>"
   ```
   Keep the user's wording in Idea; add PRD refs in Notes.
5. Reply with the issue URL and: "Run `/factory-run <number>` to build it."
