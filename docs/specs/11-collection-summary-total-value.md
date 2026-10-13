# Collection summary: total cards and estimated value
Issue: #11 · PRD refs: US-13, §4.3, §4.4, §5.2, §5.3 · Status: Approved

## Problem
`/collection` shows a grid of tiles but never tells you how big the collection is or what it's roughly worth. To find out, a player would have to scroll and add things up in their head. PRD US-13 ("see the estimated market value of my collection via Scryfall price data", Nice to Have) has not been built yet. The prices are already in the database (`cards.price_usd`, `cards.price_usd_foil`, filled in by `src/lib/scryfall/cardRow.ts` at import time) and are already loaded on `/collection`, but the page never shows them.

## Users & scenario
Theo has imported about 1,200 cards from Manabox. While waiting for a game to start, he opens ManaPals on his phone.

1. He taps **Collection**. Right under the "Collection" heading, before the search box, one line reads: **"1,214 cards · 873 unique · ~$2,431.18"**. A smaller line below it says **"Estimated from Scryfall prices · 12 cards have no price"**.
2. He types "bolt" in the search box. The grid narrows, but the summary still describes his whole collection.
3. He re-imports a newer CSV. When the page refreshes, the summary shows the new totals.
4. His friend Maya has just signed up and has nothing imported. Her `/collection` shows only the existing "No cards yet" empty state, with no summary line.

## Scope
### In scope
- A summary block at the top of `/collection`, shown only for the signed-in user's own collection. It contains:
  - **Total cards:** the sum of `quantity` over all of the user's `collection_items` rows.
  - **Unique cards:** the number of distinct printings (`card.scryfall_id`) across those rows. Finish, binder, and condition do not create extra "unique" entries (see Q1).
  - **Estimated value (USD):** the sum over rows of `quantity × unit price`, where:
    - for `finish` = `foil` or `etched`: unit price = `price_usd_foil`, or `price_usd` if that is null.
    - for `finish` = `nonfoil`: unit price = `price_usd`. There is no fallback to the foil price (see Q3).
    - if the unit price is still null, the row adds nothing to the value and its quantity is counted as "no price".
  - **Estimate disclaimer:** visible text containing "Estimated from Scryfall prices". If any cards have no price, it also says how many, for example "12 cards have no price".
- The summary is computed from the whole collection. Search, colour/foil/trade chips, and sort do not change it.
- The summary counts every row regardless of `trade_status`.
- The calculation is a pure function in `src/lib/` (for example `src/lib/collection/summary.ts`) with Vitest unit tests. The page and components only render its result. The foil-fallback price rule already exists inline in `src/lib/trades/match.ts` (line 47). The architect should consider pulling it out into one shared helper so the two can't drift apart.
- No schema changes, no new queries. `src/app/(main)/collection/page.tsx` already selects `quantity`, `finish`, `card.scryfall_id`, `price_usd`, and `price_usd_foil`.

### Out of scope
- Showing the summary on a friend's or public profile (`/u/[username]`) or on Trade Match (Q4).
- A summary that updates to match the current search or filter ("showing 40 cards, $120").
- A per-binder, per-set, per-colour, or per-rarity breakdown, charts, or value history. PRD §6 defers "Collection analytics / charts".
- Refreshing prices from Scryfall on page view, or showing how old the prices are.
- Storing or using Scryfall's `usd_etched` price. It is not stored today, and storing it would need a schema change (Q2).
- Other currencies (EUR/TIX) and locale-specific currency formats.
- Using Manabox purchase prices. They are stripped at import per §5.3 and must stay that way.
- Fixing the grid's "Price" sort, which uses `price_usd` only and ignores foil prices. Noted for a possible follow-up.
- Changes to the import modal, Trade settings, or the empty state.

## Acceptance criteria
Unit = Vitest on the pure summary function in `src/lib/`. E2E = Playwright as the seeded `e2e_player`.

**Calculation (Vitest)**
- **AC-1** *(totals)*
  - **Given** rows `[A nonfoil ×2, A foil ×1, B nonfoil ×1]`, where A and B are different `scryfall_id`s,
  - **When** the summary is computed,
  - **Then** `totalCards = 4` and `uniqueCards = 2`.
- **AC-2** *(same printing across binders)*
  - **Given** two rows for the same `scryfall_id` and finish in binders "Deck" and "Bulk", with quantities 3 and 1,
  - **When** the summary is computed,
  - **Then** `totalCards = 4` and `uniqueCards = 1`.
- **AC-3** *(nonfoil price)*
  - **Given** a nonfoil row ×3 with `price_usd = 1.50` and `price_usd_foil = 9.00`,
  - **Then** `estimatedValue = 4.50`.
- **AC-4** *(foil price)*
  - **Given** a foil row ×2 with `price_usd = 1.00` and `price_usd_foil = 5.25`,
  - **Then** `estimatedValue = 10.50`.
- **AC-5** *(foil falls back to regular)*
  - **Given** a foil row ×1 with `price_usd_foil = null` and `price_usd = 2.00`,
  - **Then** `estimatedValue = 2.00` and `unpricedCards = 0`.
- **AC-6** *(etched uses the foil rule)*
  - **Given** an etched row ×1 with `price_usd_foil = 7.00` and `price_usd = 3.00`,
  - **Then** `estimatedValue = 7.00`.
  - **And Given** an etched row with `price_usd_foil = null` and `price_usd = 3.00`, **Then** it contributes `3.00`.
- **AC-7** *(nonfoil does not borrow the foil price)*
  - **Given** a nonfoil row ×2 with `price_usd = null` and `price_usd_foil = 4.00`,
  - **Then** it adds `0` to `estimatedValue` and `unpricedCards = 2`.
- **AC-8** *(missing prices don't break the total)*
  - **Given** rows `[X nonfoil ×1 price 1.00, Y foil ×3 with both prices null]`,
  - **Then** `estimatedValue = 1.00`, `unpricedCards = 3`, and `totalCards = 4`. No NaN, no thrown error.
- **AC-9** *(no priced cards)*
  - **Given** every row has both prices null,
  - **Then** `estimatedValue` is reported as unavailable (for example `null`, or a `pricedCards = 0` flag), not `0`, and `unpricedCards = totalCards`.
- **AC-10** *(empty input)*
  - **Given** an empty array,
  - **Then** `totalCards = 0`, `uniqueCards = 0`, `unpricedCards = 0`, and the value is unavailable.
- **AC-11** *(rounding)*
  - **Given** three nonfoil rows ×1 priced `0.10`, `0.20`, and `0.30`,
  - **Then** the value formats as exactly `"$0.60"`, with no float drift such as `0.6000000000000001`.
- **AC-12** *(rows without card data)*
  - **Given** a row whose `card` is null (the join failed),
  - **Then** its quantity counts toward `totalCards` and `unpricedCards`, but not toward `uniqueCards`, and nothing throws.
  - This is a proposed default; see Q5.
- **AC-13** *(formatting)*
  - **Given** `totalCards = 1214`, `uniqueCards = 873`, and value `2431.18`,
  - **When** the display helper formats them,
  - **Then** the output contains `"1,214 cards"`, `"873 unique"`, and `"~$2,431.18"`.
  - Singulars read `"1 card"` and `"1 card has no price"`.

**Display on /collection (Playwright, `tests/e2e/authed/`)**
- **AC-14** *(summary visible with seeded data)*
  - **Given** I'm signed in as `e2e_player`, whose seeded collection is Sol Ring ×2, Arcane Signet, Lightning Bolt (foil), and Counterspell,
  - **When** I open `/collection`,
  - **Then** a summary region (findable by accessible name, for example `getByRole("region", { name: "Collection summary" })`) is visible above the search box,
  - **And** it contains "5 cards" and "4 unique",
  - **And** it contains a dollar amount matching `/~\$\d[\d,]*\.\d{2}/` or the text "Value unavailable".
  - The exact amount is not asserted, because seed prices come from live Scryfall data. A test may compute the expected value from the DB through `tests/e2e/supabase.ts`.
- **AC-15** *(estimate disclaimer)*
  - **Given** the summary is visible,
  - **Then** the text "Estimated from Scryfall prices" is visible inside it.
- **AC-16** *(filters don't change the summary)*
  - **Given** the summary shows "5 cards",
  - **When** I type "Sol Ring" in the search box and tap the "Foil" chip,
  - **Then** the summary still shows "5 cards" and "4 unique", and the dollar amount is unchanged.
- **AC-17** *(empty collection)*
  - **Given** I have no collection rows,
  - **When** I open `/collection`,
  - **Then** no summary region is rendered, and the existing "No cards yet" empty state and "Import Collection" button are unchanged.
  - This can be covered by a component or unit test of `CollectionView` with `initialItems=[]` if mutating the seeded user is not practical.
- **AC-18** *(unpriced count shown)*
  - **Given** a collection where at least one row has no usable price,
  - **Then** the summary shows "<N> card(s) have no price", with N equal to `unpricedCards`.
  - **And Given** every row is priced, **Then** no "no price" text is shown.
  - Covered by a component-level render test with fixture items, because seeded prices can't be controlled.
- **AC-19** *(own collection only)*
  - **Given** I am `e2e_player` and `e2e_friend` has more cards than I do,
  - **When** I open `/collection`,
  - **Then** the totals reflect only my rows ("5 cards"), not my friend's. The page already filters `user_id = auth.uid()`; this test guards that.
  - **And When** I open `/u/e2e_friend`, **Then** no collection summary region is shown there.
- **AC-20** *(mobile layout)*
  - **Given** a 375px-wide viewport,
  - **Then** the page has no horizontal scroll: `document.documentElement.scrollWidth <= 375`, with the summary rendered and a value of at least `$10,000.00` in a fixture or component test.

## Data & privacy
- **Stored:** nothing new. There are no migrations, columns, tables, or RLS changes. The values are derived at render time from rows the page already loads.
- **Who sees it:** only the owner, on their own `/collection`. The page query is already scoped to `user_id = user.id`.
  - A friend could technically compute the same numbers from rows RLS already lets them read (friends-only by default, §5.3). This feature does not show the numbers anywhere a friend or the public would see them.
- **Price source:** Scryfall `prices.usd` and `prices.usd_foil`, as stored on `cards` at import time (§4.3). Manabox purchase prices are still never stored or shown (§5.3).

## UX notes
- **Screen touched:** `/collection` only (`CollectionView`). The summary sits between the header row (title plus Trade settings / Re-import) and the search box.
- **Layout (mobile-first):**
  - Line 1, primary text: `5 cards · 4 unique · ~$12.34`. The value is the most prominent element.
  - Line 2, muted small text: `Estimated from Scryfall prices`, followed by ` · 1 card has no price` when relevant.
  - It may wrap on narrow screens but must not overflow (AC-20).
  - It is not interactive, so there are no touch targets.
- **States:**
  - *Empty collection:* hidden (AC-17).
  - *No priced cards:* line 1 reads `5 cards · 4 unique · Value unavailable`.
  - *Loading:* `loading.tsx` already shows a skeleton. Adding one placeholder bar for the summary is optional and up to the designer.
  - *Error:* there is no separate error state. The summary is derived from data already on the page. If the collection query fails, the page behaves as it does today.
- **After re-import:** the summary must reflect the new rows once the page refreshes. It is derived from `initialItems`, not cached separately.
- **Accessibility:** wrap the summary in a labelled region ("Collection summary") so screen readers and tests can find it.

## Open questions
1. **What counts as a "unique card"?** Options:
   - distinct printings (`scryfall_id`): Sol Ring CMR and Sol Ring C21 count as 2
   - distinct names / `oracle_id`: they count as 1
   - distinct rows (printing × finish × binder)

   **Recommended:** distinct printings. It matches how Manabox and Scryfall identify cards, and it needs no query change (`oracle_id` isn't selected on `/collection` today).
2. **Etched pricing.** Scryfall has a separate `prices.usd_etched`, but it isn't stored, and the issue says not to change the schema.
   - **Recommended:** treat etched like foil (`price_usd_foil`, then `price_usd`), as the issue says and as `src/lib/trades/match.ts` already does.
   - Storing `usd_etched` can be a follow-up if the totals look off.
3. **Nonfoil copy with only a foil price** (rare, for example foil-only promos imported as nonfoil).
   - **Recommended:** count it as unpriced (AC-7). The issue only allows falling back from foil to regular, and borrowing the higher foil price would inflate the estimate.
4. **Show the summary on friends' profiles (`/u/[username]`)?** It would be easy, since the same `CollectionGrid` data is there.
   - **Recommended:** not in this issue. The issue scopes the feature to `/collection`, and showing someone's collection value to others is a privacy and product decision that deserves its own issue.
5. **Rows whose `card` join is null.** The grid already hides these tiles.
   - **Recommended:** count their quantity in total cards and in "no price", but not in unique (AC-12). The card total then matches what the user imported, and the value stays honest.
   - Alternative: skip them entirely so the counts match the visible grid.
6. **Precision / display.**
   - **Recommended:** always show 2 decimals in `en-US` format with a leading `~` to signal an estimate (`~$2,431.18`). Rounding to whole dollars is the alternative if it looks noisy.
7. **PRD alignment.**
   - US-13 is a Nice to Have, and PRD §6 defers "Collection analytics / charts". A single read-only summary line is a small part of US-13, not analytics.
   - **Recommended:** proceed. Breakdowns and charts stay out of scope as listed above.

## Design
Mockup: [mockup.html](11-collection-summary-total-value/mockup.html) · Screenshot: [mockup.png](11-collection-summary-total-value/mockup.png) (390px wide).

The summary is a single card (`bg-elevated`, `border-border`, `rounded-[--radius-card]`, `px-4 py-3`) in a `<section role="region" aria-label="Collection summary">`, placed between the header row and the search box. Line 1 is `text-sm text-text-secondary` with the card count in `text-text-primary` bold and the value in amber (`text-amber`, ~22px, extra-bold). Line 2 is `text-xs text-text-muted`. It is not interactive.

| # | State | ACs |
|---|-------|-----|
| 1 | Default, all priced | AC-14, AC-15, AC-13 |
| 2 | Some unpriced ("12 cards have no price" / "1 card has no price") | AC-18 |
| 3 | No priced cards: "Value unavailable" in place of the amount | AC-9, AC-10 |
| 4 | Search and Foil chip active, summary unchanged | AC-16 |
| 5 | Large collection on a narrow screen, wraps without overflow | AC-20 |
| 6 | Empty collection: no summary, existing empty state | AC-17 |
| 7 | Loading: one optional 62px placeholder bar in `loading.tsx` | n/a |

Design decisions: the value uses the amber accent so it is the most prominent element, matching the app's single accent color. The "Value unavailable" text is smaller and grey so it does not look like a number. The loading placeholder is included as optional.

## Decisions (spec gate, 2026-10-13)
Owner replied "approve" with no changes. The recommended defaults for Q1–Q7 are accepted:
1. Unique = distinct printings (`scryfall_id`).
2. Etched priced like foil (`price_usd_foil`, then `price_usd`).
3. Nonfoil with only a foil price counts as unpriced.
4. No summary on friend/public profiles.
5. Null-`card` rows count toward total and "no price", not unique.
6. Always 2 decimals, `en-US`, leading `~`.
7. Proceed despite PRD US-13 being Nice to Have.
