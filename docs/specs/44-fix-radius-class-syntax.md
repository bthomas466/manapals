# Fix rounded corners: move radius classes to Tailwind 4 syntax
Issue: #44 · PRD refs: §5.2 (mobile experience) · Status: Approved

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

## Decisions (spec gate, 2026-10-22)
Owner replied `approve` with no changes. Recommended defaults accepted for Q1–Q5. No Delight items (none proposed).

## Technical design

No routing, data fetching, caching, server action or schema change, so none of the Next.js 16 behaviour changes apply. Tokens in `src/app/globals.css` `@theme` (`--radius-card|btn|chip|avatar`) already generate `rounded-card`, `rounded-btn`, `rounded-chip`, `rounded-avatar` and side variants (`rounded-t-card`). `globals.css` is not touched.

### Changes

**Class replacement (31 files under `src/`, mechanical).** Apply one regex to every match, with no other edits to these files:
`s/-\[--radius-(card|btn|chip|avatar)\]/-\1/g`
This maps `rounded-[--radius-X]` to `rounded-X` and `rounded-t-[--radius-card]` to `rounded-t-card`, and leaves variant prefixes (`hover:`, `sm:`) as they are. Today every `-[--` hit under `src/` is a radius class, so nothing else needs changing. Files:

- `src/app/(auth)/sign-in/page.tsx`: "Continue with Google" button now uses `rounded-btn`
- `src/app/(main)/collection/loading.tsx`, `profile/loading.tsx`, `trades/loading.tsx`, `wishlist/loading.tsx`: skeleton radii
- `src/app/(main)/error.tsx`, `src/app/(main)/not-found.tsx`: card and button radii
- `src/app/(main)/profile/page.tsx`: avatar, friend rows, sign-out button
- `src/app/(main)/trades/page.tsx`, `src/app/(main)/trades/[username]/page.tsx`: friend rows, avatars, empty state
- `src/app/(main)/u/[username]/page.tsx`, `src/app/(main)/wishlist/page.tsx`
- `src/components/collection/CardTradeSheet.tsx`, `ImportCollectionModal.tsx`, `TradeSettingsSheet.tsx`: sheet panel becomes `rounded-t-card`, inner chips and buttons are updated too
- `src/components/collection/CollectionGrid.tsx`, `CollectionLoadError.tsx`, `CollectionSummary.tsx`, `CollectionView.tsx`
- `src/components/friends/FriendActionButton.tsx`, `FriendRequestActions.tsx`
- `src/components/onboarding/ImportStep.tsx`, `ProfileStep.tsx`
- `src/components/profile/FriendSearchBox.tsx`, `ProfileEditForm.tsx`, `ProfileStats.tsx`, `VisibilityToggle.tsx`
- `src/components/trades/MatchSection.tsx`
- `src/components/ui/ConfirmDialog.tsx`
- `src/components/wishlist/AddCardSearch.tsx`, `WishlistGrid.tsx`

**Tests and docs:**
- `tests/unit/design-system-guard.test.ts`: export `BARE_VAR_ARBITRARY_RE`, and add regex tests, a tree scan, a utility-usage check and an agent-docs check (AC-1, 2, 7, 8, 10)
- `tests/unit/sign-in-baseline.test.ts`: add the `PRE_RADIUS_LINUX_SHA256` constant and assertion (AC-9)
- `tests/e2e/auth.spec.ts`: add the signed-out button radius check (AC-3)
- `tests/e2e/authed/radius-tokens.spec.ts` (new, read-only, runs in the parallel `authed` project): AC-4, AC-5, AC-6
- `tests/e2e/__screenshots__/linux/auth.spec.ts/sign-in.png`: regenerated from CI (see Baseline handling)
- `.claude/agents/ux-designer.md`: change the token example to `rounded-card`
- `.claude/agents/ui-designer.md`: replace the "Known issue … Don't fix it piecemeal." sentences with a positive rule, e.g. "Use `rounded-card` / `rounded-btn` / `rounded-chip` / `rounded-avatar` (side variants such as `rounded-t-card` for sheets). Don't put a bare `--var` inside `[...]`; Tailwind 4 needs `-(--x)` or `-[var(--x)]`, and `tests/unit/design-system-guard.test.ts` fails on it." The new wording must not contain the literal `rounded-[--` (AC-10).

### Schema
None. No migration, no RLS change, no backfill.

### Data flow
Unchanged. All touched components keep their server or client boundary and their queries. Only `className` strings change.

### Logic placement
No app logic. The only "logic" is the guard regex, which lives in the test file and is exported next to `PALETTE_RE` and `MUTED_RE`, following the existing pattern.

### Guard design (`tests/unit/design-system-guard.test.ts`)
```ts
// Tailwind 4 no longer wraps a bare custom property in var() inside [...]:
// `rounded-[--radius-btn]` compiles to `border-radius: --radius-btn` (invalid).
// Valid forms: `rounded-btn` (theme utility), `rounded-(--x)`, `rounded-[var(--x)]`.
export const BARE_VAR_ARBITRARY_RE = /(?<![\w-])(?:[\w-]+:)*[\w-]+-\[--[^\]\s]*\]/g;
```
- The match is the whole class including variant prefixes, so the failure output shows `hover:rounded-[--radius-chip]` and not only a fragment.
- Matches: `rounded-[--radius-btn]`, `rounded-t-[--radius-card]`, `hover:rounded-[--radius-chip]`, `p-[--space-4]`, `bg-[--brand]`.
- No match: `rounded-btn`, `rounded-[var(--radius-btn)]`, `rounded-(--radius-btn)`, `w-[calc(100%-1rem)]`, `rounded-[12px]`. `[` is never directly followed by `--` in these forms.
- Tree scan: reuse the existing `files = walk(SRC, [".ts", ".tsx", ".css"])`. Collect `${relative(SRC, f)}: ${matches.join(", ")}`, then `expect(hits).toEqual([])`, the same reporting shape as the palette guard (AC-8).
- AC-1 test: a separate literal check that no file matches `/-\[--radius-/`. It overlaps with the general guard, but it maps one-to-one to the AC.
- AC-2 test: join all file contents. For each of `rounded-card`, `rounded-t-card`, `rounded-btn`, `rounded-chip`, `rounded-avatar`, build `new RegExp(`(?<![\\w-])(?:[\\w-]+:)*${cls}(?![\\w-])`)` and expect at least one match. The lookbehind keeps `rounded-t-card` from counting as `rounded-card`. Also assert that `components/collection/{ImportCollectionModal,TradeSettingsSheet,CardTradeSheet}.tsx` each contain `rounded-t-card`.
- AC-10 test: read `.claude/agents/ux-designer.md` and `ui-designer.md` from `process.cwd()`. Assert that neither contains `rounded-[--`, that `ui-designer.md` doesn't contain `Known issue`, and that both contain `rounded-card`.

### Baseline handling (AC-9)
- Pre-change linux baseline SHA-256 (commit `6ad2657`, unchanged on `main`): `523757ff1271e1366c3377dcd6f4bf3fdebad68db083c76257dff39430ed1a92`. Add it as `PRE_RADIUS_LINUX_SHA256` in `sign-in-baseline.test.ts`, with `expect(sha256(buf)).not.toBe(PRE_RADIUS_LINUX_SHA256)` in the linux test. Keep the existing 412x839 PNG checks.
- Rounding four 12px corners on one button changes only about 150 to 300 pixels, which may sit under `maxDiffPixelRatio: 0.002` (about 690 px). So the automatic preview run may pass without writing anything, and `updateSnapshots: "missing"` would never regenerate the file. Don't rely on that. Run the E2E workflow by `workflow_dispatch` with `base_url` = this PR's preview URL and `update_snapshots: true`. Download the `linux-screenshots` artifact and commit `auth.spec.ts/sign-in.png` from it. Don't generate it locally, and don't touch the threshold.
- Until that commit lands, the AC-9 unit test fails by design. That is the signal that the baseline still needs regenerating.
- No darwin baseline is committed. Leave it that way.

### Test plan
| AC | Test |
|---|---|
| AC-1 | Vitest `design-system-guard.test.ts`: no `/-\[--radius-/` under `src/**/*.{ts,tsx,css}` |
| AC-2 | Vitest same file: each theme utility is used at least once; the three sheet files contain `rounded-t-card` |
| AC-3 | Playwright `tests/e2e/auth.spec.ts` (mobile, signed out): `/sign-in`, `getByRole("button", { name: "Continue with Google" })`, `evaluate(el => getComputedStyle(el).borderRadius)` is `"12px"` |
| AC-4 | Playwright `tests/e2e/authed/radius-tokens.spec.ts`: `/collection`. `getByRole("region", { name: "Collection summary" })` has radius `"16px"`. `getByRole("button", { name: "Foil", exact: true })` (filter chip) has radius `"8px"` |
| AC-5 | Same spec: `/profile`, `page.locator(".rounded-avatar").first()` (the header avatar, always rendered whatever the friends data) has radius `"9999px"` |
| AC-6 | Same spec: `/collection`, click `Re-import` (the seeded collection is non-empty, so the header button shows). Panel = `page.locator(".rounded-t-card").filter({ has: page.getByRole("heading", { name: "Import Collection" }) })`. `borderTopLeftRadius`/`borderTopRightRadius` are `"16px"` and `borderBottomLeftRadius`/`borderBottomRightRadius` are `"0px"`. Then click Cancel. No upload, so nothing is mutated |
| AC-7 | Vitest `design-system-guard.test.ts` "guard regexes": the five positive and five negative strings |
| AC-8 | Vitest same file: tree scan returns `[]`, with hits formatted as `relpath: class` |
| AC-9 | Vitest `sign-in-baseline.test.ts`: hash differs from `PRE_RADIUS_LINUX_SHA256`. CI E2E `sign-in page visual` passes at 0.002 against the regenerated baseline |
| AC-10 | Vitest `design-system-guard.test.ts`: agent-docs assertions |

- Each authed spec calls `requireE2EUser()` at the top, as the existing specs do. The new spec is read-only, so it uses the parallel `authed` project and not `.serial`.
- No seed changes. The existing `e2e_player` collection (Sol Ring x2, Arcane Signet, Lightning Bolt foil, Counterspell) makes the summary, the chips and the `Re-import` button render.
- Before relying on the radius strings, confirm that Chromium reports the shorthand `borderRadius` as a single value (`"12px"`) when all four corners are equal. For AC-6, read the longhands.

### Risks
- **Visual baseline drift (main risk).** The sign-in screenshot may pass without regenerating (see above), or fail on the first preview run. Either way, regenerate it with `update_snapshots: true` and commit from the artifact. The AC-9 hash test makes it impossible to forget.
- **Missed occurrences.** A hand edit could miss some of the 101 uses. Mitigation: use the single regex replacement, then the AC-1 and AC-8 guards. Run `grep -rn -- '-\[--' src` and expect zero hits before committing.
- **False positives in the guard.** The regex flags any `-[--…]` text in `.ts`/`.tsx`/`.css`, including comments and strings. Today there are none outside the radius classes. If a legitimate need appears later, the fix is to write `-(--x)`, which the guard allows.
- **Clipping side effects.** `overflow-hidden` containers (card images, avatars) now clip to the radius. This is intended (UX notes). Card art in `CollectionGrid`/`WishlistGrid` at `rounded-chip` (8px) loses its very corners, which is expected.
- **Agent docs regression.** Other agent docs or mockups could still teach the old form. `docs/specs/**` is out of scope by design, and the guard only scans `src/`, so a copied mockup class fails CI and does not ship.
- **Privacy, RLS, performance, migration:** none. Styling only, and the E2E reads only computed styles as `e2e_player`.
