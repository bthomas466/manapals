# Import: find every cached card on large imports
Issue: #21 · PRD refs: US-03, US-04, §4.2, §4.3, §5.1 · Status: Draft

## Problem
Before calling Scryfall, `POST /api/collection/import` (`src/app/api/collection/import/route.ts`) checks the shared `cards` cache with two single queries:
- `.in("scryfall_id", scryfallIds)` for rows that have a Scryfall ID. The list isn't deduplicated, so a 5,000-row export sends up to 5,000 ids.
- `.in("set_code", setCodes)` for rows without one. This returns **every** cached card in those sets, not just the ones in the file. A few large sets (for example `sld`, `plst`) can hold well over 1,000 cached cards on their own.

Both have the same two problems:
1. **The 1,000-row cap.** PostgREST returns at most `max_rows = 1000` rows per request (`supabase/config.toml`; the hosted projects use the same value). Cached cards past row 1,000 are treated as missing.
2. **URL length.** `.in(...)` filters go in the query string. A list of several thousand UUIDs (about 39 characters each once URL-encoded) makes a URL well over 100 KB. That can be rejected by the API gateway, so the request fails.

Also, both queries ignore errors (`data ?? []`). A rejected or failed lookup looks the same as "nothing cached".

Every missed cache hit is sent to Scryfall again. This makes large imports slower, works against the §5.1 budget (import under 5 s for up to 5,000 cards), and uses more of Scryfall's 10 req/s limit (§4.3). No collection data is lost. The refetched cards are upserted and the import still succeeds.

This was deferred as Q4 of `docs/specs/16-load-full-collections.md` (PR #18).

## Users & scenario
Priya has 4,800 rows in Manabox and most of her cards are already in the `cards` cache from her friends' imports. On her phone she opens **Collection → Import**, chooses her Manabox CSV, and confirms the replace warning.

1. The import route deduplicates her 4,800 rows down to about 3,900 distinct Scryfall IDs. It looks them up in the cache in small chunks, paging inside each chunk, and finds all 3,850 that are cached. Today it would find at most 1,000, or fail outright on URL length and find none.
2. Only the 50 uncached cards go to Scryfall: one `/cards/collection` request (75 per batch). Today it would make about 39–52 requests.
3. The import finishes and she sees the same success message as today, with the same imported and unmatched counts.

Nothing on screen changes. The only difference is fewer Scryfall calls and a faster import.

## Scope
### In scope
- **Complete cache lookup by Scryfall ID.** Deduplicate the ids, split them into chunks of at most `CACHE_LOOKUP_CHUNK_SIZE` (a constant exported from `src/lib/**`), and page through each chunk's results until a short page comes back. Every cached card whose id is in the file is found, whatever the file size.
- **Complete cache lookup by set code** (the name + set fallback, PRD §4.2). Use the same chunking and paging over the deduplicated, lower-cased set codes, so a set with more than 1,000 cached cards is read in full.
- **Keep the URL bounded.** The chunk size is chosen so that one chunk's encoded `in.(...)` filter stays under a fixed limit (AC-6).
- **Fail loudly on lookup errors.** If any chunk or page fails, the import stops before Scryfall is called and before `replace_collection_items` runs. The user gets an error and the collection is unchanged (see Q1, which proposes this change from today's silent fallback).
- **Pure logic in `src/lib/**`,** unit-tested with a fake fetcher that returns at most 1,000 rows per call, like PR #18's `tests/unit/collection-read.test.ts`. The route only binds the helper to Supabase and uses its result.
- **Reuse.** `src/lib/collection/read.ts` (`readAllPages`, `ReadResult`) already implements "page until short, fail on error, guard against non-advancing pages". It's keyed on a numeric `id`, and `cards` is keyed on `scryfall_id uuid`. Whether to generalize it or write a sibling is the architect's call. `src/lib/scryfall/client.ts` has a private `chunk()` that could be shared.

### Out of scope
- Any change to the response shape, success or error copy for other failures, the import modal, or the unmatched-rows report.
- Narrowing the set-code lookup to only the (name, set) pairs in the file, for example with an RPC or a `name` filter. It would read less data, but needs either a migration or careful quoting of card names in `.in(...)` (Q2).
- Moving lookups to a POST-body RPC (no URL limit, one round trip). That needs a migration and the issue says no schema change (Q2).
- Running chunk lookups in parallel. The architect may do this if simple, but no AC requires it (Q3).
- Refreshing stale prices or metadata for cards already in the cache (PRD §4.3 "prices update daily"). Today, missed cache hits refresh prices by accident. Fixing the misses means cached cards are no longer refreshed during import. That's the intended behavior; scheduled refresh is a separate feature.
- Changes to `fetchCardsByIdentifiers` (Scryfall batching, delay, retries).
- Raising PostgREST `max_rows` or gateway URL limits in project settings.
- The other remaining 1,000-row caps: `getWishlistItems` and `snapshotCollection` in `tests/e2e/supabase.ts`.
- Any schema, RLS or migration change.
- A performance test such as "a 5,000-card import finishes in under 5 s". AC-9 checks Scryfall request counts instead.

## Acceptance criteria
Unit = Vitest on pure logic in `src/lib/**` using a fake fetcher. The fake records each call's value list and paging cursor, returns only rows whose key is in that call's list, and returns at most 1,000 rows per call (like PostgREST `max_rows`). There's no E2E for the import itself, because it would call live Scryfall and the existing E2E suite doesn't upload CSVs. The route is covered by AC-10 and AC-11.

**Lookup by Scryfall ID**
- **AC-1** *(more than 1,000 cached ids)*
  - **Given** a fake cache holding 3,000 cards and an input list of those 3,000 ids,
  - **When** the id lookup runs,
  - **Then** it returns all 3,000 cards, each exactly once.
- **AC-2** *(mixed cached and uncached, with duplicates)*
  - **Given** a fake cache holding 2,500 cards and an input of 2,500 cached ids plus 400 ids that aren't cached, where 600 ids appear twice,
  - **When** the id lookup runs,
  - **Then** it returns exactly the 2,500 cached cards,
  - **And** no fetcher call receives the same id twice, and no id is sent in more than one call's list.
- **AC-3** *(chunk bound)*
  - **Given** any input of N distinct ids,
  - **When** the lookup runs,
  - **Then** every fetcher call's value list has between 1 and `CACHE_LOOKUP_CHUNK_SIZE` items,
  - **And** the union of all value lists is exactly the N distinct ids. Test with N = 1, N = `CACHE_LOOKUP_CHUNK_SIZE`, `CACHE_LOOKUP_CHUNK_SIZE + 1`, and 5,000.
- **AC-4** *(empty input)*
  - **Given** an empty id list,
  - **When** the lookup runs,
  - **Then** it returns no cards and makes 0 fetcher calls.

**Lookup by set code**
- **AC-5** *(one set with more than 1,000 cached cards)*
  - **Given** a fake cache where set `sld` holds 2,345 cards and set `m21` holds 10,
  - **When** the set-code lookup runs for `["SLD", "m21", "sld"]`,
  - **Then** it returns all 2,355 cards, each exactly once,
  - **And** the fetcher only ever receives lower-cased, deduplicated set codes.

**URL bound**
- **AC-6**
  - **Given** a list of `CACHE_LOOKUP_CHUNK_SIZE` random UUIDs,
  - **When** the test builds the PostgREST filter `scryfall_id=in.(<ids joined by ",">)` and encodes it with `URLSearchParams`,
  - **Then** the encoded string is at most 8,192 characters,
  - **And** `CACHE_LOOKUP_CHUNK_SIZE` is at least 50. See Q4 for why the limit is 8 KB rather than the issue's example of 500 ids.

**Paging edge cases**
- **AC-7** *(exact multiple of the page size)*
  - **Given** one chunk whose matches total exactly 2,000 rows and a 1,000-row page size,
  - **When** the lookup runs,
  - **Then** it returns 2,000 rows and stops after a short or empty page. It doesn't loop forever.
- **AC-8** *(error on a later call)*
  - **Given** a fetcher that succeeds for the first chunk and returns `{ data: null, error }` for a later chunk or later page,
  - **When** either lookup runs,
  - **Then** the result is an error, not a partial list of cards.
  - **Also**, given a fetcher that returns the same full page twice (no progress), the lookup returns an error and terminates.

**Effect on Scryfall calls**
- **AC-9** *(only real misses go to Scryfall)*
  - **Given** 4,800 normalized import rows referencing 3,900 distinct Scryfall ids, of which 3,850 are in the fake cache,
  - **When** the pure step that builds the Scryfall request list runs on the lookup result,
  - **Then** it yields exactly the 50 uncached identifiers. This is the dedupe loop at `route.ts` lines 77–92, moved into `src/lib/**` if needed to make it testable.
  - Before this change, with the cap, it would yield at least 2,900.

**Route wiring**
- **AC-10** *(route uses the helper)*
  - A Vitest source-level test reads `src/app/api/collection/import/route.ts` and checks two things:
    - It doesn't contain `.in("scryfall_id"` or `.in("set_code"`.
    - It does call the new lookup helper(s).
  - This follows the pattern of `tests/unit/collection-readers-wiring.test.ts`.
- **AC-11** *(lookup failure aborts the import; Vitest)*
  - **Given** the lookup returns an error,
  - **When** the route's result-to-response mapping runs (a pure function in `src/lib/**`),
  - **Then** the response is HTTP 500 with `{ error: "Couldn't read card data. Nothing was changed — try again shortly." }`,
  - **And** a spy confirms Scryfall and `replace_collection_items` weren't called. If they can't be spied cheaply, the architect may cover this with an ordering assertion in the mapping function instead.

**Privacy (regression)**
- **AC-12**
  - The lookup helper only reads `scryfall_id, name, set_code` from `cards`, through the caller's session client (`createClient()`), never the admin client.
  - A source-level Vitest assertion checks that the route doesn't import `@/lib/supabase/admin`.

## Data & privacy
- **No schema, RLS or migration change.** `cards` is a shared Scryfall cache with no user data. Its RLS policy `cards_select_authenticated` lets any signed-in user read every row, and that doesn't change.
- **What's read.** The same three columns as today (`scryfall_id, name, set_code`), split across more requests. Nothing new is stored, and `collection_items` writes still go only through `replace_collection_items` under the user's session.
- **What's sent to Scryfall.** Fewer identifiers than today, and only card ids or name+set (no user data). This matches §4.3.
- **Visibility.** Collection visibility (friends-only by default) isn't touched. Import is still owner-only (401 when signed out).

## UX notes
- **Screens touched:** none visually. The import modal (`src/components/collection/ImportCollectionModal.tsx`) and success copy are unchanged.
- **Loading:** the existing import progress state. Large imports should finish sooner, but no new UI.
- **Empty:** unchanged ("No rows to import", HTTP 400).
- **Error:** one new server error for a failed cache read (AC-11), shown in the modal's existing error slot, just like the current Scryfall 502 and upsert 500 messages. The collection is unchanged.

## Open questions
1. **Lookup failure: abort, or fall back to Scryfall?**
   - Today a failed lookup is silently treated as "nothing cached", and every card is refetched. For 5,000 cards that's about 67 Scryfall requests (at least 7 s with the 110 ms delay), which breaks the §5.1 budget and could hit Scryfall's rate limit.
   - **Recommended:** abort with a "nothing was changed" error (AC-11). This matches #16's "fail loudly, never partially" decision and the route's existing 502/500 handling.
   - Alternative: keep today's fallback and only log. In that case, drop AC-11 and change AC-8 to "returns no cards plus a logged error".
2. **Over-broad set-code lookup.**
   - The name + set fallback reads every cached card in each set, then matches by name in memory. Paging makes this correct but can read thousands of extra rows.
   - **Recommended:** accept it for now. Manabox exports nearly always include Scryfall IDs, so this path is rare.
   - Follow-up issue: an RPC that takes (name, set) pairs in a POST body. It needs a migration, and would also replace the id lookup with one round trip.
3. **Sequential or parallel chunk requests?**
   - **Recommended:** sequential (simplest and easy to test). For 5,000 ids with chunks of about 200, that's about 25 small indexed primary-key lookups.
   - The architect may add bounded concurrency (for example 4 at a time) if it's trivial and AC-8 still holds.
4. **Chunk size: the issue's 500, or smaller?**
   - 500 UUIDs encode to about 19.5 KB of query string. Many gateways (nginx, Kong, Cloudflare) default to 8–16 KB header/URL limits, so 500 risks the very failure this issue fixes.
   - **Recommended:** keep the encoded filter at or under 8 KB (AC-6), which gives about 200 ids per chunk, and make it a single exported constant.
   - If staging shows 500 works reliably, the constant can be raised, as long as AC-6's limit is raised with it in the same PR.
5. **Price refresh as a side effect.**
   - Today some cached cards get their prices refreshed only because the lookup missed them. After this fix, cached cards are never refreshed during import, so prices in the cache can get older (affects #11's estimated value).
   - **Recommended:** accept this, and open a separate issue for scheduled or stale-on-import price refresh (PRD §4.3).

6. **Retry affordance on lookup failure.** The error step only offers "Try another file" (returns to the picker). Kept unchanged because modal changes are out of scope; a "Try again" button would be a small follow-up.

## Design
Mockup: [mockup.html](21-chunk-import-cache-lookups/mockup.html) · [mockup.png](21-chunk-import-cache-lookups/mockup.png)

Only the existing `ImportCollectionModal` bottom sheet is shown; no new components or tokens.

| State | What it shows | ACs |
|---|---|---|
| 1. Importing | Existing "Importing and fetching card data from Scryfall…" copy (a thin progress bar is drawn for illustration only; the real UI has none). Finishes sooner. | AC-9 |
| 2. Success with unmatched | Unchanged copy and counts, unmatched list | AC-1, AC-2 |
| 3. Success, all matched | Unchanged, no unmatched box | AC-1, AC-2 |
| 4. Lookup-failure error | New message "Couldn't read card data. Nothing was changed — try again shortly." in the existing error slot, with the existing "Try another file" button | AC-8, AC-11 |

Design note: the existing error step's only action is "Try another file", which fits a bad CSV but is slightly off for a transient server error. Kept as is, per scope (no modal change). Recorded as an open question below.
