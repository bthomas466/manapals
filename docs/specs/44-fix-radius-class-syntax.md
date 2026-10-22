# Fix rounded corners: move radius classes to Tailwind 4 syntax
Issue: #44 · PRD refs: §5.2 (mobile experience) · Status: Draft

## Problem
The app writes its radius classes in Tailwind 3 shorthand: `rounded-[--radius-card]`, `rounded-[--radius-btn]`, `rounded-[--radius-chip]`, `rounded-[--radius-avatar]`, plus `rounded-t-[--radius-card]` on three bottom sheets. Tailwind 4 no longer wraps a bare `--name` inside `[...]` in `var()`. It emits `border-radius: --radius-btn`, which is invalid CSS, so the browser drops it and every card, button, chip, avatar and sheet has square corners.

A count on `feature/44-fix-radius-class-syntax`: 101 uses in 31 files under `src/`.

| Class | Uses |
|---|---|
| `rounded-[--radius-chip]` | 39 |
| `rounded-[--radius-btn]` | 31 |
| `rounded-[--radius-card]` | 21 |
| `rounded-[--radius-avatar]` | 7 |
| `rounded-t-[--radius-card]` | 3 (`ImportCollectionModal`, `TradeSettingsSheet`, `CardTradeSheet`) |

`src/app/globals.css` already declares `--radius-card: 16px`, `--radius-btn: 12px`, `--radius-chip: 8px` and `--radius-avatar: 9999px` inside `@theme`. Tailwind 4 turns those into working `rounded-card`, `rounded-btn`, `rounded-chip`, `rounded-avatar` utilities, plus side variants such as `rounded-t-card`. No token or CSS change is needed. Only the class names are wrong.

The agent docs keep the bug going. `.claude/agents/ux-designer.md` gives `rounded-[--radius-card]` as an example token. `.claude/agents/ui-designer.md` has a "Known issue … match the surrounding code" note that tells agents to keep writing the broken form until an app-wide fix lands. This issue is that fix.

## Users & scenario
1. A player opens ManaPals on an Android phone (Pixel 7 viewport) and signs in. The "Continue with Google" button on the sign-in page has 12px rounded corners instead of a square box.
2. On Collection, each card tile has 16px corners, the filter and trade-flag chips have 8px corners, and the import sheet that slides up from the bottom has 16px rounded top corners only.
3. On Trades, friend avatars are circles instead of squares.
4. Later, an agent building a new screen copies `rounded-[--radius-btn]` from an old mockup. `npm test` fails in CI with the file and the offending class, and tells the agent to use `rounded-btn` instead.

## Scope
### In scope
- **App-wide class replacement under `src/`**, one mechanical change:
  - `rounded-[--radius-card]` → `rounded-card`
  - `rounded-[--radius-btn]` → `rounded-btn`
  - `rounded-[--radius-chip]` → `rounded-chip`
  - `rounded-[--radius-avatar]` → `rounded-avatar`
  - `rounded-t-[--radius-card]` → `rounded-t-card` (the same rule for any other side or corner prefix, plus variant prefixes such as `hover:` and `sm:`)
- **A guard** in the existing `tests/unit/design-system-guard.test.ts`, run by `npm test` in CI. It fails on any Tailwind arbitrary value that starts with a bare custom property, the `-[--` pattern (`rounded-[--x]`, `p-[--x]`, `bg-[--x]` …), in `.ts`/`.tsx`/`.css` under `src/`. It doesn't flag the valid forms `-[var(--x)]` and Tailwind 4's `-(--x)`. The failure message lists file and class.
- **Computed-radius E2E checks** proving each token now renders (AC-3 to AC-6).
- **Screenshot baseline refresh.** The only committed baseline is `tests/e2e/__screenshots__/linux/auth.spec.ts/sign-in.png`. Its "Continue with Google" button gains rounded corners, so it has to be regenerated from the E2E workflow's `linux-screenshots` artifact, not locally.
- **Agent docs:**
  - In `.claude/agents/ux-designer.md`, change the token example `rounded-[--radius-card]` to `rounded-card`.
  - In `.claude/agents/ui-designer.md`, remove the "Known issue … Don't fix it piecemeal." sentences. Keep the token list, and state the `rounded-card`/`-btn`/`-chip`/`-avatar` forms as the ones to use.

### Out of scope
- Changing any radius value or adding new radius tokens.
- Redesigning which elements are rounded, or fixing elements that use other `rounded-*` classes (`rounded-full`, `rounded-lg`, …) on purpose.
- Rewriting old mockups or specs under `docs/specs/**` that show the Tailwind 3 form. They are historical records, and the guard only scans `src/`.
- A custom ESLint rule or plugin. The Vitest guard follows the existing design-system-guard pattern and already runs in CI (see Q1).
- Adding new screenshot baselines for signed-in pages.
- A darwin `sign-in.png` baseline. None is committed, and `updateSnapshots: "missing"` writes one on the next local macOS run.
- Any other Tailwind 3 → 4 migration cleanup the guard doesn't cover.

## Acceptance criteria
"E2E" means Playwright in the mobile project as run by the CI E2E workflow. "Signed-in E2E" means `tests/e2e/authed/*` as the seeded `e2e_player`. Radii are read with `getComputedStyle(el).borderRadius` (or `borderTopLeftRadius` and similar).

- **AC-1** *(no Tailwind 3 radius classes left)*
  - **Given** the files under `src/`,
  - **When** a Vitest test scans every `.ts`, `.tsx` and `.css` file,
  - **Then** none contains the regex `-\[--radius-`. This covers `rounded-[--radius-*]`, `rounded-t-[--radius-*]` and any other side or corner prefix.
- **AC-2** *(replacements use the theme utilities)*
  - **Given** the change is applied,
  - **When** the same scan counts `rounded-card`, `rounded-t-card`, `rounded-btn`, `rounded-chip` and `rounded-avatar` (with or without variant prefixes),
  - **Then** each class is used at least once.
  - **And** the files that used `rounded-t-[--radius-card]` (`ImportCollectionModal.tsx`, `TradeSettingsSheet.tsx`, `CardTradeSheet.tsx`) each contain `rounded-t-card`.
- **AC-3** *(button radius renders, signed out)*
  - **Given** the sign-in page,
  - **When** E2E reads the computed `border-radius` of the "Continue with Google" button,
  - **Then** it is `12px`.
- **AC-4** *(card and chip radii render)*
  - **Given** signed-in E2E on `/collection` with the seeded collection,
  - **When** it reads the computed radius of a collection summary card or other `rounded-card` element, and of a chip (`rounded-chip`, for example a filter or trade-flag chip),
  - **Then** they are `16px` and `8px` respectively.
- **AC-5** *(avatar radius renders)*
  - **Given** signed-in E2E on a page that shows a user avatar (`/trades` friend row or `/profile`),
  - **When** it reads the avatar container's computed `border-radius`,
  - **Then** it is `9999px`, so the avatar renders as a circle.
- **AC-6** *(bottom sheet rounds only its top corners)*
  - **Given** signed-in E2E on `/collection`,
  - **When** the import sheet (`ImportCollectionModal`) is opened,
  - **Then** its panel's computed `border-top-left-radius` and `border-top-right-radius` are `16px`,
  - **And** `border-bottom-left-radius` and `border-bottom-right-radius` are `0px`.
- **AC-7** *(guard catches the Tailwind 3 shorthand)*
  - **Given** the guard regex exported from `tests/unit/design-system-guard.test.ts`,
  - **When** it is tested against `rounded-[--radius-btn]`, `rounded-t-[--radius-card]`, `hover:rounded-[--radius-chip]`, `p-[--space-4]` and `bg-[--brand]`,
  - **Then** each one matches.
  - **And** `rounded-btn`, `rounded-[var(--radius-btn)]`, `rounded-(--radius-btn)`, `w-[calc(100%-1rem)]` and `rounded-[12px]` don't match.
- **AC-8** *(guard runs on the real tree)*
  - **Given** `npm test`,
  - **When** the design-system guard scans `src/`,
  - **Then** it reports zero `-[--` hits.
  - **And** if a file contains one, the test fails with that file's path relative to `src/` and the offending class in the assertion output.
- **AC-9** *(baseline regenerated)*
  - **Given** the committed linux baseline `tests/e2e/__screenshots__/linux/auth.spec.ts/sign-in.png`,
  - **When** a Vitest test compares its SHA-256 with the baseline on `main` before this change (recorded as a constant, as `sign-in-baseline.test.ts` already does for older baselines),
  - **Then** the hashes differ.
  - **And** the CI E2E `sign-in page visual` test passes against it at the existing `maxDiffPixelRatio: 0.002`.
- **AC-10** *(agent docs updated)*
  - **Given** `.claude/agents/ux-designer.md` and `.claude/agents/ui-designer.md`,
  - **When** a Vitest test reads them,
  - **Then** neither contains `rounded-[--`.
  - **And** `ui-designer.md` no longer contains "Known issue".
  - **And** both files mention `rounded-card`.

## Data & privacy
No data, schema, migration, RLS or visibility change. This is a styling fix only. The signed-in E2E checks run as the seeded `e2e_player` and only read computed styles, so friends-only defaults are unaffected.

## UX notes
- **Screens touched (visual only):** sign-in, collection (grid, summary, load error, import sheet, trade settings sheet, card trade sheet), wishlist (grid, add-card search), trades list and trade detail, profile (stats, edit form, visibility toggle, friend search), public profile `/u/[username]`, onboarding steps, confirm dialog, the `(main)` loading skeletons, error and not-found pages.
- **Expected change:** corners go from square to 16px (cards, sheets), 12px (buttons, inputs that use the button token), 8px (chips) and full (avatars). Loading skeletons pick up the same radii, so the layout doesn't jump when content loads.
- **States:** empty, loading and error states keep their current layout. Only corners change, and no copy changes.
- **Layout risk:** border-radius doesn't affect layout box size, so no reflow is expected. With `overflow-hidden` containers, card images and avatar images are now clipped to the rounded shape. That is intended.

## Open questions
1. **Guard as a Vitest test or an ESLint rule?** The issue suggests "a lint/CI check". **Default:** add it to `tests/unit/design-system-guard.test.ts`, next to the existing palette and muted-text guards. It runs in CI via `npm test`, can be unit-tested itself (AC-7), and needs no custom ESLint plugin.
2. **Should the guard flag every `-[--x]` arbitrary value or only `rounded-`?** **Default:** every arbitrary value starting with `--`. Tailwind 4 breaks the same way for any utility, and there are no other uses today, so the wider rule costs nothing.
3. **The issue says "~80 uses in 25 files"; the current tree has 101 in 31 files, including `rounded-t-[--radius-card]`.** **Default:** fix all of them. AC-1 uses `-\[--radius-` rather than the issue's literal `rounded-[--radius-`, so the `rounded-t-` sheets are covered.
4. **Should a rendered-CSS check be added, for example grepping `.next` build CSS for `border-radius:--`?** The issue's AC-2 mentions the compiled CSS. **Default:** no. The computed-style E2E checks (AC-3 to AC-6) prove the same thing in a real browser without depending on build output paths.
5. **How should the baseline be recorded?** **Default:** regenerate `sign-in.png` from the `linux-screenshots` artifact of this PR's E2E run, and add the pre-change SHA-256 as a constant in `sign-in-baseline.test.ts` (AC-9). Don't loosen the 0.002 threshold to make the test pass.

## Design
Mockup: [mockup.html](44-fix-radius-class-syntax/mockup.html) · Screenshot: [mockup.png](44-fix-radius-class-syntax/mockup.png)

Compact before/after at 390px, using existing tokens only (no new styles or layout).
- **Before (square):** sign-in button, filter chips, card tile with avatar, bottom sheet, all with square corners as today.
- **After:** button 12px (AC-3), card 16px (AC-4), chip 8px (AC-4), avatar full circle (AC-5), bottom sheet with 16px top corners and square bottom (AC-6).
- AC-1, 2, 7 to 10 are code/test/docs criteria with no visual state.
- Chips and buttons in the mockup are 44px tall; the fix does not change sizes.

## Delight
None: this is a mechanical corner-radius fix with no new copy, empty states, success moments or interactions. Nothing purposeful to add; the rounded corners are the polish.
