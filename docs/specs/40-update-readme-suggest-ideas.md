# Update the README: what ManaPals is, what it does, and how to suggest ideas
Issue: #40 · PRD refs: §1.1–1.2 (problem and vision), §2 (target users), §6 and §8 (out of scope and roadmap, for the "not yet" list) · Status: Draft

## Problem
The repo is public. For visitors and playgroup friends, the README is usually the first thing they see about ManaPals, and right now it is wrong and incomplete:
- **"Coming soon" lists things that have shipped.** Trade Match (`src/app/(main)/trades/`), Wishlist (`src/app/(main)/wishlist/`) and opt-in public collection visibility (`src/components/profile/VisibilityToggle.tsx`) all exist today.
- **"Available today" leaves out shipped features:**
  - trade availability flags, per card and per binder (#6)
  - the collection summary with total cards and estimated value (#11)
  - full loading of collections over 1,000 cards (#16, #21)
  - the new logo (#32)
  - card grid sizing for tablets and desktops (#33)
  - the new-user onboarding wizard at `/welcome` (#34)
- **There's no link to the live app** (https://manapals.vercel.app) and no logo.
- **There's no way for outsiders to suggest ideas or report problems.** The only issue template, `.github/ISSUE_TEMPLATE/feature.yml` ("Feature (AI factory)"), applies the `factory` label automatically. AGENTS.md says to label issues `factory` only when you trust their text, because that text is fed to the agents. Outsiders need their own path that doesn't use this label.

## Users & scenario
Priya plays in Brandon's Commander group. Brandon drops the GitHub link in the group chat, and she opens it on her phone.
1. At the top of the README she sees the ManaPals logo, a one-sentence pitch, and a "Try it" link to https://manapals.vercel.app. Below that is the existing note that ManaPals isn't affiliated with Manabox.
2. She scrolls through a short "What it is" paragraph and a plain-language feature list, written for players rather than developers. It covers import from Manabox, browsing collections, friends, trade matches, wishlist, trade flags and collection value. A short "Not yet" list follows, so she can see that notifications aren't built yet.
3. She wants a "last synced" badge on friends' profiles. Under **Suggest an idea or report a problem** she reads three steps:
   1. Open a suggestion.
   2. The maintainer reviews it.
   3. If it's a good fit, it may get built, and the issue is updated.
4. She taps the "Suggest an idea" link. GitHub opens the issue form for the new suggestion template, with no `factory` label attached. She fills in a couple of fields and submits.
5. The issue lands unlabeled in the project board's **Intake** column, as `board.yml` does today for unlabeled issues. Later Brandon reads it, edits it if needed, and adds `factory` himself, which is the only way a factory run starts.
6. Developers who scroll further down still find Getting started and Tech stack, unchanged except for the small corrections listed below.

## Scope
### In scope
- **Rewrite the top of `README.md`, written for non-developers.** In this order:
  1. Logo
  2. Title
  3. One-line pitch
  4. Live app link
  5. The existing not-affiliated note, kept word for word
  6. "What it is" (keep the current paragraph; light edits only)
  7. Features
  8. Suggest an idea or report a problem
  9. Getting started
  10. Tech stack
- **Logo.** Use an image from `public/brand/` with a relative path. Default: `public/brand/concept-3.svg`, the mark on its own dark tile, which reads well in both GitHub light and dark themes (Q1).
- **Live link.** Add https://manapals.vercel.app near the top.
- **Features: what's available today, matching the code.** Cover:
  - Google sign-in
  - Manabox CSV import with Scryfall card data
  - the guided onboarding wizard for new users
  - collection browsing with search, filters and sort
  - collections over 1,000 cards
  - the collection summary (total cards and estimated value)
  - trade availability flags, per card and per binder
  - wishlist
  - Trade Match with a friend
  - friend requests
  - friends-only collections by default, with an opt-in public setting
  - profile pages at `/u/<username>`
  - a layout that works on phones, tablets and desktops

  The new logo is a visual change, not a feature. It shows up as the README image and doesn't need its own bullet (Q2).
- **Features: not yet built.** Only list things that are actually missing from the code:
  - Apple sign-in
  - email or in-app notifications (US-20)
  - link previews / Open Graph (US-23)
  - "last synced" display (US-19)
  - shareable card links (US-21)
  - public discovery, other CSV formats, and collection analytics (PRD §6 and §8)

  Before writing this list, the builder checks each item against `src/`.
- **A "Suggest an idea or report a problem" section.**
  - Explains the flow in three steps: suggest → maintainer reviews → may get built.
  - Links directly to the new template: `https://github.com/bthomas466/manapals/issues/new?template=<new-file>.yml`.
  - Says that not every suggestion will be built and that there's no promised timeline.
  - Doesn't link to `feature.yml` and doesn't mention the `factory` label to outsiders.
- **A new issue template** in `.github/ISSUE_TEMPLATE/`, for example `suggestion.yml` named "Suggest an idea or report a problem". It's an issue form (YAML) and:
  - has **no** `labels` key, or an empty one, so `factory` is never attached
  - has a title prefix such as `[Suggestion] `
  - has a required "What would you like?" textarea
  - has an optional "Why / what happened?" textarea
  - has a dropdown "Kind: Idea / Something's broken" (Q3)
  - has a short intro markdown block saying the maintainer reviews every suggestion before anything is built
- **Mark `feature.yml` as maintainer-only.** Change only its `name` and `description` so outsiders who browse the template chooser don't pick it, for example "Feature (AI factory, maintainer only)". Keep its `labels: [factory]` and its fields as they are, so the owner's `/feature` and cloud flows keep working (Q4).
- **Small corrections to Getting started.**
  - Add `npm run typecheck`, `npm test` and `npm run test:e2e` to "Other scripts". All three exist in `package.json`.
  - Keep the rest as it is.
- **A Vitest test** (for example `tests/unit/readme.test.ts`) that reads `README.md` and the template files from disk and checks the ACs below. No app code changes.

### Out of scope
- Enabling GitHub Discussions (it's off today) or adding a Discussions link in `config.yml` (Q5).
- A separate "Report a bug" template. One suggestion template covers both, using the Kind dropdown (Q3).
- Changing `config.yml`, including `blank_issues_enabled` (Q6), or adding `contact_links`.
- Creating new repo labels (for example `suggestion`, `bug`). This spec only touches files (Q7).
- Changing `feature.yml` fields or labels, `factory.yml`, `board.yml`, or any workflow.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, a license, or a PR template.
- Screenshots or GIFs of the app in the README (Q8).
- Documenting the AI factory, the staging/prod setup, or the board in the README. That stays in AGENTS.md.
- Any app code, UI, route, migration or in-app "send feedback" link.
- Rewriting or retouching the PRD.

## Acceptance criteria
All of these are Vitest tests that read files from the repo root. "Top section" means the README text before the first `## Getting started` heading.

**Identity and live link**
- **AC-1** *(live link)*
  - **Given** `README.md`,
  - **When** it's read,
  - **Then** the top section has a Markdown or HTML link whose target is exactly `https://manapals.vercel.app` (an optional trailing `/` is fine).
- **AC-2** *(logo)*
  - **Given** `README.md`,
  - **When** image references (`![...](...)` or `<img src>`) in the first 10 lines are collected,
  - **Then** at least one is a relative path under `public/brand/`, and that file exists on disk.
- **AC-3** *(kept sections)*
  - **Given** `README.md`,
  - **Then** it still contains the not-affiliated note: the exact sentence "ManaPals is not affiliated with Manabox or SkillDevs SC."
  - **And** it has the headings `## What it is`, `## Getting started` and `## Tech stack`.
  - **And** `## What it is` and the features heading appear before `## Getting started`.

**Features are accurate**
- **AC-4** *(shipped features are listed as available)*
  - **Given** the text under the "available today" part of the features section, which ends at the next "not yet" or "coming soon" subheading,
  - **Then** it mentions, case-insensitively, each of:
    - "trade match"
    - "wishlist"
    - "onboarding"
    - "available to trade" or "trade availability"
    - "estimated value" or "collection value"
    - "public"
    - "friend"
- **AC-5** *(shipped features aren't listed as coming)*
  - **Given** the "not yet" or "coming soon" list in the README,
  - **Then** it contains none of: "Trade Match", "Wishlist", "public collection visibility" (case-insensitive).
- **AC-6** *(no stale wording)*
  - **Given** `README.md`,
  - **Then** it doesn't contain the phrase "so trade matching has something to match against". That line is from the old "Coming soon" list.

**Suggesting ideas**
- **AC-7** *(section and flow)*
  - **Given** `README.md`,
  - **Then** it has a heading containing "Suggest" that appears before `## Getting started`.
  - **And** that section contains, in this order, a step about suggesting or opening an issue, a step about the maintainer reviewing it, and a step saying it may get built. In the test: the words "suggest", "review" and "built" appear in that order, case-insensitive.
- **AC-8** *(links to the safe template)*
  - **Given** the suggest section,
  - **Then** it contains a link matching `https://github.com/bthomas466/manapals/issues/new?template=<file>`, where `<file>` exists in `.github/ISSUE_TEMPLATE/` and isn't `feature.yml`.
- **AC-9** *(outsiders aren't sent to the factory)*
  - **Given** `README.md`,
  - **Then** it contains neither `template=feature.yml` nor the string `factory` in its top section.
- **AC-10** *(new template is a valid form without the factory label)*
  - **Given** the template file from AC-8,
  - **When** it's parsed as YAML,
  - **Then** it has non-empty `name`, `description` and `body`.
  - **And** `labels` is either missing or doesn't include `factory`.
  - **And** `body` includes at least one `textarea` with `validations.required: true`.
  - **And** `body` includes a `dropdown` whose options include an idea option and a broken/bug option.
- **AC-11** *(new template explains triage)*
  - **Given** the same template,
  - **Then** a `markdown` body element mentions that the maintainer reviews suggestions (the word "review", case-insensitive).
- **AC-12** *(owner flow unchanged)*
  - **Given** `.github/ISSUE_TEMPLATE/feature.yml`,
  - **When** it's parsed,
  - **Then** `labels` still equals `[factory]` and its body field ids are still `idea`, `why`, `notes`.
  - **And** its `name` or `description` contains "maintainer" (case-insensitive).
- **AC-13** *(only one template auto-applies `factory`)*
  - **Given** every `*.yml` in `.github/ISSUE_TEMPLATE/` except `config.yml`,
  - **Then** exactly one of them (`feature.yml`) has `factory` in `labels`.

**Links and privacy**
- **AC-14** *(relative links resolve)*
  - **Given** every relative link or image path in `README.md` (not starting with `http`, `#` or `mailto:`),
  - **Then** the target file or directory exists in the repo.
- **AC-15** *(no internal project details)*
  - **Given** `README.md`,
  - **Then** it doesn't contain the Supabase project refs `rycuhmeorqdymbdotpys` or `wzjkexompmfvuxnmkzxl`.
  - **And** it doesn't contain the string `SERVICE_ROLE_KEY=` followed by a value. The empty placeholder `SUPABASE_SERVICE_ROLE_KEY=` on its own line is allowed.
- **AC-16** *(scripts are real)*
  - **Given** each `npm run <name>` in `README.md`,
  - **Then** `<name>` is a key in `package.json` `scripts`.
  - (`npm test` and `npm install` are exempt.)

## Data & privacy
- No data is stored and there are no schema, RLS or app changes.
- The README describes privacy accurately: collections are **friends-only by default**, and a user can choose to make theirs public. It must not suggest that collections are public by default (PRD §5.3).
- Issues filed with the new template are public GitHub issues. The template's intro should tell people not to include personal information such as email addresses or other contact details.
- Outside issue text never reaches the factory automatically:
  - The new template doesn't apply `factory`.
  - `factory.yml` already runs only when the repo owner is the sender.
  - The owner decides whether to add `factory` after reading the issue.

## UX notes
- **Surfaces:**
  - the GitHub README, read on mobile and desktop, in light and dark themes
  - the GitHub "New issue" template chooser and the suggestion form
- **README:**
  - Keep the top section short: roughly one screen on a phone before the features list.
  - Use plain words such as "your friends' cards", "cards you want". Avoid "RLS" and "CSV parsing pipeline" above Getting started. "CSV" is fine, because Manabox users export one.
- **Template chooser:** the suggestion template should come before "Feature (AI factory, maintainer only)". GitHub sorts templates by filename, so pick a filename that sorts first, for example `1-suggestion.yml` or `idea.yml`. The architect decides.
- **States:** not applicable. These are static documents with no loading, empty or error states. The form's only error state is GitHub's own required-field validation (AC-10).

## Open questions
- **Q1. Which logo image?**
  - `concept-3-lockup.svg` is built for dark backgrounds and would look wrong in GitHub's light theme.
  - A `<picture>` that switches between the dark lockup and `docs/brand/concept-3-lockup-light.svg` is possible, but it adds complexity and points into `docs/`.
  - **Default:** the mark `public/brand/concept-3.svg` at about 96 px, next to the `# ManaPals` heading.
- **Q2. Should the logo, grid sizing and onboarding be called out as features?** The issue asks for them to be mentioned.
  - **Default:** mention onboarding as a feature ("guided setup for new users") and grid sizing as "works on phones, tablets and desktops". Let the logo image speak for #32, with no bullet.
- **Q3. One template or two (idea and bug)?**
  - **Default:** one template with a Kind dropdown. It's simpler and gives one link in the README. Split later if bug reports need their own fields.
- **Q4. How do we keep outsiders away from `feature.yml`?** GitHub can't hide a template from non-collaborators. Anyone could still pick it, and it would add `factory` to their issue.
  - The real safeguard already exists: `factory.yml` only runs when the owner is the sender, so an outsider's issue labeled at creation never starts a run.
  - The leftover risk is board noise. `board.yml` would put such an issue in **Spec**, and if the owner later re-applies the label, the run would use text he didn't write.
  - **Default:** rename the template to say "maintainer only". Make no other change. The owner should check the author before running any `factory`-labeled issue.
  - **Alternative for the owner to decide:** move factory intake out of issue templates entirely. `/feature` could add the label itself after creating the issue. That's out of scope here.
- **Q5. Should we use Discussions instead?** Discussions are disabled on the repo today. Enabling them is a repo setting, not a file change, and it would split intake across two places.
  - **Default:** use the issue template. It feeds the existing board's Intake column and needs no settings change.
- **Q6. Should blank issues be turned off?** `config.yml` has `blank_issues_enabled: true`. Blank issues carry no labels, so they're safe, but they skip the structured form.
  - **Default:** leave it unchanged. Revisit if blank issues turn out to be low quality.
- **Q7. Should suggestion issues get a `suggestion` label?** A form only applies labels that already exist in the repo, so this would also need a label created through the GitHub UI or API.
  - **Default:** no label. Unlabeled issues already land in Intake, which marks them as untriaged. The owner can create a label later and add it to the template.
- **Q8. Should the README include screenshots?** They'd help non-developers, but they go stale quickly, and the E2E baselines are test artifacts rather than marketing images.
  - **Default:** no screenshots in this change. Track separately if wanted.
- **Q9. Who is named as the maintainer?**
  - **Default:** say "the maintainer" and link to the owner's GitHub profile (`@bthomas466`). Don't give an email address.

## Design
Mockup: [mockup.html](40-update-readme-suggest-ideas/mockup.html) · Screenshot: [mockup.png](40-update-readme-suggest-ideas/mockup.png)

A static approximation of GitHub's light theme at 390px. It is not app UI, so ManaPals tokens are not used. Only the logo is the real `concept-3.svg` mark.

1. **README top (phone, light).** Logo at 96px beside the title, pitch, "Try it" link, not-affiliated note, What it is, Features (Available today / Not yet), Suggest section with the 3 steps and a "no promised timeline" line. AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-8, AC-9.
2. **Template chooser.** The suggestion template appears first, and "Feature (AI factory, maintainer only)" second. AC-12, AC-13.
3. **Issue form, default.** Intro callout (maintainer reviews; don't post personal info), `[Suggestion] ` title prefix, Kind dropdown, required "What would you like?", optional "Why / what happened?". AC-10, AC-11.
4. **Issue form, dropdown open and required-field error.** Options are Idea and Something's broken. The error is GitHub's own validation. AC-10.

Decisions: the logo uses the dark tile `concept-3.svg` (Q1 default). The form has no labels. The README link text says "Open a suggestion" and never mentions `factory`.
