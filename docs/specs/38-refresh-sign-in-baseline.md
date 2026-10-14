# Refresh the sign-in screenshot baseline for the new logo
Issue: #38 · PRD refs: US-01 (sign-in), §5.2 (mobile experience) · Status: Draft

## Problem
The `sign-in page visual` test in `tests/e2e/auth.spec.ts` no longer checks the real sign-in page.

- The linux baseline `tests/e2e/__screenshots__/linux/auth.spec.ts/sign-in.png` was added in f78252c. The darwin baseline `tests/e2e/__screenshots__/darwin/auth.spec.ts/sign-in.png` was added in fd2269a. Both are older than the logo, so they show the old joker emoji in a grey box above the "ManaPals" heading.
- PR #36 (issue #32) replaced the emoji with the ManaPals mark (`/brand/concept-3.svg`, 64×64). Spec #32's AC-13 asked for new baselines, but they were never committed.
- The test still passes because `playwright.config.ts` allows `maxDiffPixelRatio: 0.01`. The page is 412×839 px, so 1% is about 3,456 px. The 64×64 logo area is at most 4,096 px, and most of those pixels are background, so the actual difference stays under the limit.

As a result, the stored picture of the sign-in page is wrong, and a change of similar size (a missing logo, a changed heading color) would also pass unnoticed.

## Users & scenario
The users here are the factory and the repo owner. End users see no change.

1. A future PR breaks the sign-in logo, for example with a wrong `src`, so the browser shows only the alt text.
2. The Vercel preview deploys, and the E2E workflow runs on linux with a Pixel 7 viewport.
3. `sign-in page visual` compares the page with a baseline that does show the ManaPals mark. The difference is above the threshold for this screenshot, so the test fails. The `playwright-report` artifact shows the missing logo in the diff.
4. Today, the same PR would pass, because the baseline has the emoji and the threshold hides the difference.

## Scope
### In scope
- **New linux baseline.** Replace `tests/e2e/__screenshots__/linux/auth.spec.ts/sign-in.png` with a capture of the current sign-in page, logo included. Take it from the `linux-screenshots` artifact of the E2E workflow (see Q1). Don't generate it locally.
- **Stale darwin baseline.** The darwin baseline is also older than the logo, and CI can't produce darwin images. Default: delete it. Because `updateSnapshots: "missing"` is set, the next local macOS run writes a fresh one (Q2).
- **Make the visual test catch logo-sized changes.** Give this one `toHaveScreenshot("sign-in.png", …)` call a tighter limit than the global 1%, small enough that a removed or swapped 64×64 logo fails it. Default: `maxDiffPixelRatio: 0.002`, about 690 px (Q3). Leave the global default in `playwright.config.ts` as it is.
- **Wait for the logo before the screenshot.** In `sign-in page visual`, before taking the screenshot, assert that `getByRole("img", { name: "ManaPals logo" })` is visible and has loaded (`naturalWidth > 0`). This keeps the baseline from catching the image half-loaded. It also gives the test a failure that doesn't depend on screenshot tolerance. That is the optional assertion from the issue, placed in the existing test.

### Out of scope
- Any app code change. `src/app/(auth)/sign-in/page.tsx` and the assets in `public/brand/` stay as they are.
- Adding screenshot baselines for other pages, for example the signed-in header from #32 or the collection grid.
- Lowering the global `maxDiffPixelRatio`, or switching to per-test masks or thresholds across the suite.
- Changing `.github/workflows/e2e.yml`. For example, uploading only changed baselines, or adding a darwin runner.
- Duplicating `tests/e2e/brand.spec.ts` AC-11, which already checks that the sign-in logo is visible, loaded and byte-identical to the source art. This spec only adds the pre-screenshot wait in `auth.spec.ts`. It doesn't add a second copy of the asset checks.
- Rewriting baseline history, or removing the old `sign-in.png` from git history.

## Acceptance criteria
"E2E" means Playwright in the `mobile` project (Pixel 7, signed out) as run by the CI E2E workflow on linux.

- **AC-1** *(visual test passes against the new baseline)*
  - **Given** the committed linux baseline `tests/e2e/__screenshots__/linux/auth.spec.ts/sign-in.png`,
  - **When** the CI E2E workflow runs `auth.spec.ts` "sign-in page visual" against the PR's Vercel preview,
  - **Then** the test passes with the tighter per-assertion limit from AC-3,
  - **And** the `linux-screenshots` artifact for that run holds the same file as the committed one, because nothing was written as missing.
- **AC-2** *(the new baseline has the logo)*
  - **Given** the PR's final commit,
  - **When** a unit test (Vitest) reads `tests/e2e/__screenshots__/linux/auth.spec.ts/sign-in.png`,
  - **Then** it is a 412×839 PNG (from the IHDR header), matching the Pixel 7 full-page size,
  - **And** its bytes differ from the f78252c baseline: its sha256 is not `<old hash>`. The architect fills in the hash of the f78252c blob as a constant.
  - The tight limit in AC-1 together with the visible-logo check in AC-4 proves the logo is in the image. AC-2 only guards against the old file being committed again.
- **AC-3** *(the tighter limit is set on this screenshot only)*
  - **Given** `tests/e2e/auth.spec.ts`,
  - **When** the `sign-in.png` screenshot assertion runs,
  - **Then** it passes its own `maxDiffPixelRatio` (default `0.002`) or an equivalent `maxDiffPixels`, which is below the pixel count of a 64×64 logo on a 412×839 page,
  - **And** `playwright.config.ts` still sets the global `toHaveScreenshot: { maxDiffPixelRatio: 0.01 }`.
- **AC-4** *(logo loaded before the screenshot)*
  - **Given** a signed-out visitor on `/sign-in`,
  - **When** "sign-in page visual" runs,
  - **Then** before `toHaveScreenshot`, it asserts that `img` with accessible name "ManaPals logo" (`src` containing `/brand/concept-3.svg`) is visible,
  - **And** that its `naturalWidth` is greater than 0, polled with `expect.poll`.
- **AC-5** *(the guard catches a broken logo: negative check)*
  - **Given** the new baseline and the tighter limit,
  - **When** "sign-in page visual" runs with requests to `/brand/concept-3.svg` (including `/_next/image` URLs that wrap it) aborted via `page.route`,
  - **Then** the AC-4 assertion fails. As a separate check with the AC-4 wait skipped, the screenshot comparison also fails.
  - This is checked once during verify and recorded in the PR description. It doesn't need to be a committed test, and committed tests stay green.
- **AC-6** *(darwin baseline is not stale)*
  - **Given** the PR's final commit,
  - **Then** `tests/e2e/__screenshots__/darwin/auth.spec.ts/sign-in.png` is either absent (default, Q2) or byte-different from its fd2269a version.
  - The same Vitest file as AC-2 checks this: the file is missing, or its sha256 differs from the fd2269a constant.
- **AC-7** *(no app changes)*
  - **Given** the PR diff against `main`,
  - **Then** it only touches `tests/**` and `docs/specs/38-*`. Nothing under `src/`, `public/`, `supabase/`, `.github/` or `playwright.config.ts` changes.
  - The reviewer checks this with `git diff --name-only`. It's listed here so the scope is explicit.
- **AC-8** *(existing sign-in checks unchanged)*
  - **Given** the PR,
  - **When** the full E2E suite runs in CI,
  - **Then** `auth.spec.ts` "protected routes redirect to sign-in" and "sign-in page offers Google sign-in" pass, along with every `brand.spec.ts` test. None of them is edited or removed.

Empty, error and privacy cases: there are no user data, empty states or error states in scope. The only "error" state is a missing or broken logo, which AC-4 and AC-5 cover.

## Data & privacy
- No database, schema, RLS or user-data changes. No migration, so no `db-change` label.
- The screenshot is of the signed-out `/sign-in` page only. It has no user names, collection data or tokens. The CI artifact (`linux-screenshots`, kept 90 days by default) has nothing sensitive in it.
- Signed-in pages are not screenshotted. Friends-only data stays out of committed images.

## UX notes
- Screen touched: none in the app. The baseline should show the current `/sign-in` page at the Pixel 7 viewport: the ManaPals mark (64×64, centered), the "ManaPals" heading, the tagline "Your collection. Your crew. Your trades.", the "Continue with Google" button and the disclaimer line.
- No mockup. The current page is the reference.
- Loading state: AC-4 makes sure the image has loaded before capture. There's no loading skeleton on this page.

## Open questions
1. **How is the linux baseline regenerated, and who triggers it?** The E2E workflow runs on `deployment_status` against the Vercel preview. With `updateSnapshots: "missing"`, a mismatched baseline is not overwritten. So a normal failing run uploads only the old file in `linux-screenshots`, plus the actual image in `playwright-report`.
   - **Default:** after the preview for the test-change commit deploys, dispatch the workflow by hand: `gh workflow run e2e.yml -f base_url=<preview URL> -f update_snapshots=true` (using `GH_HOST=github.com … --repo bthomas466/manapals`).
   - Then download `linux-screenshots` from that run, commit only `auth.spec.ts/sign-in.png`, and push. The resulting preview's normal E2E run must then pass (AC-1).
   - Expect one red E2E run on the first commit, because the tighter limit fails against the stale baseline. That is the expected sequence, as in spec #32's AC-13.
   - **Fallback:** if the factory can't dispatch workflows, delete the linux baseline in the first commit. The next run writes it as "missing", passes and uploads it, and a second commit restores it from the artifact. This is less safe, because that run passes without checking anything. Use it only if dispatch isn't available.
2. **Darwin baseline: delete, regenerate on a Mac, or leave?** CI can't produce it. Leaving it means local macOS runs compare with a pre-logo image. With the tighter limit from AC-3, those runs would also start failing.
   - **Default:** delete it in this PR. The next local macOS `npm run test:e2e` writes a fresh one, which the owner can commit.
   - **Alternative:** the owner runs `npm run test:e2e:update` on a Mac and commits the result before merge.
3. **How tight should the limit be?** If it's too tight, font anti-aliasing between runner images could make the test flaky. If it's too loose, the logo isn't guarded.
   - **Default:** `maxDiffPixelRatio: 0.002`, about 690 px. That's well below the logo's footprint but above typical sub-pixel noise.
   - If the first two passing CI runs show any non-zero diff near that limit, the builder raises it. It has to stay below about 0.005 so a removed logo still fails.
4. **Should the tighter limit become global?** It would protect future baselines too, but it's outside this issue.
   - **Default:** no. Keep it per-assertion here, and file a follow-up if more screenshot tests are added.
5. **Spec #32 AC-13 was marked done but not delivered.** That's a process gap: the review accepted a passing visual test that was hiding the stale baseline.
   - **Default:** no change to #32's spec. Mention in the PR description that this closes the gap left by #32's AC-13. The tighter limit (AC-3) is what stops it happening again.

## Design
No UI change. The mockup is a reference of what the refreshed baseline should show, not a new design.

- Mockup: [mockup.html](38-refresh-sign-in-baseline/mockup.html), screenshot: [mockup.png](38-refresh-sign-in-baseline/mockup.png)
- Built at 412px wide (the Pixel 7 width the E2E uses), with the real tokens from `globals.css`.

| State | What it shows | ACs |
|---|---|---|
| Sign-in, default (only state) | 64x64 ManaPals mark, "ManaPals" heading, tagline, "Continue with Google" button (48px tall), disclaimer | AC-1, AC-2, AC-4 |
| Broken logo | No mockup. Covered by the AC-4 wait and the AC-5 one-off negative check | AC-4, AC-5 |

The caption bar at the top of the mockup is not part of the page, so the PNG is a few pixels taller than 412x839. The real baseline has no caption. No new decisions for Open questions.
