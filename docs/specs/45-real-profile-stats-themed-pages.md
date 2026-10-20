# Real Profile stats, plus themed not-found, error and loading pages
Issue: #45 · PRD refs: US-06, US-15, US-16, US-17, §4.4, §4.5, §4.6, §5.2, §5.3 · Status: Approved

## Problem
- **The Profile stats are fake.** The stats row on `/profile` hard-codes `{ label: "Cards", value: "0" }` and `{ label: "Trades", value: "0" }` (`src/app/(main)/profile/page.tsx:83-85`). Only the Friends tile is real. The seeded `e2e_player` owns 5 cards but sees "0 Cards". Wrong numbers on your own profile make the rest of the app look untrustworthy.
- **Unknown usernames show a white page.** `/u/[username]` and `/trades/[username]` already call `notFound()` when the profile doesn't exist. There is no `not-found.tsx` anywhere, so Next.js shows its stock 404, which looks out of place inside the dark app.
- **Some routes have no error or loading state.** Nothing under `(main)` has an `error.tsx`, so an unexpected server error shows Next's default error screen. Only `/collection` has a `loading.tsx`. Wishlist, Trades and Profile show nothing while their server data loads, which on a phone over LTE looks like the tap didn't work.

## Users & scenario
Priya is on her phone at game night.

1. She taps **Profile**. While the page loads, she sees a pulsing skeleton shaped like the avatar, the three stat tiles and the sections below them, instead of a blank screen.
2. The page loads. The tiles read **"212 Cards"**, **"3 Friends"** and **"14 Trades"**. She taps **Cards** and lands on `/collection`.
3. A friend tells her to look up "@jonnymtg", but she types `/u/jonymtg`. Instead of a white "404", she sees the dark ManaPals screen with the header and bottom nav still in place. It says **"No ManaPal here"** and "We couldn't find that username. Check the spelling, or find your friend from Profile." She taps the amber **Find a friend** button and lands on `/profile`, where the Find a Friend search box is.
4. Later, Supabase has a brief outage and `/wishlist` throws while loading. She sees a dark card that says the page couldn't load and that nothing was changed, with a **Try again** button. When she taps it after the outage clears, the wishlist loads.

## Scope
### In scope
**1. Real Profile stats** (`src/app/(main)/profile/page.tsx`)
- **Cards tile:** the signed-in user's total card count. This is the same number as `totalCards` in the `/collection` summary: the sum of `quantity` over all of the user's `collection_items` rows, read in full past the 1,000-row cap. Reuse `getCollectionItems` (`src/lib/collection/queries.ts`) and `summarizeCollection` (`src/lib/collection/summary.ts`); do not add a second counting rule. Format the number with the same `en-US` grouping (`1,214`).
- **Cards tile is a link** to `/collection`, with a touch target of at least 44px.
- **Trades tile:** the signed-in user's trade-match count, summed over all accepted friends.
  - For each friend, the count is the number of cards listed under "You have, they want" plus the number under "They have, you want", exactly as `computeTradeMatches` (`src/lib/trades/match.ts`) returns them for `/trades/<friend>`.
  - "You both have extras" is not counted. That section shows cards both people own spares of, not cards someone wants. See Q1.
  - Seeded `e2e_player` with friend `e2e_friend`: Arcane Signet + Swords to Plowshares = **2**. `e2e_stranger` is not a friend and is never counted.
  - The count logic is a pure function in `src/lib/` (for example, a `countTradeMatches` helper next to `computeTradeMatches`) with Vitest tests. The page only fetches the data and renders the result.
- **When stats fail to load:** if the user's own collection read fails (`getCollectionItems` returns `ok: false`), the Cards tile shows "—" instead of a number. If any friend's collection or wishlist read fails, the Trades tile shows "—". A wrong "0" is never shown in place of an unknown value. The rest of the Profile page still renders.
- The Friends tile is unchanged.

**2. Themed not-found page** (`src/app/(main)/not-found.tsx`, new)
- This page renders whenever a `(main)` route calls `notFound()`. Today that is `/u/[username]` and `/trades/[username]` when the username doesn't exist.
- It renders inside `(main)/layout.tsx`, so the ManaPals header and bottom nav stay visible. It uses the existing dark theme tokens (`bg-elevated`, `border-border`, `text-text-primary`, `text-text-secondary`).
- Copy, in a plain tone with no joke:
  - Heading: **"No ManaPal here"**
  - Body: **"We couldn't find that username. Check the spelling, or find your friend from Profile."**
  - Button: an amber (`bg-amber text-page`) link at least 44px tall that reads **"Find a friend"** and goes to `/profile`.

**3. Themed error page** (`src/app/(main)/error.tsx`, new, Client Component)
- This page catches unexpected errors thrown while rendering any `(main)` page: Collection, Wishlist, Trades, Trade Match, `/u/…` and Profile. It renders inside `(main)/layout.tsx`, so the header and bottom nav stay. Per the Next 16 docs, `error.tsx` does not wrap the layout in its own segment.
- Copy:
  - Heading: **"Something went wrong"**
  - Body: **"This page couldn't load. Nothing was changed."** This claim is true today because every server action in `src/lib/*/actions.ts` returns errors instead of throwing, so the boundary only sees read and render failures. See Q3.
  - Button: **"Try again"**, at least 44px tall.
- **Try again** re-fetches and re-renders the segment. In this Next.js version that is the `unstable_retry()` prop (added in v16.2). `reset()` only re-renders and does not re-fetch, so a failed data load would fail again. The issue says `reset()`; see Q2.
- The page logs the error with `console.error`. It never shows `error.message`, stack traces or the `digest` to the user.
- Visual style matches `CollectionLoadError`.

**4. Loading skeletons** (new `loading.tsx` in `wishlist/`, `trades/` and `profile/`)
- Each skeleton follows the pattern in `collection/loading.tsx`:
  - The root element has `aria-busy="true"` and a distinct `aria-label`: "Loading wishlist", "Loading trades" or "Loading profile".
  - Pulse with `motion-safe:animate-pulse`, so users with reduced motion get a still skeleton.
  - Placeholder blocks use `bg-elevated` and roughly match the page's real layout.
- **Profile skeleton:** a 64px avatar circle with two text bars, three stat tiles, then section bars.
- **Trades skeleton:** title and subtitle bars, then three or four friend-row bars.
- **Wishlist skeleton:** title bar with a button-sized block on the right, then a card grid. Reuse `CardGrid` the same way `collection/loading.tsx` does.
- `collection/loading.tsx` switches from `animate-pulse` to `motion-safe:animate-pulse`, so all four skeletons behave the same. This is a one-word change; see Q4.
- `trades/loading.tsx` also covers navigation into `/trades/[username]`, because that route is nested under `trades/`. A dedicated Trade Match skeleton is out of scope.

### Out of scope
- **A root `app/not-found.tsx` or `global-not-found.js`** for URLs that match no route at all (for example `/nonsense`). Those render outside `(main)/layout.tsx` and need their own design. See Q5.
- `global-error.tsx` for errors in the root layout.
- Changing the existing in-page `CollectionLoadError` cards on `/collection`, `/u/…` and `/trades/…`. They handle failed collection reads without throwing, and they stay as they are.
- A separate skeleton for `/trades/[username]` or `/u/[username]`.
- Making the Trades or Friends tiles links. Only Cards links, as the issue asks. See Q6.
- Caching or precomputing trade-match counts (a counts table, materialized view or RPC). This feature has no schema changes.
- New stat tiles such as Wishlist count or collection value, and per-friend match counts on `/trades`.
- Showing these stats to other users on `/u/[username]`. The stats are for the owner only.
- A test-only route or flag that throws on purpose so the error page can be tested end to end (see Q7).
- Error reporting to an external service such as Sentry.
- Changing the redirect behavior on `/trades/<existing non-friend>`, which still redirects to `/trades`.

## Acceptance criteria
"Unit" means Vitest. "E2E" means Playwright at the mobile viewport, signed in as the seeded `e2e_player` (`tests/e2e/authed/`), unless stated otherwise.

**Profile stats**
- **AC-1** *(trade-match count logic, Unit)*
  - **Given** two friends. Friend A yields 1 "You have, they want", 1 "They have, you want" and 1 "You both have extras". Friend B yields 0, 2 and 0.
  - **When** the trade-match count is computed,
  - **Then** it equals `4`. "Both have extras" is not counted.
  - **And Given** no friends, **Then** it equals `0`.
- **AC-2** *(unknown count, Unit)*
  - **Given** one friend whose collection read returned `ok: false`,
  - **When** the count is computed,
  - **Then** the result is "unavailable" (for example `null`), not `0`.
- **AC-3** *(real Cards count, E2E)*
  - **Given** I'm `e2e_player`, whose seeded collection is Sol Ring ×2, Arcane Signet, Lightning Bolt (foil) and Counterspell,
  - **When** I open `/profile`,
  - **Then** the Cards tile shows "5", and does not show "0".
- **AC-4** *(real Trades count, E2E)*
  - **Given** I'm `e2e_player`, friends with `e2e_friend` only,
  - **When** I open `/profile`,
  - **Then** the Trades tile shows "2" (Arcane Signet + Swords to Plowshares) and the Friends tile shows "1".
- **AC-5** *(Cards tile links to Collection, E2E)*
  - **Given** I'm on `/profile`,
  - **When** I tap the Cards tile,
  - **Then** I land on `/collection`,
  - **And** the tile's bounding box is at least 44px tall.
- **AC-6** *(empty collection, E2E serial, snapshot and restore like `collection-summary.serial.spec.ts`)*
  - **Given** I have no collection rows,
  - **When** I open `/profile`,
  - **Then** the Cards tile shows "0" and the page renders without error.
- **AC-7** *(failed read shows "—", Unit render test of the stats row)*
  - **Given** the cards value is unavailable and the trades value is unavailable,
  - **When** the stats row renders,
  - **Then** both tiles show "—", and neither shows "0".
- **AC-8** *(own data only, E2E)*
  - **Given** `e2e_friend` owns more cards than I do,
  - **When** I open `/profile`,
  - **Then** the Cards tile shows my count ("5"), not my friend's or a combined total.

**Not-found page**
- **AC-9** *(unknown profile, E2E)*
  - **Given** I'm signed in,
  - **When** I open `/u/no_such_user`,
  - **Then** I see the heading "No ManaPal here" and the body text "We couldn't find that username. Check the spelling, or find your friend from Profile.",
  - **And** the ManaPals header and the bottom nav are visible,
  - **And** the page does not contain Next's default text "This page could not be found",
  - **And** the computed `background-color` of `body` is not white (`rgb(255, 255, 255)`).
- **AC-10** *(Find a friend link, E2E)*
  - **Given** I'm on the not-found page from AC-9,
  - **When** I tap the "Find a friend" link,
  - **Then** I land on `/profile` and the "Find a Friend" section is visible,
  - **And** the link's bounding box is at least 44px tall.
- **AC-11** *(unknown Trade Match, E2E)*
  - **Given** I'm signed in,
  - **When** I open `/trades/no_such_user`,
  - **Then** I see the same "No ManaPal here" page.
- **AC-12** *(signed out, E2E, unauthenticated project)*
  - **Given** I'm signed out,
  - **When** I open `/u/no_such_user`,
  - **Then** I'm redirected to `/sign-in`, as today. Signed-out visitors can't probe which usernames exist.

**Error page**
- **AC-13** *(themed error UI, Unit render test of `(main)/error.tsx`)*
  - **Given** the error component is rendered with `error = new Error("db exploded: secret")`,
  - **Then** the markup contains "Something went wrong", "Nothing was changed" and a `<button>` named "Try again",
  - **And** it does not contain "db exploded" or "secret".
- **AC-14** *(Try again re-fetches, Unit)*
  - **Given** the error component is rendered with a mock retry function,
  - **When** the "Try again" button's click handler runs,
  - **Then** the mock retry function (`unstable_retry`, or `reset` if Q2 resolves that way) is called exactly once.

**Loading skeletons**
- **AC-15** *(skeletons exist and are labelled, Unit render test, following `tests/unit/card-grid.test.ts`)*
  - **Given** each of `wishlist/loading.tsx`, `trades/loading.tsx` and `profile/loading.tsx` is rendered,
  - **Then** its markup contains `aria-busy="true"`,
  - **And** it has, respectively, `aria-label="Loading wishlist"`, `"Loading trades"` or `"Loading profile"`,
  - **And** it contains `motion-safe:animate-pulse`,
  - **And** it does not contain a bare `animate-pulse` class without the `motion-safe:` prefix.
- **AC-16** *(collection skeleton respects reduced motion, Unit)*
  - **Given** `collection/loading.tsx` is rendered,
  - **Then** it contains `motion-safe:animate-pulse`, and it still has `aria-label="Loading collection"` and `data-testid="card-grid-skeleton"`. The existing card-grid AC-8 test must keep passing.
- **AC-17** *(no horizontal scroll, E2E)*
  - **Given** a 375px-wide viewport,
  - **When** I open `/profile` and `/u/no_such_user`,
  - **Then** `document.documentElement.scrollWidth <= 375` on each page.

## Data & privacy
- **Stored:** nothing new. No migrations, tables, columns or RLS changes, so the PR does not need the `db-change` label.
- **Who sees the stats:** only the owner, on their own `/profile`. The Cards count comes from `collection_items` filtered by `user_id = user.id`, which `getCollectionItems` already does on top of RLS.
- **Reading friends' data for the Trades count:** the count reads accepted friends' collections and wishlists through the same RLS-scoped queries `/trades/<friend>` already uses. Friends-only by default (§5.3), and wishlists are friends-only (§4.7). Only the total number is shown. No friend's cards or wishlist entries appear on Profile, and pending or non-friend users (such as `e2e_stranger`) are never read.
- **Not-found page:** it doesn't say whether a username exists but is private, or doesn't exist at all. Both `/u/` and `/trades/` already call `notFound()` only when the profile row is missing. Signed-out users are redirected before the lookup (AC-12).
- **Error page:** it never shows `error.message`, stacks or digests (AC-13), so database or internal details aren't leaked.

## UX notes
- **Screens touched:** `/profile` (stats row), plus the new not-found, error and loading states under `(main)`. All of them render inside the existing header and bottom nav.
- **Stats row:** keep the current three-column grid and tile style. The Cards tile becomes a `Link`; give it a subtle affordance such as a chevron or a hover/active state, which is up to the designer. Large numbers use `en-US` grouping (`1,214`) and must fit the tile at 375px (AC-17). Unknown values show "—".
- **Not-found:** centred content with the same icon-tile, heading, body and amber-button pattern as the Trades empty state ("No trade matches yet" → Find Friends). The button text is "Find a friend".
- **Error:** reuse the visual pattern of `CollectionLoadError` (elevated card, `role="alert"`, full-width 44px button).
- **Loading:** skeletons only, with no spinners or text. Use `motion-safe:` pulse.
- **States on Profile:**
  - *Empty:* "0" for Cards (AC-6). Trades is "0" when there are no friends or no matches.
  - *Loading:* the new skeleton.
  - *Partial error:* "—" in the affected tile.
  - *Total error:* the `(main)/error.tsx` page.
- **Performance note:** the Trades count makes Profile read every friend's collection and wishlist. The viewer's own collection is read once and shared with the Cards count. The reads should run in parallel, as `/trades/[username]` already does for one friend. With MVP friend counts this is acceptable, but it is the main cost of this feature (see Q1).

## Open questions
1. **What counts as a "trade match", and is it cheap enough?** The count needs every friend's collection and wishlist on each Profile load.
   - **Recommended:** count "You have, they want" + "They have, you want" across all accepted friends (seeded value: 2), computed with the existing `computeTradeMatches` and reads in parallel.
   - Alternatives:
     - (a) Include "You both have extras". The seeded value becomes 3, matching everything shown on Trade Match.
     - (b) Replace the Trades tile with something cheap and real, such as a Wishlist count. The issue allows removing a tile that can't be computed cheaply.
   - If Profile load time becomes a problem later, a precomputed count is a separate issue.
2. **`reset()` vs `unstable_retry()`.** The issue says `reset()`. In this Next.js (16.2+), `reset()` re-renders without re-fetching, so a failed server data load fails again. `unstable_retry()` re-fetches.
   - **Recommended:** use `unstable_retry()`. This differs from the issue text.
3. **"Nothing was changed" on every error.** It is true today because server actions return errors instead of throwing, so only read and render failures reach the boundary.
   - **Recommended:** always show it, and add a line to `CODING_STANDARDS.md` or a comment in `error.tsx` that server actions must not throw. Alternatively, drop the sentence.
4. **Switch `collection/loading.tsx` to `motion-safe:animate-pulse`?** It currently uses a bare `animate-pulse`, which the issue's "matching collection/loading.tsx" doesn't account for.
   - **Recommended:** yes. It's a one-word change that makes all four skeletons consistent and respects reduced-motion settings.
5. **Root-level 404 for unmatched URLs** (for example `/nonsense`, `/u/a/b`). These still show Next's default page outside `(main)`.
   - **Recommended:** a follow-up issue. It needs a design without the signed-in nav, or `global-not-found.js`.
6. **Link the Trades and Friends tiles too** (to `/trades` and the friends list)?
   - **Recommended:** not in this issue. Only Cards links, as asked. It's a small follow-up if wanted.
7. **End-to-end test for the error page.** There's no production-safe way to make a `(main)` page throw on demand.
   - **Recommended:** cover AC-13 and AC-14 with Vitest render tests and don't add a test-only throwing route. If the owner wants E2E coverage, a route guarded by `NODE_ENV !== "production"` is the alternative.
8. **Split into the slices below?**
   - **Default: no.** There is no migration, and every part is small (one page edit, four tiny new files, one helper). One PR stays reviewable even though it has 17 ACs.

## Slices
Only used if Q8 is answered "split". Each slice can be built and shown on its own.

- **S1 Real Profile stats.** Covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8. Blocked by: none.
- **S2 Themed not-found and error pages.** Covers AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-17. Blocked by: none. AC-17's `/profile` check only needs the existing page.
- **S3 Loading skeletons.** Covers AC-15, AC-16. Blocked by: none.

## Design
Mockup: [mockup.html](45-real-profile-stats-themed-pages/mockup.html) · Screenshot: [mockup.png](45-real-profile-stats-themed-pages/mockup.png) (390px wide, existing dark tokens, header and bottom nav shown on every screen).

| # | Screen / state | ACs |
|---|---|---|
| 1 | Profile default: Cards tile is a link (amber chevron after the label, faint amber border, 64px tall); Friends and Trades tiles unchanged | AC-3, AC-4, AC-5 |
| 2 | Profile stats variants: empty ("0"), large numbers ("1,214", "1,038" fit at narrow width), failed reads ("—" in muted-secondary colour, never "0") | AC-6, AC-7, AC-17 |
| 3 | Profile loading skeleton: 64px avatar circle + two bars, three tiles, two section bars | AC-15 |
| 4 | Trades loading skeleton: title and subtitle bars, three friend-row bars | AC-15 |
| 5 | Wishlist loading skeleton: title bar + button block, 3-column card grid | AC-15 |
| 6 | Not-found: icon tile, "No ManaPal here", body, amber "Find a friend" (44px) | AC-9, AC-10, AC-11 |
| 7 | Error: `CollectionLoadError`-style alert card, "Something went wrong", "Try again" (44px) | AC-13, AC-14 |

Not drawn: the collection skeleton (only a class change, AC-16) and the signed-out redirect (AC-12, no UI).

Design decisions:
- The Cards-tile affordance is a chevron plus a subtle amber border, so it reads as tappable without competing with the amber primary buttons.
- The not-found icon is a magnifier (search metaphor); the Trades empty state uses a handshake.
- No bottom-nav tab is highlighted on not-found. The error page keeps the tab of the page that failed (Wishlist in the mockup).
- "—" uses `text-text-secondary` so it reads as "unknown", not as a value.

## Delight
Proposed by whimsy-injector. In scope unless the owner drops them at the spec gate. The not-found and error pages keep their plain copy as the issue asks. All motion is CSS only, 250ms or less, transform/opacity, behind `motion-safe:`.
| ID | Where (screen/state, AC-n) | What (exact copy or interaction) | Why it helps | Reduced-motion fallback |
|---|---|---|---|---|
| D-1 | Profile Trades tile when the count is above 0 (AC-4) | The number uses `text-amber`. The label stays "Trades" and the number is still shown, so meaning never relies on color. At 0 or "—" it keeps the normal color. | Makes "you have trades waiting" noticeable at a glance, the app's main payoff. | No animation, so nothing to change. |
| D-2 | Cards tile press (AC-5) | `motion-safe:active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-100` | Gives one-handed taps instant feedback on the only tappable tile. | No scale; the tile keeps the existing hover/active state. |
| D-3 | Profile stats row on load (AC-3, AC-4) | Row fades in and rises 6px: `motion-safe:animate-[settle_250ms_ease-out_both]`, with `@keyframes settle { from { opacity: 0; transform: translateY(6px) } }` in `globals.css`. | Softens the swap from skeleton to real numbers. | Row appears instantly. |
| D-4 | Profile with Cards = 0 (AC-6) | Muted line under the stats row, shown only when the Cards value is exactly 0 (not "—"): **"Your binder is empty. Tap Cards to add some."** | Turns the empty "0" into a next step. The Cards tile already links to `/collection`. | Static text. |
| D-5 | Not-found and error cards (AC-9, AC-13) | The card fades in using the same `settle` keyframes as D-3 (`motion-safe:animate-[settle_250ms_ease-out_both]`). Copy unchanged. | Makes a dead end feel calm and intentional instead of broken. | Card appears instantly. |

Left out: any joke or flavor copy on not-found and error pages (serious moments stay plain); pending state on "Try again" (needs client logic beyond copy); a dedicated celebration at a first trade match (would need server-side "new" tracking; possible follow-up).

## Decisions (spec gate, 2026-10-20)
Owner replied `approve` with no changes. Recommended defaults accepted for all open questions (Q1 trade match = "You have, they want" + "They have, you want"; Q2 `unstable_retry()`; Q3 always show "Nothing was changed"; Q4 `motion-safe:animate-pulse` in `collection/loading.tsx`; Q5 root 404 is a follow-up; Q6 only Cards links; Q7 Vitest render tests only; Q8 no split). All Delight items D-1 to D-5 remain in scope.
