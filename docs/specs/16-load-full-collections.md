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

## Technical design

Guides read: `01-getting-started/06-fetching-data.md`, `10-error-handling.md` ("model expected errors as return values" rather than throwing to `error.tsx`), `03-api-reference/04-functions/use-router.md`. `next.config.ts` has no `cacheComponents`, and all three pages are already dynamic (`cookies()` through the Supabase server client), so nothing about caching or routing changes. No new routes, route handlers, server actions or `proxy.ts` changes.

### Changes
| File | Change |
|------|--------|
| `src/lib/collection/read.ts` (new) | Pure keyset paging loop `readAllPages`, `COLLECTION_PAGE_SIZE = 1000`, `ReadResult<T>` type, and `collectionPageState` (the result-to-view mapping for AC-15). No Supabase import. |
| `src/lib/collection/queries.ts` (new) | `getCollectionItems<T>(supabase, userId, columns)`: the shared reader. It binds `readAllPages` to `collection_items` with `.eq("user_id", userId)`, `.gt("id", afterId)`, `.order("id")` and `.limit(pageSize)`. It sits next to `wishlist/queries.ts` and `friends/queries.ts`. |
| `src/lib/collection/batches.ts` (new) | `RENDER_BATCH_SIZE = 60` (20 rows of the 3-column grid) and the pure `batchWindow(totalMatches, batchesShown)` helper. |
| `src/components/collection/CollectionLoadError.tsx` (new) | Client component: an inline error block with a `title` prop, fixed body copy, and a **Try again** button that calls `window.location.reload()`. |
| `src/components/collection/CollectionGrid.tsx` | Adds `batchesShown` state. Renders `matches.slice(0, visibleCount)`. Adds a sentinel with an IntersectionObserver, a **Show more** button and a "Showing X of Y" hint. Search, chip and sort handlers reset the state to batch 1. Filter and sort logic is unchanged. |
| `src/app/(main)/collection/page.tsx` | Replaces the inline query with `getCollectionItems`. Renders `CollectionLoadError` ("Couldn't load your collection") on error. The `select` columns are unchanged. |
| `src/app/(main)/trades/[username]/page.tsx` | Deletes `fetchCollectionByUser`. Both sides use `getCollectionItems<CollectionItemWithOracle>` inside the existing `Promise.all`. If either side fails, the offer line and the three `MatchSection`s are replaced by `CollectionLoadError`. The back link and friend header stay. |
| `src/app/(main)/u/[username]/page.tsx` | Replaces the inline query with `getCollectionItems`. This still runs only when `canViewCollection`. On error, `CollectionLoadError` ("Couldn't load {display_name}'s collection") takes the grid's place. The wishlist section is unchanged. |
| `tests/unit/collection-read.test.ts` (new) | AC-1 to AC-4, AC-15, AC-19 |
| `tests/unit/collection-batches.test.ts` (new) | AC-14 |
| `tests/unit/collection-readers-wiring.test.ts` (new) | AC-8 (source-level assertion), AC-16 (static render of `CollectionLoadError`) |
| `tests/e2e/authed/large-collection.serial.spec.ts` (new) | AC-5, AC-7, AC-9 to AC-12, AC-17, AC-18 (UI part) |
| `vitest.config.ts` | Only if needed: `esbuild: { jsx: "automatic" }`. Vite should already pick up `"jsx": "react-jsx"` from `tsconfig.json` when a `.ts` test imports a `.tsx` component. Add this only if the AC-16 test fails to transform. |

Untouched: `CollectionView.tsx` (it already passes `items` through), `src/lib/trades/match.ts`, `scripts/seed-staging.ts`, `tests/e2e/supabase.ts`, `supabase/config.toml`, `loading.tsx`.

### Schema
**No migration.** RLS policies, columns and indexes are unchanged. Every page request runs under the viewer's session through the existing `createClient()` (never the admin client), so the `collection_items` select policies apply to each page exactly as they do today.

A composite `(user_id, id)` index would make each keyset page an index range scan. It is not needed at realistic sizes (see Risks), and the spec rules out migrations, so it is left as a follow-up.

### Data flow
- **Reader (server only).** `readAllPages(fetchPage, pageSize)`:
  1. Starts with `afterId = null`.
  2. Each call does `fetchPage(afterId, pageSize)`, which returns `{ data, error }` in the PostgREST shape.
  3. If `error` is set or `data` is null, it returns `{ ok: false, error: message }` and discards the rows read so far (AC-4).
  4. Otherwise it appends the rows. If `data.length < pageSize` it stops (this covers empty, short, and the trailing empty page after an exact multiple, AC-2 and AC-3). If not, it sets `afterId = data.at(-1).id` and loops.
  5. Guard: if a page's last `id` is not greater than `afterId`, it returns an error instead of looping forever.

  It returns `{ ok: true, rows }`.

  Keyset paging (`id > afterId`) is used instead of `.range()` offsets. There is no OFFSET cost, and each page is disjoint by construction, which gives AC-1's "no duplicates".
- **Page size and `max_rows`.** `COLLECTION_PAGE_SIZE = 1000` must be **less than or equal to** PostgREST `max_rows`, because the loop's stop condition is "short page". Add a comment at the constant explaining this.
- **Binding.** `getCollectionItems<T extends { id: number }>(supabase: SupabaseClient, userId: string, columns: string): Promise<ReadResult<T>>`:
  - It always applies `.eq("user_id", userId)` (AC-19). RLS alone would also return friends' and public rows.
  - Each page keeps its existing column string, passed as `columns`. Typing uses `.returns<T[]>()`, consistent with the current code.
  - On error it logs `console.error("collection read failed", { userId, message })` on the server only.
- **`/collection` (server component).** `getUser` → `getCollectionItems<CollectionItem>` → `collectionPageState(result)`:
  - `{ kind: "error" }` renders the page padding wrapper with an `h1` "Collection" and `CollectionLoadError`.
  - `{ kind: "ready", items }` renders `<CollectionView initialItems={items} />` as today.
  - The empty collection still flows through `CollectionGrid`'s `emptyState` (AC-17). If #11 has merged, its summary runs over `items`, which is now complete (AC-6), with no logic change.
- **`/trades/[username]` (server component).** The friendship check is unchanged. Then `Promise.all([getCollectionItems(viewer), getCollectionItems(friend), getWishlistItems×2])`.
  - If either collection result is `!ok`, render `CollectionLoadError`. Use "Couldn't load your collection" when the viewer's read failed, otherwise "Couldn't load {display_name}'s collection".
  - Otherwise `computeTradeMatches` runs over the full arrays, unchanged.
  - Only the computed `CardSummary` lists go to HTML. Raw rows are never sent to the client here.
- **`/u/[username]` (server component).** Same pattern as `/collection`, behind the existing `canViewCollection` gate. With no access, no read is issued (AC-18).
- **`CollectionGrid` (client).**
  - `const matches = useMemo(filter + sort over all items)`: the existing `visibleItems`, renamed for clarity.
  - `const [batchesShown, setBatchesShown] = useState(1)`, then `const { visibleCount, hasMore } = batchWindow(matches.length, batchesShown)`.
  - The search `onChange`, chip `onClick` and sort `onChange` each call `setBatchesShown(1)` along with their own setter. This happens in the event handlers, not in an effect (AC-12).
  - A change to `items` (for example a trade-flag override from `CollectionView`) does **not** reset the batch, so tapping a tile deep in the list doesn't collapse it.
  - **Load on scroll:** when `hasMore`, render `<div ref={sentinelRef} aria-hidden />` after the grid. A `useEffect` keyed on `[hasMore, batchesShown]` creates an `IntersectionObserver` with `rootMargin: "0px 0px 400px 0px"`, and calls `setBatchesShown(b => b + 1)` when the sentinel intersects. It disconnects on cleanup. Re-creating the observer after each batch re-checks a sentinel that is still in view.
  - If `IntersectionObserver` is undefined, the button alone handles loading.
  - **Show more:** when `hasMore`, render a `<button type="button">Show more</button>`. It is full width, `min-h-12`, in the existing secondary style (`rounded-[--radius-btn] border border-border bg-elevated text-sm font-semibold text-text-secondary`), with a small "Showing {visibleCount} of {matches.length}" line above it. The button's accessible name stays exactly "Show more".
  - The "All N cards shown" end note from the mockup is dropped, so small collections stay pixel-identical (AC-13).
  - "No cards match your filters." is unchanged.
- **`CollectionLoadError` (client, `"use client"`).**
  - `role="alert"` block with the elevated card styling, the title, and the body "Something went wrong loading cards. Nothing was changed."
  - A **Try again** button (`min-h-11`, secondary style) calls `window.location.reload()`. This matches the spec's "reloads the page" literally. It also avoids `useRouter`, which would throw outside an app-router tree and block the static render test.

### Logic placement
- Pure, unit-tested logic:
  - `src/lib/collection/read.ts`: `readAllPages`, `collectionPageState`, `COLLECTION_PAGE_SIZE`.
  - `src/lib/collection/batches.ts`: `batchWindow`, `RENDER_BATCH_SIZE`.
- Thin Supabase binding: `src/lib/collection/queries.ts`. It is unit-tested with a recording fake query builder.
- Pages only call the reader, branch on the result and render. `computeTradeMatches` and the filter/sort code are unchanged.

`batchWindow(total, batchesShown, size = RENDER_BATCH_SIZE)` returns `{ visibleCount: Math.min(total, batchesShown * size), hasMore: total > batchesShown * size }`.

### Test plan
**Vitest** (`tests/unit/*.test.ts`, node env):

| AC | Test |
|----|------|
| AC-1 | Fake keyset fetcher over 2,345 rows, at most 1,000 per call → 2,345 rows, ascending ids, `new Set(ids).size === 2345`, 3 calls. |
| AC-2 | 2,000 rows → 2,000 rows, exactly 3 calls (1,000 / 1,000 / 0). |
| AC-3 | 0 rows → `[]`, 1 call. 7 rows → 7 rows, 1 call. |
| AC-4 | Page 1 ok, page 2 `{ data: null, error }` → `{ ok: false }`, and no rows are exposed. Extra case: a non-advancing fetcher (same page twice) → `{ ok: false }`, and the loop terminates. |
| AC-15 | `collectionPageState({ ok: false })` → `{ kind: "error" }`. `({ ok: true, rows: [] })` → `{ kind: "ready", items: [] }` (empty is not an error). |
| AC-19 | Fake chainable client records `from`, `select`, `eq`, `gt`, `order` and `limit` per page. Over a 3-page run, every page has `from("collection_items")`, `eq("user_id", <given id>)` and `order("id")`. Page 1 has no `gt`, and pages 2+ have `gt("id", lastIdOfPreviousPage)`. The `columns` string is passed through unchanged. |
| AC-14 | `batchWindow`: (0,1) → {0,false}. (B,1) → {B,false}. (B+1,1) → {B,true}. (B+1,2) → {B+1,false}. (3B−1,2) → {2B,true}. (3B−1,3) → {3B−1,false}. Also asserts `1 <= RENDER_BATCH_SIZE <= 200`. |
| AC-8 | Reads the three page files with `fs`. Asserts none contains `from("collection_items")` and each contains `getCollectionItems(`. |
| AC-16 | `renderToStaticMarkup(createElement(CollectionLoadError, { title: "Couldn't load your collection" }))` contains the title, `role="alert"`, and a `<button` with "Try again". The apostrophe is escaped as `&#x27;`, so the test asserts on the escaped form or decodes it first. The trades and `/u` variants are the same component with a different title, so one more render covers "Couldn't load E2E Friend's collection". |

**Playwright** (`tests/e2e/authed/large-collection.serial.spec.ts`, `authed-serial` project). It snapshots in `beforeAll` and restores in `afterAll`, like `trade-flags.serial.spec.ts`.

- **Fixture `big`:** 1,250 rows built in a loop through `setCollection`:
  - Rows 1 to 1,248: `CARDS.solRing`, nonfoil, binder `Bulk 0001`…`Bulk 1248`.
  - Row 1,249: `CARDS.swords`, nonfoil, `Bulk 1249`.
  - Row 1,250: `CARDS.cultivate`, **foil**, `Bulk 1250`.
  - All rows have quantity 1 and no flags.
- **Precondition, run once after `setCollection`:** `replace_collection_items` does not guarantee insert order. With the E2E client, look up the `id`s of the Swords and Cultivate rows. Assert `count(id < thatId) >= 1000` with `select("id", { count: "exact", head: true }).eq("user_id", userId).lt("id", id)`. This proves both rows sit past the old cap.
- **Tile locator:** `page.getByRole("button", { name: /, Bulk \d{4}$/ })`, the same overlay-button pattern as `anyTile` in the existing spec.

| AC | E2E check |
|----|-----------|
| AC-5 | `big` fixture, `/collection`, fill search "Cultivate" → exactly 1 tile named "Cultivate, Bulk 1250". |
| AC-6 | Only if #11 has merged on the branch: the summary total reads "1,250". If not, leave it as a `test.skip` with a reason. |
| AC-7 | `big` fixture, `/trades/e2e_friend` → heading "They have, you want (0)" and no `img` "Swords to Plowshares" in that section. The seeded friend offers only Swords (opt-in), and the seeded player wishlists it any-printing. Before the fix, this showed (1). |
| AC-9 | `big` fixture, `/collection` → tile count `<= RENDER_BATCH_SIZE` (imported from `src/lib/collection/batches`), and "Show more" is visible. |
| AC-10 | Scroll with `window.scrollTo(0, document.body.scrollHeight)` → poll until tile count > B. Record n, then trigger **Show more** with `locator.dispatchEvent("click")`, so Playwright's scroll-into-view doesn't also fire the observer → count is `<= n + B` and `> n`. Keep dispatching until "Show more" has count 0 → tile count is 1,250. |
| AC-11 | `big` fixture, fresh load, tap "Foil" chip → 1 tile, and "Show more" has count 0. |
| AC-12 | Load more than B tiles (one dispatched click). Then each of: change the search ("Sol"), tap a chip ("All" → "Red" → "All"), and change the sort select → tile count `<= B` after each. |
| AC-13 | Existing `seeded-data.spec.ts` (seeded collection has 4 rows) passes unchanged. Add one assertion there: "Show more" has count 0 on `/collection`. |
| AC-17 | `setCollection([])`, `/collection` → "No cards yet" visible. "Show more" and "Couldn't load" have count 0. |
| AC-18 | `/u/e2e_stranger` → "Only friends can see this collection" visible, and "Show more" has count 0. This can go in `seeded-data.spec.ts` since it is read-only. The existing `trade-flags-rls.serial.spec.ts` AC-27 stays as the row-level check. |

**Seed data:** no change to `scripts/seed-staging.ts`. The large fixture is written per-test through `setCollection`, which reuses the seeded cards with distinct binder names.

### Risks
1. **Silent truncation if `max_rows` drops below the page size.** The loop stops on a short page. If a project's `max_rows` were set below 1,000, every read would quietly stop after the first page, which is the same bug as today. Today both hosted projects and `config.toml` use 1,000. Mitigations:
   - A comment on `COLLECTION_PAGE_SIZE` that ties it to `max_rows`.
   - Never raise the constant without raising `max_rows`.
   
   (Lowering the constant is always safe.)
2. **Privacy: RLS is broader than the page.** The `collection_items` select policies let a viewer read friends' and public users' rows, so the `user_id` filter is what keeps each page to one user. It is enforced in the single binding and pinned by AC-19 for every page, not just the first. Nothing uses the admin client. `/u/[username]` still reads nothing unless `canViewCollection`. For public profiles, any signed-in user now receives every row rather than 1,000. These are the same columns and visibility as today, but the volume is larger.
3. **Query cost on large collections.** There is only a `user_id` index; there is no `(user_id, id)` index. Each keyset page scans the user's rows through `collection_items_user_id_idx` and does a top-N sort, and the RLS policy is evaluated per row (owner OR `are_friends` exists). The total work is roughly O(n²/1000):
   - About 3 pages and well under 100 ms of database time for 3,000 rows.
   - About 20 sequential round trips for 20,000 rows (accepted under Q2).
   
   Trade Match reads both users in parallel, but each user's pages are sequential. Follow-up, if needed: an additive `create index concurrently collection_items_user_id_id_idx on public.collection_items (user_id, id)` migration.
4. **Payload and client CPU.** `/collection` and `/u` serialize every row into the RSC payload (about 1 MB per 3,000 rows, accepted under Q2). Filter and sort re-run over the full array on each keystroke, which is fine at a few thousand rows. The DOM is capped at B·k tiles. Trade Match sends only computed summaries. Its sections are still unbatched (Q3, follow-up).
5. **Mid-load re-import (Q5, accepted).** `replace_collection_items` re-inserts with new, higher ids. A keyset read that overlaps it can return old page-1 rows followed by new rows, which double-counts some cards until the next reload. There are no duplicate ids, and the reader never loops.
6. **E2E fixture fragility.**
   - Insert order from `replace_collection_items` is not guaranteed, hence the precondition check.
   - `snapshotCollection` itself is still capped at 1,000 (out of scope). If a local run crashes after the fixture is written, the next run's snapshot of the 1,250 leftover rows would restore only 1,000. CI re-seeds staging before every E2E run, so this affects only local runs. Run `npm run seed:staging` locally to recover.
   - The observer could fire alongside a real tap, which is why the tap path in AC-10 and AC-12 uses `dispatchEvent`.
7. **Migration safety:** none (no schema change).
