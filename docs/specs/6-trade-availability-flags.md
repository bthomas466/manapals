# Trade availability flags
Issue: #6 · PRD refs: US-11, US-12, US-14 (binders), US-17, §4.2, §4.4, §4.6, §5.3 · Status: Approved (spec gate 2026-10-11)

## Problem
Trade Match (`/trades/[username]`) currently offers each user's **entire** collection (see the comment above `computeTradeMatches` in `src/lib/trades/match.ts`). That includes cards sleeved in decks the owner would never trade. Friends end up seeing "matches" that aren't real offers, so the feature loses trust. Users need a way to say what is actually on the table. PRD US-11 covers marking cards "available to trade" and US-12 covers marking cards "not for trade".

## Users & scenario
Maya has about 3,000 cards imported from Manabox. Her Manabox binders are "Trade Binder", "Atraxa Deck" and "Bulk". She opens ManaPals on her phone at game night.

1. On **Collection** she taps **Trade settings**. A sheet lists her binders with card counts. Next to "Atraxa Deck" she taps **Not for trade**, and a toast confirms "212 cards marked not for trade".
2. She has no "available" flags yet, so Trade Match still offers everything except the Atraxa Deck cards.
3. Later she taps a single foil Sol Ring tile in "Bulk". A card sheet opens and shows the name, finish, binder and quantity. She picks **Available to trade**. Because this is her first "available" card, the sheet warns: "Trade Match will now offer only cards you mark Available." She confirms. The tile now shows an "Available" badge.
4. Her friend Theo opens `/trades/maya`. Under "They have, you want" he sees only Maya's available cards that he doesn't own (and that match his wishlist if he has one). The Atraxa Deck cards never show up.
5. On her own `/trades/theo` page, Maya sees a line that tells her what she's offering: "Offering: 1 card you marked Available · Edit on Collection".

## Scope
### In scope
- **Tri-state flag per collection row.** Each `collection_items` row is in one of three states:
  - *Unmarked* (the default)
  - *Available to trade*
  - *Not for trade*

  A row is one (card, finish, binder). The flag covers the row's whole quantity.
- **Offer rule** (what a user offers in Trade Match):
  - **Opt-in mode:** the user has at least one *Available* row. They offer only their *Available* rows.
  - **Fallback mode:** the user has no *Available* rows. They offer their whole collection minus *Not for trade* rows. If they have no flags at all, this is today's behaviour exactly (PRD §4.6 fallback).
  - This mirrors the existing wishlist rule: an empty wishlist means "wants everything", and a non-empty one narrows matching.
- **Per-card marking:** tapping a tile on `/collection` opens a card sheet with a 3-option control (Available / Unmarked / Not for trade).
- **Bulk marking by binder:** a **Trade settings** sheet on `/collection` lists each non-empty `binder_name` with its row and card count. Each binder has three actions:
  - Mark all *Available*
  - Mark all *Not for trade*
  - *Clear* (reset to Unmarked)

  This is a one-shot write to the rows that exist now. It does not create a persistent binder rule; see Q2.
- **First-Available warning:** when a user in fallback mode is about to set their first *Available* flag (per-card or via binder), show a one-time confirmation that explains the switch to opt-in mode.
- **Badges and filters on `/collection`:**
  - Tiles show an "Available" or "Not for trade" badge.
  - Two new filter chips, "For trade" and "Not for trade", let users review what they marked.
- **Trade Match uses the flags:**
  - Offered sets and offered quantities come from the offer rule.
  - The viewer sees a one-line indicator of their own offer mode.
  - The empty-state copy links to `/collection` to mark cards (PRD §4.6 empty state).
- **Flags survive re-import:** after a CSV re-import, a new row keeps the flag of the old row with the same (card, finish, binder_name). That triple is already the row's natural unique key.

### Out of scope
- Flagging only part of a row's quantity, e.g. "trade 2 of my 4". Workaround: split the copies into separate Manabox binders.
- Persistent binder-level rules that auto-apply to cards added to a binder later (Q2).
- A general binder browser or grouping view for US-14. The Trade settings sheet only lists binder names.
- Multi-select or "mark all search results" on the grid.
- A global "clear all trade flags" action. Per-binder Clear and per-card reset cover v1.
- Showing a friend's trade flags or badges on their `/u/[username]` profile (Q3).
- Per-friend offers ("available to Theo but not to Sam").
- Importing trade flags from Manabox, and changes to the import modal copy.
- Changing the "they already own it" exclusion or the wishlist matching rules.
- Notifications when a friend marks something available (US-20).

## Acceptance criteria
Unit = Vitest on the pure matching logic in `src/lib/trades/match.ts`. E2E = Playwright with users that the test seeds itself.

**Offer rule (Vitest)**
- **AC-1** *(no flags = today's behaviour)*
  - **Given** neither user has any trade flags,
  - **When** `computeTradeMatches` runs,
  - **Then** the result is identical to the current implementation for the existing `tests/unit/trade-match.test.ts` fixtures.
- **AC-2** *(Not-for-trade excluded in fallback)*
  - **Given** the viewer has no *Available* rows and has a *Not for trade* row for card X,
  - **And** the friend does not own X and has an empty wishlist,
  - **When** matches are computed,
  - **Then** X is not in `youHaveTheyWant`.
- **AC-3** *(opt-in mode)*
  - **Given** the viewer has an *Available* row for card A, plus Unmarked rows for B and C,
  - **And** the friend owns none of A, B or C and has an empty wishlist,
  - **When** matches are computed,
  - **Then** `youHaveTheyWant` contains exactly A.
- **AC-4** *(symmetry)*
  - **Given** the friend is in opt-in mode with only card D *Available*, and the friend also owns Unmarked card E,
  - **And** the viewer owns neither and has an empty wishlist,
  - **When** matches are computed,
  - **Then** `theyHaveYouWant` contains D and not E.
- **AC-5** *(offered quantity)*
  - **Given** the viewer owns card X in two rows (3 copies in an Unmarked row, 4 copies in a *Not for trade* row) and is in fallback mode,
  - **When** X appears in `youHaveTheyWant`,
  - **Then** its `quantity` is 3.
- **AC-6** *(ownership still uses the full collection)*
  - **Given** the friend owns card X only in a *Not for trade* row,
  - **And** the viewer offers X,
  - **When** matches are computed,
  - **Then** X is not in `youHaveTheyWant`. The friend still owns X.
- **AC-7** *(wishlist still narrows)*
  - **Given** the viewer is in opt-in mode with A and B *Available*,
  - **And** the friend's non-empty wishlist contains only B,
  - **When** matches are computed,
  - **Then** `youHaveTheyWant` contains exactly B.
- **AC-8** *(both have extras)*
  - **Given** both users own card X, the viewer's offered quantity of X is 1, and all of the viewer's other copies are *Not for trade*,
  - **And** the friend's offered quantity of X is 1,
  - **When** matches are computed,
  - **Then** X is not in `bothHaveExtras`.
  - **And** if either side's offered quantity is 2 or more, X is in `bothHaveExtras`.

**Marking on /collection (Playwright)**
- **AC-9**
  - **Given** I'm signed in and have imported cards,
  - **When** I tap a card tile,
  - **Then** a dialog opens showing the card name, finish, binder name (or "No binder") and quantity, plus a control with the options "Available to trade", "Unmarked" and "Not for trade". "Unmarked" is selected for a never-flagged row.
- **AC-10**
  - **Given** the card dialog is open for a row and I already have at least one *Available* row,
  - **When** I choose "Not for trade",
  - **Then** the tile shows a "Not for trade" badge,
  - **And** after a page reload the badge is still there and the dialog shows "Not for trade" selected.
- **AC-11** *(first-Available warning)*
  - **Given** I have zero *Available* rows,
  - **When** I choose "Available to trade" for any row,
  - **Then** a confirmation appears with text containing "only cards you mark Available".
  - Choosing **Cancel** leaves the row Unmarked.
  - Choosing **Confirm** saves the flag and shows the "Available" badge.
  - **And Given** I already have one or more *Available* rows, **When** I mark another, **Then** no confirmation appears.
- **AC-12**
  - **Given** a row is marked *Available*,
  - **When** I choose "Unmarked",
  - **Then** the badge disappears and stays gone after reload.
- **AC-13** *(filters)*
  - **Given** I have 1 *Available* row, 1 *Not for trade* row and 1 Unmarked row,
  - **When** I tap the "For trade" chip,
  - **Then** only the *Available* tile is visible.
  - **When** I tap the "Not for trade" chip, **Then** only the *Not for trade* tile is visible.
- **AC-14** *(save error)*
  - **Given** the flag save request fails (the test intercepts the request and makes it fail),
  - **When** I change a flag,
  - **Then** an error message "Couldn't update trade status" is visible,
  - **And** the tile badge and the dialog selection go back to the previous state.

**Bulk by binder (Playwright)**
- **AC-15**
  - **Given** my collection has rows in binders "Deck A" (5 rows) and "Trade" (3 rows), plus rows with an empty binder name,
  - **When** I open **Trade settings**,
  - **Then** I see exactly two binder entries, "Deck A" and "Trade", each with its row count. Empty binder names are not listed.
- **AC-16**
  - **Given** the Trade settings sheet is open,
  - **When** I tap "Not for trade" on "Deck A",
  - **Then** a confirmation toast says 5 entries were updated,
  - **And** filtering by "Not for trade" shows exactly the 5 "Deck A" tiles.
- **AC-17**
  - **Given** I have zero *Available* rows,
  - **When** I tap "Available" on a binder,
  - **Then** the same first-Available confirmation from AC-11 appears before anything is written.
- **AC-18**
  - **Given** "Deck A" rows are flagged,
  - **When** I tap "Clear" on "Deck A",
  - **Then** all 5 rows are Unmarked.
  - Rows in other binders keep their flags.
- **AC-19** *(no binders)*
  - **Given** every row in my collection has an empty binder name,
  - **When** I open Trade settings,
  - **Then** the sheet shows "No Manabox binders found in your import" and no bulk actions.
- **AC-20** *(empty collection)*
  - **Given** I have no collection rows,
  - **Then** the **Trade settings** button is not shown. The existing import empty state is unchanged.

**Re-import (Playwright, or an integration test against the RPC)**
- **AC-21**
  - **Given** a row (card X, nonfoil, "Deck A") is *Not for trade*,
  - **When** I re-import a CSV that still contains X nonfoil in "Deck A" (with a different quantity or condition),
  - **Then** that row is still *Not for trade* after the import.
- **AC-22**
  - **Given** a row (card X, nonfoil, "Deck A") is *Available*,
  - **When** I re-import a CSV where X has moved to binder "Trade",
  - **Then** the new "Trade" row is Unmarked,
  - **And** no flag remains for the removed "Deck A" row.

**Trade Match page (Playwright, two seeded friends)**
- **AC-23**
  - **Given** I (viewer) am in opt-in mode with only "Sol Ring" *Available*,
  - **When** I open `/trades/<friend>`,
  - **Then** "You have, they want" lists at most Sol Ring,
  - **And** a line reads "Offering: 1 card you marked Available" with a link to `/collection`.
- **AC-24**
  - **Given** I have no *Available* rows and 2 *Not for trade* rows,
  - **When** I open `/trades/<friend>`,
  - **Then** the indicator reads "Offering: your collection except 2 not-for-trade entries".
  - **And** with zero flags, it reads "Offering: your whole collection".
- **AC-25**
  - **Given** my friend is in opt-in mode,
  - **When** I open `/trades/<friend>`,
  - **Then** "They have, you want" never shows a card the friend has not marked *Available*. The test seeds an Unmarked card that I don't own and asserts it's absent.
- **AC-26** *(empty state)*
  - **Given** "You have, they want" has zero cards,
  - **Then** its empty text includes a link "mark cards for trade" pointing to `/collection`.

**Privacy (RLS / integration, using the Supabase client as different users)**
- **AC-27**
  - **Given** user B is not A's friend and A's visibility is `friends`,
  - **When** B queries A's collection rows and flags,
  - **Then** zero rows are returned.
- **AC-28**
  - **Given** user B is A's accepted friend,
  - **When** B tries to set or clear a trade flag on one of A's rows,
  - **Then** the write affects 0 rows or errors, and A's flag is unchanged.
- **AC-29**
  - **Given** user B is A's accepted friend,
  - **When** B reads A's collection rows,
  - **Then** B can read A's flag values. Trade Match needs them, because it runs under the viewer's session.

## Data & privacy
- **What's stored:**
  - One trade status per collection row: `available`, `not_for_trade`, or unset (null = Unmarked).
  - No timestamps or history are required.
  - Storage is the architect's call. Options are a column on `collection_items`, or a side table keyed by (user_id, card_id, finish, binder_name).
  - Hard requirement: `replace_collection_items` currently deletes and re-inserts every row. Flags must still survive re-import for rows whose (card_id, finish, binder_name) is still present (AC-21/22).
- **Who can read:**
  - Same audience as the collection row: the owner, accepted friends, and anyone signed in when the owner's `collection_visibility = 'public'`.
  - This matches the existing `collection_items_select_friends` policy.
  - The default stays friends-only. Trade Match reads the friend's flags under the viewer's session, so friends need read access.
- **Who can write:** only the owner (`auth.uid() = user_id`). There are no new policies for friends or the public.
- **Bulk writes:** binder actions must update only the caller's rows for the given `binder_name`, in one request. A 1,000-row binder must not mean 1,000 round trips.
- **Not stored:** purchase prices (unchanged, §5.3).

## UX notes
- **`/collection` (CollectionView / CollectionGrid)**
  - **Tile:**
    - Becomes a button. Tapping it opens the card dialog: a bottom sheet on mobile with 44px+ touch targets (§5.2).
    - Badge placement: the "Available" or "Not for trade" badge goes at the bottom-left. The quantity badge stays top-right and the foil badge top-left.
  - **Chip row:**
    - Adds "For trade" and "Not for trade" chips.
    - They are mutually exclusive with the colour chips, matching the current single-select behaviour.
  - **Header:** adds a **Trade settings** button next to **Re-import**. It is hidden when the collection is empty.
  - **Dialog states:**
    - *Saving:* the control is disabled.
    - *Error:* inline message plus revert (AC-14).
    - *First-Available confirm* (AC-11).
  - **Trade settings sheet:**
    - Binders are sorted by name.
    - Each binder shows its row count and total card count.
    - Each binder has three actions.
    - While a binder action runs, its row shows a loading state and the other actions are disabled.
    - Empty state per AC-19.
- **`/trades/[username]`**
  - Offer-mode indicator line under the header (AC-23/24).
  - Updated empty-state copy (AC-26).
  - Tiles show the offered quantity.
- **No changes to:** `/u/[username]`, `/wishlist`, the import modal.

## Open questions
1. **Offer rule when only "Not for trade" flags exist.**
   - PRD §4.6 says "if no explicit trade flags are set, fall back to the full collection." It doesn't say what happens when only *Not for trade* flags are set.
   - **Recommended:** fallback mode = full collection minus *Not for trade* (as specced). Any *Available* flag switches to opt-in.
   - This extends the PRD rather than contradicting it. Please confirm.
2. **Binder bulk action: one-shot write or persistent rule?**
   - With one-shot (specced), a card added later to "Atraxa Deck" via re-import arrives Unmarked. In fallback mode it would then be offered.
   - A persistent binder rule (row flag overrides binder flag, which overrides Unmarked) fixes this, but adds a second concept and a precedence rule.
   - **Recommended:** one-shot for v1. Revisit if users report deck cards leaking into matches.
3. **Should friends see trade badges on my profile (`/u/[username]`)?**
   - US-11 implies others benefit.
   - **Recommended:** not in v1. Flags are readable by friends (needed for Trade Match), but only shown on your own `/collection` and reflected in Trade Match. Follow-up issue.
4. **Flag visibility for public-collection viewers.**
   - **Recommended:** flags follow collection-row visibility (readable if the row is readable), not the friends-only wishlist rule. They're low-sensitivity, and splitting the rule would need a separate table and policy.
   - Alternative: friends-only like the wishlist, which forces a side table.
5. **Granularity: whole row, not per copy.**
   - **Recommended:** keep the flag per (card, finish, binder) row, covering its full quantity. Partial quantities are out of scope; Manabox binders are the workaround.
   - Confirm this is acceptable for players with playsets split between a deck and spares in the same binder.
6. **"You both have extras" semantics.**
   - **Recommended:** use offered quantities (≥2 on either side), so deck copies don't count as "extras" (AC-8).
   - Alternative: keep total quantities. That's simpler, but it ignores *Not for trade*.
7. **Re-import warning.**
   - **Recommended:** no change to the import modal in v1. Flags persist on matching rows. Flags on rows whose binder or finish changed are silently dropped (AC-22).
   - Alternative: add a line to the replace warning: "Trade flags are kept only for cards that stay in the same binder."

## Design
Mockup: [`6-trade-availability-flags/mockup.html`](6-trade-availability-flags/mockup.html) · Screenshot: [`6-trade-availability-flags/mockup.png`](6-trade-availability-flags/mockup.png) (390px, static, existing tokens only).

| # | Screen / state | ACs |
|---|---|---|
| 1 | /collection default: Trade settings button beside Re-import, "For trade" and "Not for trade" chips, tile badges (Available green, Not for trade dimmed + outlined) | AC-9, 10, 13 |
| 2 | "For trade" chip active (only Available tiles) | AC-13 |
| 3 | Filter with no matches | AC-13 |
| 4 | Card sheet, Unmarked selected | AC-9 |
| 5 | Card sheet saving (control disabled) | UX notes |
| 6 | Card sheet save error "Couldn't update trade status", reverted | AC-14 |
| 7 | First-Available warning (per card) | AC-11 |
| 8 | Trade settings sheet: binders, counts, 3 actions | AC-15 |
| 9 | Binder action running (row loading, others disabled) | UX notes |
| 10 | Bulk success toast and bulk error | AC-16, 18 |
| 11 | First-Available warning (bulk) | AC-17 |
| 12 | No binders found | AC-19 |
| 13 | Empty collection (no Trade settings button) | AC-20 |
| 14 | Loading skeleton (optional; page is server-rendered) | n/a |
| 15 | Trade Match with offer line, opt-in | AC-23 |
| 16 | Offer line variants (Available / except N / whole collection) | AC-24 |
| 17 | Trade Match empty state with "mark cards for trade" link | AC-26 |

Design decisions (recorded as Open questions additions):
- **D1**: Filter chips grow from ~30px to 44px tall to meet the touch-target rule; this slightly changes existing chips.
- **D2**: Not-for-trade tiles are desaturated plus labelled, so state does not rely on colour alone.
- **D3**: Trade settings sheet shows a per-binder state summary ("All not for trade", "Mixed", "Unmarked"), which is not in the spec and needs a count query per binder.
- **D4**: The bulk first-Available warning names the binder and the entry count.
- **D5**: Offer line uses a coloured dot (green opt-in, amber fallback with exclusions, grey whole collection) and an "Edit" link to /collection.
- **D6**: Edge case: if Available rows are all cleared, the user reverts to fallback mode. Mockup variant "nothing yet" is illustrative only and should not be built.

## Decisions (spec gate, 2026-10-11)
Approved by the product owner. These override any conflicting text above.

1. **Only Not-for-trade flags set**: offer the whole collection minus Not-for-trade rows. The first Available flag switches to opt-in, after the confirmation warning (the recommended default; extends PRD §4.6).
2. **Binder bulk marking**: one-time action in v1. No lasting binder rules; cards added to a binder later arrive Unmarked.
3. **Flag visibility**: same as the collection row (friends, or anyone for a public collection). Store flags so they ride on the existing `collection_items` RLS; no separate friends-only table.
4. **Friend badges on `/u/[username]`**: out of scope for v1 (default accepted).
5. **Granularity**: the flag covers the whole row's quantity; no partial quantities (default accepted).
6. **"You both have extras"**: count only offered copies (default accepted).
7. **Re-import**: no change to the import modal; flags on rows that changed binder or finish are dropped silently (default accepted).

**Design scope**
- **Build**: the `/collection` loading skeleton (state 14, via `loading.tsx`) and the offer-line status dot (state 16: green = opt-in, amber = "except N not-for-trade", grey = whole collection).
- **Don't build**: the per-binder state summary in Trade settings (binders show name and counts only), and the "nothing yet" offer variant.
- The empty-state link text follows AC-26 (lowercase, mid-sentence).

## Technical design

### Storage decision
Use a **nullable `trade_status` column on `collection_items`**, not a side table.
- Decision 3 says flags follow the row's visibility. A column gets that from the existing `collection_items_select_own`, `collection_items_select_friends`, and `collection_items_update_own` policies. We add no new policies, and the read and write rules can't drift apart (AC-27/28/29).
- A side table keyed by (user_id, card_id, finish, binder_name) would survive re-import without touching the RPC. But it needs its own copy of the friends/public select policy, and every read would need a join. It also leaves orphan flags behind when a binder or finish changes, which AC-22 forbids, so we'd need cleanup code.
- Re-import survival happens inside `replace_collection_items`. Before the delete, it saves the flagged rows' `(card_id, finish, binder_name, trade_status)`. When it re-inserts, it left-joins those saved flags back on. That triple plus `user_id` is already the table's unique key, so the carry-over is exact. Rows whose binder or finish changed come back Unmarked, and their old flag is gone (AC-21/22, Decision 7).
- `null` means Unmarked. Two values are stored: `'available'` and `'not_for_trade'`. We use text plus a check constraint to match the existing `finish` and `condition` columns.

### Changes
| File | Change |
|---|---|
| `supabase/migrations/20261011120000_trade_availability_flags.sql` (new; generate the file with `supabase migration new trade_availability_flags` and paste the SQL below) | Adds the `trade_status` column and its check constraint, and runs `create or replace` on `replace_collection_items` so flags carry over |
| `src/lib/trades/flags.ts` (new, pure) | `TradeStatus` type, `isTradeStatus`, `summarizeBinders`, `filterByTradeChip`, `needsFirstAvailableWarning`, `applyStatusOverrides` |
| `src/lib/trades/actions.ts` (new, `"use server"`) | `setItemTradeStatus(itemId, status)` and `setBinderTradeStatus(binderName, status)` |
| `src/lib/trades/match.ts` | Adds `offeredItems`, `describeOffer`, `formatOfferLine`. `computeTradeMatches` uses owned maps for exclusion and offered maps for offers and extras. Replaces the outdated "flags don't exist yet" comment |
| `src/components/collection/CollectionGrid.tsx` | `CollectionItem` gets an optional `trade_status`. New optional `onSelectItem` prop: when set, each tile gets a full-tile overlay button, badges show, and the "For trade" / "Not for trade" chips appear. Chips grow to 44px (D1). Not-for-trade tiles are desaturated (D2) |
| `src/components/collection/CollectionView.tsx` | Holds `statusOverrides` state and the selected item. Adds the Trade settings button (hidden when empty), the two sheets, and a toast (`role="status"`) |
| `src/components/collection/CardTradeSheet.tsx` (new, client) | Bottom sheet showing name, finish, binder or "No binder", and quantity. A 3-option radiogroup ("Available to trade" / "Unmarked" / "Not for trade") with `useOptimistic`, saving and error states, and the first-Available confirm |
| `src/components/collection/TradeSettingsSheet.tsx` (new, client) | Binder list from `summarizeBinders`, 3 actions per binder, a per-row loading state, the AC-19 empty state, and the bulk first-Available confirm (D4) |
| `src/components/collection/FirstAvailableConfirm.tsx` (new, client) | Shared confirm dialog for AC-11 and AC-17. Text contains "only cards you mark Available" |
| `src/app/(main)/collection/page.tsx` | Adds `trade_status` to the select |
| `src/app/(main)/collection/loading.tsx` (new) | Skeleton server component (state 14): header, chip row, 3-column tile placeholders. No data fetching |
| `src/app/(main)/trades/[username]/page.tsx` | Adds `trade_status` to the select. Renders the offer line from `describeOffer(viewerItems)` with a status dot and an "Edit" link to `/collection`. `MatchSection.emptyText` becomes a `ReactNode`. Updates the "You have, they want" empty copy with a link "mark cards for trade" to `/collection` |
| `scripts/seed-staging.ts` | Adds `binder`/`tradeStatus` to `SeedItem`. Flags on `e2e_friend`, Path to Exile, a new `e2e_stranger` user, and explicit visibility (see Test plan) |
| `tests/unit/trade-match.test.ts` | New AC-2..AC-8 cases plus `describeOffer`/`formatOfferLine`. Existing cases stay untouched (AC-1) |
| `tests/unit/trade-flags.test.ts` (new) | Tests for the `flags.ts` helpers |
| `tests/e2e/supabase.ts` (new) | Node-side Supabase client signed in as `E2E_EMAIL`, plus fixture, snapshot, and restore helpers |
| `tests/e2e/authed/seeded-data.spec.ts` | Adds a read-only check for AC-25 (Path to Exile absent) and AC-24 (zero flags reads "Offering: your whole collection") |
| `tests/e2e/authed/trade-flags.serial.spec.ts` (new) | AC-9..24, AC-26 (mutates e2e_player and restores it) |
| `tests/e2e/authed/trade-flags-rls.serial.spec.ts` (new) | AC-27..29 |
| `playwright.config.ts` | New `authed-serial` project (`testMatch: /authed\/.*\.serial\.spec\.ts/`, `dependencies: ["authed"]`, `fullyParallel: false`). `authed` ignores `*.serial.spec.ts` |
| `.github/workflows/e2e.yml` | Adds `concurrency: { group: e2e-staging, cancel-in-progress: false }` so two preview runs don't mutate e2e_player at the same time |

Not changed: `src/app/api/collection/import/route.ts` (the RPC signature is the same), `/u/[username]` (it doesn't pass `onSelectItem`, so no badges or chips there, per Decision 4), the import modal, and `/wishlist`.

### Schema
`supabase/migrations/20261011120000_trade_availability_flags.sql`:

```sql
-- =========================================================
-- Trade availability flags (issue #6, PRD US-11/US-12)
-- null = Unmarked, 'available' = opt-in offer, 'not_for_trade' = excluded.
-- Rides on existing collection_items RLS: readable by owner/friends/public
-- per collection_visibility, writable only by the owner (update_own).
-- =========================================================

-- Fail fast instead of queueing behind a long import transaction.
set local lock_timeout = '5s';

-- Nullable, no default: metadata-only change, no table rewrite.
-- Every existing row becomes Unmarked = today's behaviour.
alter table public.collection_items
  add column if not exists trade_status text;

-- The check is validated by a scan; all existing values are null so it is
-- cheap, but split NOT VALID / VALIDATE so the intent is explicit.
alter table public.collection_items
  add constraint collection_items_trade_status_check
  check (trade_status in ('available', 'not_for_trade')) not valid;

alter table public.collection_items
  validate constraint collection_items_trade_status_check;

comment on column public.collection_items.trade_status is
  'Trade availability: null = unmarked, available, not_for_trade. Carried over by replace_collection_items on (card_id, finish, binder_name).';

-- =========================================================
-- replace_collection_items: same signature and semantics, but trade flags
-- survive re-import for rows whose (card_id, finish, binder_name) is still
-- present. Flags are captured BEFORE the delete in a separate statement
-- (not a data-modifying CTE) so the insert never races the delete.
-- p_items cannot set trade_status: the recordset definition omits it.
-- =========================================================
create or replace function public.replace_collection_items(p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_flags   jsonb;
begin
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'card_id', ci.card_id,
             'finish', ci.finish,
             'binder_name', ci.binder_name,
             'trade_status', ci.trade_status)),
           '[]'::jsonb)
    into v_flags
  from public.collection_items ci
  where ci.user_id = v_user_id
    and ci.trade_status is not null;

  delete from public.collection_items
  where user_id = v_user_id;

  insert into public.collection_items
    (user_id, card_id, quantity, finish, condition, language, binder_name, manabox_id, trade_status)
  select
    v_user_id, x.card_id, x.quantity, x.finish, x.condition, x.language, x.binder_name, x.manabox_id,
    f.trade_status
  from jsonb_to_recordset(p_items) as x(
    card_id     uuid,
    quantity    integer,
    finish      text,
    condition   text,
    language    text,
    binder_name text,
    manabox_id  text
  )
  left join jsonb_to_recordset(v_flags) as f(
    card_id      uuid,
    finish       text,
    binder_name  text,
    trade_status text
  )
    on  f.card_id = x.card_id
    and f.finish = x.finish
    and f.binder_name = x.binder_name;
end;
$$;

-- create or replace keeps existing grants; restated for clarity/idempotency.
revoke all on function public.replace_collection_items(jsonb) from public;
grant execute on function public.replace_collection_items(jsonb) to authenticated;
```

Notes:
- **Backfill:** none. Existing rows read as `null` (Unmarked), so everyone starts in fallback mode with no exclusions, which is exactly today's offer (AC-1). There are no new RLS policies. Owner writes go through `collection_items_update_own` (USING + WITH CHECK on `auth.uid() = user_id`). Friends and public viewers only match the select policies, so their updates touch 0 rows (AC-28). Reads follow `collection_items_select_friends` (AC-27/29).
- **No new index.** Trade Match and `/collection` already load all of a user's rows through `collection_items_user_id_idx`, and offer mode is computed in JS from those rows. The binder bulk update filters `user_id = ? and binder_name = ?`. The user_id index narrows that to one user's rows (thousands at most) before filtering by binder. Add `(user_id, binder_name)` only if bulk updates show up as slow.
- **`lock_timeout`:** `set local` keeps it scoped to the migration transaction. If an import holds the table, the migration fails and can be re-run, instead of blocking all reads behind its ACCESS EXCLUSIVE lock.
- **Before shipping:** run `supabase db advisors` against staging after `db push`. Prod is a live remote, so get confirmation before pushing there (see memory).

### Data flow
- **`/collection` (server page):**
  - Selects `id, quantity, finish, condition, binder_name, trade_status, card:cards(...)` with `.eq("user_id", user.id)`, unchanged otherwise. It passes the rows to `CollectionView` (client).
  - `CollectionView` keeps a `statusOverrides: Map<number, TradeStatus | null>`. It renders `applyStatusOverrides(initialItems, overrides)`, which also feeds `needsFirstAvailableWarning` and `summarizeBinders`.
  - The binder list and counts come from rows the client already has, so the sheet needs no extra query.
- **Per-row write:**
  - `CardTradeSheet` calls `setItemTradeStatus(item.id, next)` inside `startTransition`, using `useOptimistic` for the instant selection and badge.
  - On `{ ok: true }` it commits the change to `statusOverrides`.
  - On `{ error }` or a thrown or rejected promise, it sets the inline error "Couldn't update trade status". The optimistic value reverts automatically when the transition ends (AC-14).
  - The call must be wrapped in try/catch: an aborted action request rejects, and an uncaught rejection inside a transition would hit the error boundary.
- **Bulk write:** `TradeSettingsSheet` calls `setBinderTradeStatus(binderName, status)`. On success it puts every item id in that binder into `statusOverrides` and shows the toast "N entries updated" using the server-returned count (AC-16). On error it shows the toast "Couldn't update trade status" and writes no overrides.
- **Server actions (`src/lib/trades/actions.ts`)** follow the `wishlist/actions.ts` pattern: `createClient()`, `getUser()`, return `{ error }`.
  - They validate input with `isTradeStatus(status) || status === null`, a positive integer `itemId`, and a non-empty `binderName` (whitespace only rejected).
  - Both add `.eq("user_id", user.id)` on top of RLS.
  - `setItemTradeStatus`: `update({ trade_status }).eq("id", itemId).eq("user_id", user.id).select("id")`. Zero rows returned → `{ error: "Couldn't update trade status" }`.
  - `setBinderTradeStatus`: `update({ trade_status }, { count: "exact" }).eq("user_id", user.id).eq("binder_name", binderName)`, which returns `{ updated: count }`. One statement covers the whole binder, never one round trip per row.
  - Return values are plain `{ ok, updated?, error? }`, never raw rows.
- **No `refresh()` or `revalidatePath()` in these actions (deliberate).** In Next 16, calling either one from an action re-renders `/collection` inside the action response. For a 3,000-card collection that re-sends every row in the RSC payload on every tap. The client already holds all rows, so local overrides are enough. `/trades/[username]` is dynamic (it reads cookies and isn't cached), so it always reads fresh flags. Server actions are dispatched one at a time per client, so rapid taps can't reorder writes.
- **Re-import:** `ImportCollectionModal` already calls `router.refresh()`. That gives new `initialItems` with fresh ids, so overrides keyed by old ids no longer match anything. Clear `statusOverrides` whenever `initialItems` identity changes.
- **`/trades/[username]` (server page):**
  - Fetches both collections (now including `trade_status`) and both wishlists in the existing `Promise.all`.
  - Calls `computeTradeMatches(...)` and `describeOffer(viewerItems)`, and renders `formatOfferLine(summary)` with the status dot (green = opt-in, amber = fallback with exclusions, grey = whole collection) and an "Edit" link to `/collection`.
  - Tiles show the `quantity` returned by the matcher, which is now the offered quantity.
- **`loading.tsx`:** a static skeleton for `/collection` only, which wraps the page in Suspense. There is no `cacheComponents` or `unstable_instant` (not enabled in `next.config.ts`; out of scope).

### Logic placement
**`src/lib/trades/match.ts`** (pure, no I/O):
- `offeredItems(items)`: if any row is `'available'`, keep only Available rows. Otherwise keep rows where `trade_status !== 'not_for_trade'` (undefined or null counts as Unmarked).
- `describeOffer(items)` returns one of:
  - `{ mode: "opt_in", availableCount }` (number of Available rows)
  - `{ mode: "fallback", notForTradeCount }` (0 means whole collection)
- `formatOfferLine(summary)` returns one of:
  - "Offering: N card(s) you marked Available"
  - "Offering: your collection except N not-for-trade entr(y|ies)"
  - "Offering: your whole collection"
- `computeTradeMatches`:
  - Builds `viewerOwned`/`friendOwned` with `aggregateByCard(all rows)` and `viewerOffered`/`friendOffered` with `aggregateByCard(offeredItems(rows))`.
  - **youHaveTheyWant:** cards in `viewerOffered` that are not in `friendOwned`, filtered by the friend's wishlist when it's non-empty (as today).
  - **theyHaveYouWant:** the mirror image of the above.
  - **bothHaveExtras:** cards in both `viewerOwned` and `friendOwned` where `(viewerOffered qty ?? 0) >= 2 || (friendOffered qty ?? 0) >= 2`. The tile uses the viewer's offered summary, falling back to the owned summary with `quantity` set to the offered count (0 hides the ×N badge).
  - With no flags, offered equals owned, so the results are identical (AC-1).
  - The signature is unchanged. `trade_status` is optional on `CollectionItem`, so the existing unit fixtures and `/u/[username]` compile unchanged.

**`src/lib/trades/flags.ts`** (pure):
- `summarizeBinders(items)` returns `{ name, rows, cards, itemIds }[]`. It skips `binder_name.trim() === ""` and sorts by name with `localeCompare`.
- `filterByTradeChip(items, "for_trade" | "not_for_trade")`.
- `needsFirstAvailableWarning(items, next)` is `next === "available" && !items.some(i => i.trade_status === "available")`. This only drives the UI warning. The server doesn't enforce it.
- `applyStatusOverrides(items, overrides)`.

Pages only fetch and render. Components hold UI state only.

**UI details that affect tests:**
- **Tile:** keep the `<img alt={name}>` exposed. Add a sibling `<button className="absolute inset-0">` with `aria-label={`${name}, ${binder || "No binder"}`}`. Don't wrap the img inside the button: button children are presentational in ARIA, which would break the existing `getByRole("img", { name })` assertions in `seeded-data.spec.ts`.
- **Badges** (bottom-left) are text: "Available" / "Not for trade".
- **Trade-status control** is a `role="radiogroup"` with three `role="radio"` options.
- **Trade settings rows:** each is a `role="group"` named by its binder.
- **Chips:** in the chip row, "For trade" and "Not for trade" are single-select alongside the colour chips. Colour and Foil filters aren't combined with them.

### Test plan
**Vitest** (`tests/unit/trade-match.test.ts`, `tests/unit/trade-flags.test.ts`):

| AC | Test |
|---|---|
| AC-1 | Existing `computeTradeMatches` cases are unchanged and still pass. Add one case that runs the "neither side has a wishlist" fixture with `trade_status: null` set explicitly and asserts deep equality with the untagged result |
| AC-2 | Viewer has an NFT row for X and no Available rows. The friend doesn't own X and has an empty wishlist. X is not in `youHaveTheyWant` |
| AC-3 | Viewer has A Available and B, C Unmarked. `youHaveTheyWant` ids equal `["A"]` |
| AC-4 | Friend has D Available and E Unmarked. `theyHaveYouWant` contains D and not E |
| AC-5 | Viewer has X in two rows: 3 Unmarked and 4 NFT. The `youHaveTheyWant` entry for X has `quantity === 3` |
| AC-6 | Friend owns X only in an NFT row. X is not in `youHaveTheyWant` |
| AC-7 | Viewer has A, B Available and the friend's wishlist is `[B]`. Result is exactly `["B"]` |
| AC-8 | Offered 1/1 with other viewer copies NFT: not in `bothHaveExtras`. Offered 2/1 and 1/2: in `bothHaveExtras` |
| AC-11/17 (logic) | `needsFirstAvailableWarning` is true with zero Available rows, false once one exists, and false for `not_for_trade`/`null` |
| AC-13 (logic) | `filterByTradeChip` with one row in each state |
| AC-15/19 (logic) | `summarizeBinders` returns the right row and card counts, skips `""` and whitespace-only names, sorts by name, and returns `[]` when all rows have no binder |
| AC-23/24 (copy) | `describeOffer` + `formatOfferLine` cover all three variants, including singular and plural |

**Playwright, read-only** (`tests/e2e/authed/seeded-data.spec.ts`, parallel `authed` project):
- **AC-25:** on `/trades/e2e_friend`, Path to Exile is absent. "They have, you want (1)" still shows Swords to Plowshares only. This is a meaningful check: without the friend's opt-in, Path to Exile would match the player's wishlist.
- **AC-24 (zero flags):** the line "Offering: your whole collection" is visible.
- The existing assertions (1/1/1 counts) stay valid with the new seed.

**Playwright, mutating** (`tests/e2e/authed/trade-flags.serial.spec.ts`, serial project that runs after `authed`):
- `beforeAll`: `snapshotCollection()` saves e2e_player's rows and flags.
- `afterAll`: `restoreCollection(snapshot)` runs the RPC with the snapshot rows, then updates flags by (card_id, finish, binder_name).
- Each `describe` sets its own fixture through the signed-in node client: RPC `replace_collection_items`, plus direct flag updates. Card ids are looked up in `cards` by seeded name and set.

| AC | Fixture → assertion |
|---|---|
| AC-9 | 3 rows, no flags. Tap a tile → dialog shows name, finish, binder or "No binder", and quantity. The "Unmarked" radio is checked |
| AC-10 | One row already Available. Choose "Not for trade" on another → badge appears. After reload the badge persists and the dialog shows it checked |
| AC-11 | Zero Available rows. Choose "Available to trade" → confirm with "only cards you mark Available". Cancel → still Unmarked. Repeat and Confirm → "Available" badge. Mark a second row → no dialog |
| AC-12 | Available row → choose "Unmarked" → badge gone, and still gone after reload |
| AC-13 | One row in each state. The "For trade" chip shows only the Available tile. "Not for trade" shows only the NFT tile |
| AC-14 | `page.route("**/collection", ...)` fulfils with status 500 when `request.method() === "POST"` and the `next-action` header is set. Change a flag → "Couldn't update trade status" appears, and the badge and radio revert. Unroute afterwards |
| AC-15 | "Deck A" with 5 rows, "Trade" with 3, plus 2 rows with an empty binder. The Trade settings sheet lists exactly 2 groups with "5" and "3" |
| AC-16 | "Not for trade" on Deck A → toast with "5 entries". The "Not for trade" chip shows exactly the 5 Deck A tiles (by tile button aria-label containing "Deck A") |
| AC-17 | Zero Available rows. "Available" on a binder → confirm appears. Cancel, then verify through the node client that no row changed |
| AC-18 | Deck A is NFT and one Trade row is Available. Clear Deck A → all 5 rows are null in the DB, and the Trade row stays Available |
| AC-19 | All rows have an empty binder → "No Manabox binders found in your import", and no action buttons |
| AC-20 | RPC with `[]` → no Trade settings button. The "No cards yet" state is unchanged |
| AC-21 | RPC fixture X nonfoil "Deck A" set to NFT. Re-run the RPC with X "Deck A" at qty 3, `lightly_played` → `trade_status = 'not_for_trade'` |
| AC-22 | X "Deck A" set to Available. RPC with X in "Trade" → the "Trade" row is null and no "Deck A" row exists |
| AC-23 | Player rows: Sol Ring qty 1 Available, plus Arcane Signet and Counterspell Unmarked → on `/trades/e2e_friend`, "You have, they want" has no card other than Sol Ring (the friend owns Sol Ring, so the section is empty). Line reads "Offering: 1 card you marked Available", with the link to `/collection` |
| AC-24 | Two NFT rows and no Available rows → "Offering: your collection except 2 not-for-trade entries" |
| AC-26 | Same state as AC-23 → the empty text includes the link "mark cards for trade" with `href="/collection"` |

**Playwright, RLS** (`tests/e2e/authed/trade-flags-rls.serial.spec.ts`; Node client signed in as e2e_player, no browser):
- **AC-27:** look up `e2e_stranger`'s user_id from `profiles` (readable to all authenticated users). Then `select id, trade_status from collection_items where user_id = stranger` → 0 rows.
- **AC-28:**
  - `update({ trade_status: "not_for_trade" }).eq("user_id", friendId).select("id")` → 0 rows.
  - `update({ trade_status: null })` does the same.
  - Re-reading shows the friend's Swords to Plowshares row is still `'available'`.
- **AC-29:** `select trade_status from collection_items where user_id = friendId` returns the friend's rows, including one with `'available'`.

**`tests/e2e/supabase.ts`:**
- Uses `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` + `signInWithPassword(E2E_EMAIL, E2E_PASSWORD)`. CI already has these env vars.
- Exports helpers:
  - `cardId(name, set)`
  - `setCollection(rows)` (calls the RPC)
  - `setFlags([{ card, binder, status }])`
  - `snapshotCollection()` / `restoreCollection()`

**Seed changes (`scripts/seed-staging.ts`, still idempotent: delete then insert per user, upsert profiles and friendships):**
- `SeedItem` gets `binder?: string` and `tradeStatus?: "available" | "not_for_trade"`. They're written as `binder_name: binder ?? ""` and `trade_status: tradeStatus ?? null`.
- **e2e_friend** (opt-in mode): Swords to Plowshares (ema) `tradeStatus: "available"`, `binder: "Trade Binder"`. Add Path to Exile (con) Unmarked, `binder: "Bulk"`. Leave Sol Ring, Llanowar Elves, and Cultivate Unmarked.
- **e2e_player:** collection stays as it is, with no flags (fallback / whole collection). Add a wishlist entry for Path to Exile (con), `any_printing`. Expected Trade Match is unchanged: You have/they want = Arcane Signet; They have/you want = Swords to Plowshares only (Path is excluded by the friend's opt-in); Both have extras = Sol Ring (the player offers 2). Update the header comment to match.
- **New `e2e_stranger`** (`e2e-stranger@manapals.test`, auto-created with a random password like the friend): one row, Cultivate (m21), `not_for_trade`.
  - Not friended. The seed deletes any `friendships` row between e2e_player and e2e_stranger so a re-run resets it.
- **Visibility:** each seeded profile upsert explicitly sets `collection_visibility: "friends"`, so AC-27 is deterministic even if someone flipped it in staging.
- The seed's Scryfall fetch picks up Path to Exile (con) automatically through the wishlist and collection lists.

### Risks
1. **Privacy: flags are as readable as the collection, including to strangers when the collection is public.** This was accepted in Decision 3. Flags are low-sensitivity, but anyone who can read the row can see "not for trade". The `/u/[username]` UI hides them (Decision 4), but the data is readable through the API. No new write surface: `update_own` already gives owners full control of their rows, and non-owners match no update policy (AC-28).
2. **Migration on live prod.** The change is additive: a nullable column with no default (metadata-only), a check validated over all-null values, and a `create or replace` of the RPC with the same signature and grants.
   - The real hazard is the ACCESS EXCLUSIVE lock waiting behind an in-flight import. `lock_timeout = 5s` makes it fail fast and retryable.
   - **Deploy order:** apply the migration before deploying the app. Old app code with the new RPC works, because flags simply carry over. New app code with the old schema fails, because `trade_status` doesn't exist in the select. The existing migrate-prod workflow must run first.
   - Rollback means dropping the column and restoring the old RPC body. That is **destructive to flags**, so call it out if it's ever needed.
3. **Re-import data loss is by design.** Flags on rows whose binder or finish changed are silently dropped (Decision 7, AC-22). Users who reorganise Manabox binders lose those flags without warning. A follow-up could add the optional import-modal line from Q7.
4. **Fallback leaks after bulk "Not for trade".** Binder actions are one-shot (Decision 2), so cards later imported into "Atraxa Deck" arrive Unmarked and are offered in fallback mode. This is accepted for v1 and worth monitoring.
5. **Performance on large collections.**
   - The trade page already loads both full collections. `offeredItems`/`aggregateByCard` add one more O(n) pass each, which is negligible.
   - Bulk update is one statement and fires the `updated_at` trigger once per row, so roughly 1k rows is fine.
   - Not calling `refresh()` avoids re-sending around 1 MB of RSC payload per tap. The trade-off: a back/forward restore of `/collection` from the client router cache can briefly show pre-change badges until the next navigation or reload. Trade Match data is always fresh.
6. **E2E flakiness from mutating shared staging users.** The serial project, snapshot/restore, and the workflow `concurrency` group contain this. A run killed mid-suite can leave e2e_player's collection altered, and `npm run seed:staging` fixes it. Each mutating test sets its own fixture first, so it doesn't depend on a clean start. If this proves brittle, the alternative is a dedicated `e2e_flagger` user with its own storage state. That needs the seed to set a known password from `E2E_PASSWORD`.
7. **RPC duplicate keys.** The left join can only produce one match per input row, because `v_flags` comes from rows unique on (user_id, card_id, finish, binder_name). Duplicate keys inside `p_items` still raise a unique violation, which is the same behaviour as today.
