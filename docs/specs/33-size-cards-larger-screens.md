# Size cards properly on larger screens
Issue: #33 · PRD refs: US-08, §4.4, §4.6, §4.7, §5.1, §5.2 · Status: Draft

## Problem
Every card grid in ManaPals is hard-coded to `grid grid-cols-3 gap-2.5`, with no breakpoints. On a phone (375–430px) that gives tiles about 108–130px wide, which works well. On wider screens the tiles keep growing with the viewport. At 768px each tile is about 240px wide. At 1440px it is about 465px wide, so roughly one row of three cards fills the screen. Browsing a collection of hundreds of cards on a tablet or laptop then means constant scrolling.

The tiles use Scryfall's `image_small` (146×204px), so on wide screens the images are also stretched well past their native size and look blurry.

PRD §4.4 makes the card grid the default view, and §5.2 keeps mobile as the main use case. The fix is for tiles to stay a sensible size while wider screens fit more columns. The mobile layout must not change.

Grids that exist today. They are all copies of the same pattern:

| Grid | File | Rendered on |
|------|------|-------------|
| Own / friend collection | `src/components/collection/CollectionGrid.tsx` (line 157) | `/collection` (via `CollectionView`), `/u/[username]` |
| Wishlist | `src/components/wishlist/WishlistGrid.tsx` (line 16) | `/wishlist`, `/u/[username]` (friends only) |
| Trade matches | `src/app/(main)/trades/[username]/page.tsx`, `MatchSection` (line 180) | `/trades/[username]`, three sections |
| Collection loading skeleton | `src/app/(main)/collection/loading.tsx` (line 18) | `/collection` while loading |

`src/app/(main)/profile/page.tsx` line 81 also uses `grid-cols-3`, but that is the stats row (Cards / Friends / Trades), not a card grid. It is out of scope.

## Users & scenario
Priya keeps her 900-card collection in ManaPals and mostly checks it on her phone at the game store.

1. On her phone (Pixel 7, 412px), `/collection` looks exactly as it does today: three columns of card tiles.
2. That evening she opens ManaPals on her iPad in portrait (768px) to plan trades. The collection grid now shows five columns of tiles. Each tile is under 200px wide, so about 15 cards fit on screen instead of about 6.
3. She opens her laptop (1440px), goes to `/trades/maya`, and sees all three match sections laid out in many columns, so she can scan "They have, you want" without scrolling.
4. She visits `/u/maya`. Maya's collection grid and her wishlist grid use the same column count and tile size as Priya's own pages.
5. She opens `/wishlist`. Same tile sizing, and the remove (×) buttons are the same size as on mobile.
6. She resizes the laptop window to phone width, and the grid goes back to three columns with no horizontal scrollbar.

## Scope
### In scope
- **Responsive column count for all four card grids** listed above. The column count goes up with viewport width, so each tile stays a sensible size:
  - **Below 640px:** exactly 3 columns with the current `gap-2.5` (10px). Tile size, gap, page padding, and all badges are identical to today, so the mobile layout does not change.
  - **640px to 1920px:** each tile is at most 200px wide. The column count never goes down as the viewport gets wider.
  - The exact breakpoint ladder or technique (Tailwind `sm:`/`md:`/`lg:` classes, `auto-fill`/`minmax`, a max tile width) is up to the architect. A proposed default is in Q1.
- **The same sizing on every grid.** All four grids (including the loading skeleton) must give the same column count and tile width at a given viewport. Today the class string is copied in four places. The architect should consider one shared grid wrapper or class constant so they can't drift apart. That is a suggestion, not a requirement.
- **Loading skeleton matches.** `collection/loading.tsx` uses the same column rules, so the skeleton doesn't jump in layout when the real grid appears.
- **No horizontal scroll** at any tested viewport ≥375px (§5.2).
- Tile contents stay the same: badges (quantity, foil/etched, Any, Available / Not for trade, price), the image `aspect-[5/7]`, the name fallback when there is no image, the tap-to-open trade sheet, and the wishlist remove button. Their sizes and positions inside the tile don't change.

### Out of scope
- Switching to `image_normal` or adding `srcset` on larger tiles for sharper images (Q3). This adds bandwidth and touches §5.1 performance.
- A maximum width or centred layout for the whole page (search box, chips, headers) on desktop. Only the card grids change (Q4).
- A list view (§4.4 "List view option"), a user density or zoom control, or a "cards per row" setting.
- Changing the render batch size (`RENDER_BATCH_SIZE = 60` in `src/lib/collection/batches.ts`) or the infinite-scroll behaviour (Q2).
- Redesigning the bottom nav or adding a sidebar or other desktop navigation.
- The profile stats row (`profile/page.tsx` line 81), which is not a card grid.
- Adding desktop or tablet Playwright projects, or new screenshot baselines (Q5).
- Changes to tile badges, typography, colours, or the trade sheet.
- Screens wider than 1920px. They must not scroll horizontally, but the tile-size cap is only guaranteed up to 1920px.

## Acceptance criteria
All of these are Playwright tests in `tests/e2e/authed/`, signed in as the seeded `e2e_player`. Each test sets the viewport with `page.setViewportSize`. Test viewports:
- **Mobile:** 375×800 and 412×915
- **Boundary:** 639×900
- **Larger:** 640×900, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080

"Column count" means the number of tracks in the grid's computed `grid-template-columns`. "Tile width" means a tile's `boundingBox().width`. Tests need a stable way to find each grid; the architect picks one (for example a `data-testid="card-grid"` or a labelled list). Seeded data is read-only.

The pages under test, and the seed data each relies on:
- `/collection`: e2e_player's 4 tiles.
- `/u/e2e_friend`: the friend's collection grid and wishlist grid. The friendship is seeded.
- `/wishlist`: e2e_player's seeded wishlist.
- `/trades/e2e_friend`: every match section has tiles, as already asserted in `seeded-data.spec.ts`.

**Mobile is unchanged**
- **AC-1** *(3 columns on phones)*
  - **Given** a viewport of 375, 412, or 639px wide,
  - **When** I open each page under test,
  - **Then** every card grid on the page has exactly 3 columns,
  - **And** the horizontal gap between adjacent tiles is 10px (±1).
- **AC-2** *(mobile tile size unchanged)*
  - **Given** a 375px viewport,
  - **When** I open `/collection`,
  - **Then** each tile is 107–109px wide (that is, (375 − 32 padding − 20 gaps) / 3 ≈ 107.7),
  - **And** at 412px each tile is 119–121px wide.
  - These are today's values. The test guards against regressions.
- **AC-3** *(touch targets kept)*
  - **Given** a 375px viewport on `/collection`,
  - **Then** each tile's tap button is at least 44×44px,
  - **And** the filter chips are still at least 44px tall.
  - **And Given** `/wishlist` at 375px, **Then** each remove button is the same size it is today.
  - This AC only checks that nothing regressed. It sets no new size requirement.

**Larger screens**
- **AC-4** *(tile width capped)*
  - **Given** any viewport from 640 to 1920px wide (640, 768, 1024, 1280, 1440, 1920),
  - **When** I open each page under test,
  - **Then** every tile in every card grid is at most 200px wide.
- **AC-5** *(tiles still legible)*
  - **Given** any test viewport,
  - **Then** every tile is at least 100px wide (§5.2 "legible at mobile scale").
- **AC-6** *(more columns as the screen widens)*
  - **Given** the test viewports in ascending order,
  - **When** I record the `/collection` grid's column count at each,
  - **Then** the sequence never decreases,
  - **And** it is at least 5 at 1024px and at least 7 at 1440px.
- **AC-7** *(every grid sized alike)*
  - **Given** any test viewport,
  - **When** I compare the collection grid on `/collection`, the collection and wishlist grids on `/u/e2e_friend`, the grid on `/wishlist`, and each match-section grid on `/trades/e2e_friend`,
  - **Then** they all report the same column count, and their tile widths are within 1px of each other.
- **AC-8** *(loading skeleton matches)*
  - **Given** viewports of 375 and 1280px,
  - **When** the `/collection` loading skeleton renders (found by `aria-label="Loading collection"`),
  - **Then** its grid has the same column count as the real collection grid at that viewport.
  - This can be a direct render of `loading.tsx` in a component test, or a Playwright test that delays the route, whichever is easier to make reliable.
- **AC-9** *(tile shape preserved)*
  - **Given** any test viewport,
  - **Then** every tile's height ÷ width is 1.4 (±0.02), which is the 5:7 ratio.

**Layout safety**
- **AC-10** *(no horizontal scroll)*
  - **Given** any test viewport,
  - **When** I open each page under test,
  - **Then** `document.documentElement.scrollWidth <= window.innerWidth`.
- **AC-11** *(badges and overlays still there)*
  - **Given** a 1280px viewport on `/collection`,
  - **Then** the foil badge on Lightning Bolt is visible inside its tile's bounding box,
  - **And** tapping the Sol Ring tile opens the card trade sheet, as it does on mobile.
  - **And Given** `/trades/e2e_friend` at 1280px, **Then** each price badge is visible inside its tile.

**Empty, error, and privacy states (unchanged)**
- **AC-12** *(empty and filtered states)*
  - **Given** a 1280px viewport on `/collection`,
  - **When** I search for "zzzz-no-match",
  - **Then** "No cards match your filters." is visible and there is no horizontal scroll.
  - **And Given** `/trades/e2e_friend` with a section that has no matches, **Then** its empty text still renders in place of the grid. This can be covered by a component test with an empty `cards` array.
- **AC-13** *(friends-only gate)*
  - **Given** a 1280px viewport,
  - **When** I open `/u/e2e_stranger`,
  - **Then** the "Only friends can see this collection" lock state is shown, and no card grid or wishlist grid is rendered, as today.
- **AC-14** *(existing tests still pass)*
  - **Given** the existing Playwright suite (Pixel 7 projects) and `tests/e2e/__screenshots__/linux/sign-in.png`,
  - **When** CI runs,
  - **Then** every existing test passes without regenerating any baseline.

## Data & privacy
- **Stored:** nothing. No migrations, no tables or columns, no RLS changes. This is presentation only.
- **Who sees what:** unchanged.
  - Friend collections and wishlists on `/u/[username]` are still friends-only by default (§5.3), and public when the owner set `collection_visibility = public`.
  - Trade matches are still only shown between friends.
  - The responsive layout must not render any grid on a page that doesn't render one today. AC-13 guards this.
- **Network:** the same image URLs (`image_small`, falling back to `image_normal`) and the same `loading="lazy"`.
  - On wide screens more tiles are on screen at once, so the first screen loads more lazy images.
  - Batching (60 tiles per render batch) is unchanged, so the DOM size is still bounded.

## UX notes
- **Screens touched:**
  - `/collection` and its loading skeleton
  - `/u/[username]` (collection grid and wishlist grid)
  - `/wishlist`
  - `/trades/[username]` (all three match sections)
- **Screens not touched:** `/profile` and `/trades` (the friend list). They have no card grids.
- **Mobile (<640px):** pixel-identical card grids. The only screenshot baseline today is `sign-in.png`, so AC-1 and AC-2 hold mobile in place instead of a baseline.
- **Tablet and desktop:**
  - The grid fills the page width, inside the existing `px-4` padding, with more columns.
  - The header, search box, chips, and sort select keep their current full-width behaviour (see Q4).
  - The bottom nav is unchanged.
- **States:**
  - *Empty collection / wishlist / match section:* existing empty states, unchanged.
  - *Filters match nothing:* existing "No cards match your filters." text.
  - *Loading:* the skeleton uses the same column rules (AC-8).
  - *Load error:* `CollectionLoadError` is unchanged.
  - *"Show more" / "Showing N of M":* unchanged, full width under the grid.
- **Touch targets:** tiles only get bigger than on mobile, or stay the same. Chips, the sort select, and the remove buttons are unchanged (§5.2, 44px minimum).

## Open questions
1. **Which column ladder?** **Recommended default:** Tailwind v4 default breakpoints with explicit counts:

   | Viewport | Columns | Approx. tile width |
   |----------|---------|--------------------|
   | <640px | 3 | 108–195px |
   | `sm` ≥640 | 4 | 145–176px |
   | `md` ≥768 | 5 | 139–190px |
   | `lg` ≥1024 | 6 | 157–200px |
   | `xl` ≥1280 | 8 | 147–179px |
   | `2xl` ≥1536 | 10 | 141–180px at 1920 |

   This satisfies AC-4 through AC-6, and it's easy to read and to keep identical across grids.
   - **Alternative:** `grid-template-columns: repeat(auto-fill, minmax(…, 1fr))` above 640px. It adapts more smoothly, but it's harder to guarantee the exact mobile layout and the shared column count.
2. **Render batch size vs. column count.** `RENDER_BATCH_SIZE = 60` is commented as "20 rows of the 3-column grid". With 8 columns, a batch ends on a partial row (7.5 rows) before "Show more".
   - **Recommended:** leave the batch size alone and accept a partial last row. Only the comment needs updating. A partial row is normal at the end of any filtered grid anyway.
   - **Alternative:** use 10 columns at `xl`, so that every count in the ladder divides 60.
3. **Image resolution on bigger tiles.** At 140–200px CSS width (and more on high-DPI screens), the 146px `image_small` is upscaled.
   - **Recommended:** keep `image_small` for this issue. Capping tiles at 200px is already a big improvement over today's 240–465px stretch.
   - File a follow-up for `srcset` with `image_normal` on wide or high-DPI screens. That trades bandwidth against §5.1, so it deserves its own decision.
4. **Cap the whole page width on desktop?** At 1920px the search box and chips stretch across the full width.
   - **Recommended:** out of scope here. The issue asks only about card sizing and more columns, and capping the page (for example `max-w-6xl mx-auto`) would also reduce the column count.
   - Revisit it in a separate "desktop layout" issue together with the bottom nav.
5. **How to test larger viewports.** All Playwright projects use the Pixel 7 device.
   - **Recommended:** call `page.setViewportSize` inside new `tests/e2e/authed/` specs and check computed geometry (AC-1 to AC-12). Don't add desktop projects or screenshot baselines, because card images come from live Scryfall data and would make baselines flaky.
   - **Alternative:** add a desktop Chromium project, which roughly doubles E2E time.
6. **PRD alignment.** No conflict: §4.4 (grid default), §5.2 (mobile primary, no horizontal scroll, 44px, legible), and §5.1 (no new requests or bandwidth) are all respected. Nothing to resolve.

## Design
Mockup: [33-size-cards-larger-screens/mockup.html](33-size-cards-larger-screens/mockup.html) · Screenshot: [mockup.png](33-size-cards-larger-screens/mockup.png). Frames are drawn at true viewport width and reuse the app's tokens and tile markup.

| Screen / state | Shows | ACs |
|---|---|---|
| A. Mobile 375px | Unchanged: 3 columns, 10px gap, ~108px tiles, 44px chips, Show more | AC-1, AC-2, AC-3 |
| B. Tablet 768px | 5 columns (md), ~139px tiles | AC-4, AC-5, AC-6, AC-7, AC-9 |
| C. Desktop 1440px trades | 8 columns (xl) in match sections, price badges inside tiles, empty section shows text and no grid | AC-7, AC-11, AC-12 |
| D. Desktop 1440px collection | 8 columns, foil and quantity badges in place | AC-6, AC-11 |
| E. Loading skeleton 375 and 1280 | Same column counts as the real grid | AC-8 |

Not drawn (no visual change): the friends-only lock state (AC-13), the horizontal-scroll check (AC-10), and existing tests (AC-14). Design choices: the mockup follows the Q1 ladder (3/4/5/6/8/10) as recommended, and the page chrome stays full width (Q4).
