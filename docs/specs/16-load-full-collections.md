# Load full collections over 1,000 cards
Issue: #16 · PRD refs: US-08, US-09, US-10, US-13, US-17, §2 (Primary users), §4.4, §4.6, §5.1, §5.2, §5.3 · Status: Approved

## Problem
Three pages read a whole collection with a single unpaged Supabase query:
- `/collection` (`src/app/(main)/collection/page.tsx`)
- Trade Match (`fetchCollectionByUser` in `src/app/(main)/trades/[username]/page.tsx`)
- Public/friend profile (`src/app/(main)/u/[username]/page.tsx`)

PostgREST caps every response at `max_rows = 1000` (`supabase/config.toml`; the hosted projects use the same default). A collection with more than 1,000 rows (one row = one card + finish + binder) silently shows only the first 1,000 by `id`. Nothing tells the user anything is missing. As a result:
- Search, filters and sort on `/collection` and `/u/[username]` miss cards.
- Trade Match misses offers, and it can also show false matches. A card the friend owns in row 1,001+ looks "not owned", so it appears in "You have, they want".
- The collection summary from #11 (PR #15, not yet merged on this branch) undercounts total cards and value, because `summarizeCollection` runs over the truncated rows.

Enfranchised players, the PRD's primary users (§2), are the most likely to have thousands of rows. Rendering thousands of tiles at once is also a phone performance risk (§5.1, §5.2).

## Users & scenario
Maya has 2,400 rows imported from Manabox. She opens ManaPals on her phone (Android Chrome, LTE).

1. She opens **Collection**. The header summary reads "3,105 cards". Before this change it showed the total for the first 1,000 rows only.
2. The grid shows the first batch of tiles straight away. As she scrolls toward the bottom, more tiles appear until all 2,400 rows are shown. If she stops at the bottom of a batch, a **Show more** button is also there.
3. She searches "Ragavan". The only copy she owns is in row 2,210, and it appears. Search, filter and sort always cover all 2,400 rows, not just the tiles rendered so far.
4. Her friend Theo opens `/trades/maya`. Under "They have, you want" he sees Maya's Ragavan. Under "You have, they want" he no longer sees a Sheoldred that Maya already owns in row 1,500.
5. Theo opens `/u/maya`. The grid there behaves the same way as on `/collection`.

## Scope
### In scope
- **Load every row.** All three readers return the complete set of the target user's `collection_items` rows, however many there are. One shared reader serves all three pages, so they can't drift apart again. Each page keeps its current `select` columns.
- **Fail loudly, never partially.** If any part of the load fails, the page shows an error state. It never shows a partial collection as if it were complete. This replaces today's `data ?? []`, which shows a failed load as an empty collection.
- **Progressive rendering on the shared grid (`CollectionGrid`).** Used by `/collection` and `/u/[username]`:
  - Render the first batch of matching tiles, then append the next batch when the user nears the end of the list or taps **Show more**.
  - Search, chips and sort run over the full in-memory list. Rendering only limits how many of the *results* are in the DOM.
  - Changing the search text, chip or sort goes back to the first batch.
  - **Chosen approach:** progressive rendering, not virtualization (see "Approach" below).
- **Summary correctness.** If #11 has merged, its summary runs over the full list. No change to its logic.

### Approach (chosen)
- **Data:** read in pages on the server, ordered by `id`, until a page comes back short. Pass the whole list to the page as today.
  - This keeps PRD §4.4's client-side search/filter/sort and #11's client-side summary working unchanged.
  - The paging loop is pure logic in `src/lib/**` and is unit-tested with a fake page fetcher.
- **Render:** progressive batches rather than a windowed/virtualized grid.
  - The grid is a responsive 3-column layout, and its tiles hold `<img>` elements that E2E already queries by role and name. Virtualization would remove off-screen tiles from the DOM. That breaks those assertions, browser find-in-page and scroll restoration, and it adds a dependency.
  - Progressive batches cap the initial DOM, and images already use `loading="lazy"`.
- Batch size, the paging page size, and scroll detection (for example IntersectionObserver plus the button fallback) are the architect's call within the ACs below.

### Out of scope
- Server-side search, filtering, sorting or pagination APIs (for example, fetching page 2 only when the user scrolls). The full list is still loaded up front.
- Grid virtualization/windowing, and the PRD §4.4 "list view" for large collections.
- Raising `max_rows` in Supabase project settings (see Q1).
- Progressive rendering of the three Trade Match sections (Q3). This spec only makes the match *input* complete.
- The same 1,000-row cap in other readers:
  - `getWishlistItems` (wishlists rarely exceed 1,000).
  - The `cards` cache lookups in `src/app/api/collection/import/route.ts` (`.in(...)` on scryfall ids / set codes). These cause redundant Scryfall fetches rather than missing data (Q4).
  - `snapshotCollection` in `tests/e2e/supabase.ts`.
- Any schema, RLS, or migration change.
- Caching or memoizing collections across requests.
- A loading progress indicator ("Loaded 2,000 of 3,000…"). The existing `loading.tsx` skeleton covers the wait.
- Performance budgets as tests (for example "loads in < 3 s"). See AC-9 and AC-10 for the observable proxies.

## Acceptance criteria
Unit = Vitest on pure logic in `src/lib/**`. E2E = Playwright as the seeded `e2e_player`, with a large fixture written through `tests/e2e/supabase.ts` `setCollection`.

Fixture note: the row key is (user_id, card_id, finish, binder_name), so a 1,250-row fixture can reuse the existing seeded cards with distinct binder names (for example "Bulk 0001"…"Bulk 1250"). No extra Scryfall data is needed. Mutating specs follow the existing `*.serial.spec.ts` snapshot/restore pattern.

**Full load: shared reader (Vitest)**
- **AC-1** *(more than one page)*
  - **Given** a fake page fetcher holding 2,345 rows that returns at most 1,000 rows per call,
  - **When** the shared reader runs,
  - **Then** it returns exactly 2,345 rows, in ascending `id` order, with no duplicates.
- **AC-2** *(exact multiple of the page size)*
  - **Given** a fake fetcher holding exactly 2,000 rows (page size 1,000),
  - **When** the reader runs,
  - **Then** it returns 2,000 rows and stops after the first empty or short page. It does not loop forever.
- **AC-3** *(small and empty)*
  - **Given** a fetcher with 0 rows, **Then** the reader returns `[]` after one call.
  - **Given** a fetcher with 7 rows, **Then** it returns 7 rows after one call.
- **AC-4** *(error on a later page)*
  - **Given** a fetcher that succeeds for page 1 and returns an error for page 2,
  - **When** the reader runs,
  - **Then** it reports an error (it throws or returns an error result) and does not return the page-1 rows as a complete result.

**Full load: pages (Playwright)**
- **AC-5** *(/collection shows everything)*
  - **Given** e2e_player's collection is 1,250 rows, with a uniquely named card ("Cultivate", m21, binder "Bulk 1250") only in the row with the highest `id`,
  - **When** I open `/collection` and search "Cultivate",
  - **Then** exactly one matching tile with binder "Bulk 1250" is visible.
- **AC-6** *(summary counts every row; only if #11 has merged)*
  - **Given** the 1,250-row fixture where every row has quantity 1,
  - **When** I open `/collection`,
  - **Then** the summary's total-cards figure reads "1,250".
- **AC-7** *(Trade Match sees the friend's full collection)*
  - **Given** e2e_player owns card X only in row 1,201+ of a 1,250-row collection,
  - **And** e2e_friend owns X, offers it, and has an empty wishlist,
  - **When** e2e_player opens `/trades/e2e_friend`,
  - **Then** X is **not** in "They have, you want". Before the fix, X would appear there wrongly.
  - Because Trade Match uses the same shared reader for both sides, AC-1 covers the viewer/friend symmetry.
- **AC-8** *(/u/[username] uses the full reader)*
  - **Given** a profile collection the viewer is allowed to see,
  - **When** `/u/[username]` loads,
  - **Then** the page gets its rows from the same shared reader as AC-1.
  - Check this with a unit test of the reader plus a code-level assertion that the page no longer calls `.from("collection_items")` directly. No new E2E user is needed.

**Progressive rendering (Playwright, mobile viewport)**
- **AC-9** *(initial render is capped)*
  - **Given** the 1,250-row fixture,
  - **When** `/collection` first renders,
  - **Then** the number of card tiles in the DOM is at most the batch size B, where B is a constant exported from `src/lib/**` and 1 ≤ B ≤ 200,
  - **And** a **Show more** button is visible after the last tile.
- **AC-10** *(more tiles on scroll and on tap)*
  - **Given** AC-9's state,
  - **When** I scroll to the bottom, **Then** the tile count grows past B.
  - **When** I tap **Show more**, **Then** the tile count grows by up to B.
  - **When** every match is rendered, **Then** **Show more** is not present.
- **AC-11** *(filters run over the full list)*
  - **Given** the 1,250-row fixture where only the last row is foil,
  - **When** I tap the "Foil" chip before scrolling,
  - **Then** exactly 1 tile is shown and **Show more** is absent.
- **AC-12** *(batch resets on filter change)*
  - **Given** I've loaded more than B tiles,
  - **When** I change the search text, chip or sort,
  - **Then** at most B tiles are rendered.
- **AC-13** *(small collections unchanged)*
  - **Given** a collection with B or fewer rows,
  - **Then** all tiles render immediately, **Show more** is never shown, and the existing `seeded-data.spec.ts` assertions and screenshot baselines pass unchanged.
- **AC-14** *(batching logic, Vitest)*
  - A pure helper takes `(totalMatches, batchesShown)` and returns the visible count and whether more remain.
  - Cases: 0 matches; exactly B; B+1; 3B−1.

**Errors and empty states**
- **AC-15** *(load error is not an empty collection, Vitest)*
  - **Given** the reader returns an error,
  - **When** `/collection`'s data-to-view mapping runs,
  - **Then** the result is the error state, not the "No cards yet" empty state.
  - Test this on a pure mapping function, because server-side Supabase calls can't be intercepted from Playwright.
- **AC-16** *(error UI)*
  - **Given** the error state on `/collection`, **Then** the page shows "Couldn't load your collection" and a **Try again** control that reloads the page.
  - **Given** the error state on `/trades/[username]` or `/u/[username]`, **Then** those pages show an equivalent message instead of match results or an empty grid.
  - Covered by a Vitest render test of the error component.
- **AC-17** *(empty collection unchanged)*
  - **Given** I have no collection rows,
  - **When** I open `/collection`,
  - **Then** the existing import empty state shows, and no **Show more** button or error message appears.

**Privacy (unchanged behaviour, regression)**
- **AC-18**
  - **Given** user B is not A's friend and A's visibility is `friends`,
  - **When** B opens `/u/A`,
  - **Then** no collection rows load and no **Show more** button appears.
  - The existing `trade-flags-rls.serial.spec.ts` AC-27 (stranger rows = 0) still passes.
- **AC-19**
  - The shared reader always filters by the target `user_id`. A Vitest test asserts that it passes the given user id to every page request. This matters because RLS alone would also return friends' and public rows.

## Data & privacy
- **No schema, RLS or migration change.** The `collection_items` select policies (owner / accepted friends / anyone when `collection_visibility = 'public'`) are unchanged. Each paged request runs under the viewer's session, so RLS applies to every page.
- **Same data, more of it.** The columns each page selects are unchanged. The client now gets all of a user's rows instead of the first 1,000. For `/collection` and `/trades/[username]`, those rows are already readable by that viewer. No new fields are exposed, purchase prices are still not stored (§5.3), and friends-only stays the default.
- **Payload size.** A 3,000-row collection is roughly 1 MB of RSC payload (estimate from the #6 technical design). This is accepted for v1 (see Q2).

## UX notes
- **`/collection`** (`CollectionView` → `CollectionGrid`):
  - **Show more** button below the grid: full width, at least 44px tall (§5.2), styled like the existing secondary buttons.
  - Batches append without a full-page spinner.
  - The search/chip/sort controls and the "No cards match your filters." message are unchanged.
- **`/u/[username]`:** gets the same grid behaviour automatically, because it uses `CollectionGrid`.
- **`/trades/[username]`:** no visual change apart from more complete results and the error state.
- **States:**
  - *Loading:* the existing `collection/loading.tsx` skeleton. A larger collection means a longer wait, with no new UI.
  - *Empty:* unchanged (AC-17).
  - *Error:* new inline message with **Try again** (AC-16).
  - *Partial:* never shown (AC-4, AC-15).

## Open questions
1. **Raise `max_rows` instead of paging?**
   - It's one config change, but it's a project-wide setting. It has to be changed by hand on staging and production, and it still leaves a cap.
   - **Recommended:** page in code and leave `max_rows` at 1000.
2. **Very large collections (for example 20,000+ rows).**
   - Fetching everything up front means about 20 sequential requests and a payload of several MB.
   - **Recommended:** accept this for v1 with no hard cap. Revisit with server-side search and paging if real users report slow loads.
   - Alternative: stop at a limit (for example 10,000 rows) and show a "Showing first 10,000" notice. That brings back a known, labelled truncation.
3. **Progressive rendering for Trade Match sections.**
   - In fallback mode with an empty wishlist, "They have, you want" can list thousands of tiles.
   - **Recommended:** out of scope here. Open a follow-up issue to reuse the same batching component in `MatchSection`.
4. **Other 1,000-row caps.**
   - The import route's `cards` cache lookups can also hit the cap, and its `.in(...)` lists of several thousand ids may also exceed URL limits. The result is extra Scryfall calls during import, not missing data.
   - **Recommended:** open a separate issue. Don't fold it in here, because it touches the import path that PRD §5.1 has a 5-second budget for.
5. **Consistency when a re-import happens mid-load.**
   - `replace_collection_items` deletes and re-inserts with new ids. A paged read that overlaps a re-import could mix old and new rows.
   - **Recommended:** accept this for v1. The window is milliseconds, and a reload fixes it.
   - Alternative: read everything through a single RPC or snapshot. That needs a migration, which this issue says it doesn't expect.
6. **Dependency on #11 / PR #15.**
   - The summary isn't on this branch yet.
   - **Recommended:** build this independently. AC-6 applies only if #11 has merged first. If #16 lands first, #11's E2E should add the same large-fixture check.

## Decisions (spec gate, 2026-10-13)
Owner replied `approve` with no changes. Recommended defaults accepted for all open questions:
Q1 page in code, leave `max_rows`; Q2 no hard cap in v1; Q3 Trade Match batching out of scope (follow-up issue); Q4 import-route caps are a separate issue; Q5 accept mid-load re-import window; Q6 build independently of #11 (AC-6 only if #11 has merged).

## Design
Mockup: [mockup.html](16-load-full-collections/mockup.html) · screenshot: [mockup.png](16-load-full-collections/mockup.png) (390px wide, one captioned frame per state). Reuses existing tokens, chip/sort controls, tile and secondary-button styles. The only new UI is the **Show more** button and the error block.

| # | State | ACs |
|---|-------|-----|
| 1 | `/collection` first render, 2,400 rows: capped tiles, full-width **Show more** (48px) with "showing X of Y" hint | AC-9, AC-6 |
| 2 | After scroll or tap: more tiles appended, no spinner, button remains | AC-10 |
| 3 | All matches rendered: button gone, "All N cards shown" note | AC-10 |
| 4 | Search "Ragavan" finds a row beyond the first batch; batch resets | AC-5, AC-12 |
| 5 | Foil chip: 1 tile, no Show more | AC-11 |
| 6 | Small collection: identical to today | AC-13 |
| 7 | Loading: existing skeleton | (unchanged) |
| 8 | Empty: existing import empty state | AC-17 |
| 9 | `/collection` error: "Couldn't load your collection" + **Try again** | AC-4, AC-15, AC-16 |
| 10 | `/trades/[username]` error replaces match results | AC-16 |
| 11 | `/u/[username]`: same grid and Show more; error variant | AC-8, AC-16 |
| 12 | Non-friend, friends-only: existing lock state, no rows, no Show more | AC-18 |

Design decisions (not in the spec, so recorded here):
- The "showing X of Y" hint on Show more and the "All N cards shown" end note are optional additions. Drop them if you prefer the plainest button.
- Error block copy on trades/profile names the other user ("Couldn't load maya's collection").
