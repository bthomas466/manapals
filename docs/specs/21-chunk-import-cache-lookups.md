# Import: find every cached card on large imports
Issue: #21 · PRD refs: US-03, US-04, §4.2, §4.3, §5.1 · Status: Approved

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

## Decisions (spec gate, 2026-10-13)
Owner replied "approve" with no changes. Recommended defaults accepted for all open questions:
Q1 abort on lookup failure; Q2 accept over-broad set lookup; Q3 sequential chunks; Q4 8 KB encoded-filter bound; Q5 accept no price refresh on import; Q6 no modal change.

## Technical design

No migration. No change to Next.js APIs: the import stays a `POST` Route Handler, and POST Route Handlers are never cached (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`). Nothing in `src/proxy.ts` changes.

### Changes
| File | Change |
|---|---|
| `src/lib/collection/read.ts` | Add `readAllPagesByKey<T, K extends number \| string>(fetchPage, keyOf, pageSize)`, which is the existing loop keyed on any ordered key. `readAllPages` becomes a one-line wrapper (`keyOf = r => r.id`), so its signature and behavior don't change. |
| `src/lib/chunk.ts` (new) | `export function chunk<T>(items: T[], size: number): T[][]`, moved verbatim from `src/lib/scryfall/client.ts`. Throws on `size < 1`. |
| `src/lib/scryfall/client.ts` | Delete the private `chunk()` and import it from `@/lib/chunk`. No behavior change. |
| `src/lib/cards/cacheLookup.ts` (new) | `CACHE_LOOKUP_CHUNK_SIZE = 200`, the `CardCacheRow` type, the `CacheChunkFetcher` type, and the generic `lookupCachedCards(values, fetchChunkPage)` (dedupe, chunk, page each chunk, fail on the first error). Also `lookupCachedCardsById` and `lookupCachedCardsBySet` (the set version lower-cases before deduping), plus `supabaseCacheFetcher(supabase, column)`, which binds a fetcher to the session client. |
| `src/lib/collection/importPlan.ts` (new) | Pure import steps taken out of the route: `nameSetKey`, `importLookupKeys(rows)`, `indexCachedCards(byId, bySet)`, `buildMissingIdentifiers(rows, cachedById, cachedByNameSet)` (route lines 77–92, verbatim logic), `CACHE_READ_ERROR` (the message string) and `prepareImport(rows, fetchers)`, which returns either `{ ok: true, cachedById, cachedByNameSet, missingIdentifiers }` or `{ ok: false, status: 500, body: { error: CACHE_READ_ERROR } }`. |
| `src/app/api/collection/import/route.ts` | Replace lines 45–92 with one `prepareImport(rows, { byId: supabaseCacheFetcher(supabase, "scryfall_id"), bySet: supabaseCacheFetcher(supabase, "set_code") })` call. On `!ok`, log the error and `return NextResponse.json(body, { status })` before any Scryfall or RPC call. Import `nameSetKey` and `CardCacheRow` from lib, and remove the local copies. Everything after that point stays the same. |
| `tests/unit/chunk.test.ts` (new) | Edge cases for `chunk` (empty, exact multiple, remainder). |
| `tests/unit/card-cache-lookup.test.ts` (new) | AC-1 to AC-8. |
| `tests/unit/import-plan.test.ts` (new) | AC-9 and AC-11 (pure part). |
| `tests/unit/import-route.test.ts` (new) | AC-10, AC-11 (spies) and AC-12. |

`src/lib/collection/queries.ts`, `ImportCollectionModal.tsx`, `upsertCards` and `fetchCardsByIdentifiers` are not touched. The modal already shows `data.error` from any non-OK response, so the new 500 message appears in the existing error slot without a UI change.

### Schema
None. The issue and the spec's scope say no schema, RLS or migration change.
- `cards.scryfall_id` is the primary key, so id lookups are index lookups.
- `cards.set_code` has no index. The set-code fallback is already a filtered scan today, and paging keeps it as one scan per page, ordered by the primary key. See Risks.

### Data flow
All work happens on the server, inside the existing `POST /api/collection/import` Route Handler. No client components change.
1. `createClient()` (session client) and `auth.getUser()`, unchanged (401 when signed out).
2. `prepareImport(rows, fetchers)`:
   1. `importLookupKeys(rows)` returns the distinct `scryfallId`s and the distinct lower-cased `setCode`s of rows with no id.
   2. `lookupCachedCardsById(ids, byId)`, then `lookupCachedCardsBySet(codes, bySet)`. They run one after the other, and each chunk is read sequentially (Q3).
   3. Inside `lookupCachedCards`, values are deduplicated and split with `chunk(values, CACHE_LOOKUP_CHUNK_SIZE)`. For each chunk, `readAllPagesByKey(afterKey => fetchChunkPage(chunk, afterKey, COLLECTION_PAGE_SIZE), r => r.scryfall_id)` runs. The first `{ ok: false }` returns immediately with no partial rows. Rows are merged into a `Map` keyed by `scryfall_id`, so each card appears once.
   4. `supabaseCacheFetcher` builds this query:
      `supabase.from("cards").select("scryfall_id, name, set_code").in(column, values)`, plus `.gt("scryfall_id", afterKey)` when `afterKey` is set, then `.order("scryfall_id").limit(pageSize).returns<CardCacheRow[]>()`.
      The keyset is always `scryfall_id`, a unique, totally ordered PK. Canonical lower-case UUID strings sort the same in JS as `uuid` does in Postgres, so the "did not advance" guard (`lastKey <= afterKey`) is valid.
   5. On success, the result is `indexCachedCards` followed by `buildMissingIdentifiers`.
3. If `!ok`: `console.error("card cache lookup failed", { message })`, then return 500 with `CACHE_READ_ERROR`. `fetchCardsByIdentifiers`, `upsertCards` and `replace_collection_items` are never reached.
4. Otherwise the existing flow continues: Scryfall for `missingIdentifiers` only, `upsertCards` (admin client, writes only), resolve rows, then `replace_collection_items` under the session.

An id chunk (200 or fewer ids, PK) can never return 1,000 rows, so each id chunk is exactly one request. That's 20 requests for 3,900 ids, and no id is sent twice (AC-2). Set chunks can page. Each page resends the same small set-code list, which is fine because AC-2's no-repeat rule is for ids only.

### Logic placement
- Pure and unit-tested: `chunk`, `readAllPagesByKey`, `lookupCachedCards*`, `importLookupKeys`, `indexCachedCards`, `buildMissingIdentifiers`, `prepareImport`.
- Only the 6-line `supabaseCacheFetcher` touches Supabase. It sits in `cacheLookup.ts` next to the logic, following `getCollectionItems` in `queries.ts`.
- The route only creates the client, calls `prepareImport`, maps `!ok` to a response, and keeps its existing Scryfall, upsert and RPC steps.

Chunk size check (AC-6): `new URLSearchParams({ scryfall_id: "in.(" + ids.join(",") + ")" }).toString()` for 200 UUIDs is 12 (`scryfall_id=`) + 6 (`in.%28`) + 200×36 + 199×3 (`%2C`) + 3 (`%29`) = 7,818 characters, which is at most 8,192. The largest chunk that fits is 209 ids (8,169 characters). Set codes are at most about 6 characters, so a 200-code chunk is far below the limit.

### Test plan
All Vitest. There's no new E2E: the import calls live Scryfall and the suite doesn't upload CSVs (see the spec). There are also no seed changes to `scripts/seed-staging.ts`.

`tests/unit/card-cache-lookup.test.ts` uses a fake `CacheChunkFetcher` that:
- records `{ values, afterKey }` for each call,
- filters an in-memory `CardCacheRow[]` by `values` and `scryfall_id > afterKey`,
- sorts by `scryfall_id` and returns `min(pageSize, 1000)` rows.

UUIDs are generated with `crypto.randomUUID()`.

| AC | Test |
|---|---|
| AC-1 | 3,000 cached and 3,000 input ids: 3,000 rows, all distinct `scryfall_id`. |
| AC-2 | 2,500 cached, 400 uncached, 600 duplicated: exactly the 2,500 cached rows. The flattened list of `values` across all calls has no repeats (`new Set(all).size === all.length`). |
| AC-3 | N in {1, `CACHE_LOOKUP_CHUNK_SIZE`, `+1`, 5,000}: each call has `1 ≤ values.length ≤ CACHE_LOOKUP_CHUNK_SIZE`, and the union of values equals the N ids. |
| AC-4 | `[]` returns `{ ok: true, rows: [] }` with 0 calls. |
| AC-5 | `sld` 2,345 and `m21` 10, input `["SLD","m21","sld"]`: 2,355 distinct rows. Every recorded value is lower-case, and the values are `["sld","m21"]` (deduplicated). |
| AC-6 | Builds the `URLSearchParams` string above for `CACHE_LOOKUP_CHUNK_SIZE` random UUIDs and asserts `≤ 8192` and `CACHE_LOOKUP_CHUNK_SIZE ≥ 50`. |
| AC-7 | One set with exactly 2,000 rows: 2,000 rows returned after 3 calls (the last one is empty). |
| AC-8 | (a) The fetcher errors on the 2nd chunk (id lookup). (b) The fetcher errors on page 2 of a set chunk. Both give `{ ok: false }` with no `rows` key. (c) The fetcher always returns the same full 1,000-row page, which gives `{ ok: false }` with fewer than 5 calls. Plus a regression check that `readAllPages` still passes the existing `tests/unit/collection-read.test.ts` unchanged. |

`tests/unit/import-plan.test.ts`:

| AC | Test |
|---|---|
| AC-9 | 4,800 `NormalizedRow`s over 3,900 distinct ids, with 3,850 in the fake cache: `prepareImport` gives `missingIdentifiers` of exactly 50 `{ id }` entries, matching the uncached set. A name+set row whose pair is cached is not queued, and an uncached pair is queued once, lower-cased. |
| AC-11 (pure) | A fake `byId` fetcher that errors: `prepareImport` returns `{ ok: false, status: 500, body: { error: "Couldn't read card data. Nothing was changed — try again shortly." } }` (exact string, with the em dash), and has no `missingIdentifiers`. A `bySet` error behaves the same. |

`tests/unit/import-route.test.ts`:

| AC | Test |
|---|---|
| AC-10 | Source check on `route.ts`: it doesn't match `/\.in\(\s*["'](scryfall_id\|set_code)["']/`, and it contains `prepareImport` and `supabaseCacheFetcher`. |
| AC-11 (spies) | `vi.mock("@/lib/supabase/server")` returns a fake client with `auth.getUser` giving a user, `from("cards")` returning a builder that resolves `{ data: null, error: { message: "boom" } }`, and an `rpc` spy. `vi.mock("@/lib/scryfall/client", …)` replaces `fetchCardsByIdentifiers` with a spy, and `vi.mock("@/lib/scryfall/cardRow")` replaces `upsertCards` with a spy. Calling `POST(new Request(url, { method: "POST", body: JSON.stringify({ rows }) }) as NextRequest)` must give status 500 with the exact body, and none of the 3 spies are called. If importing `next/server` in Vitest proves unworkable, fall back to a source ordering check: the index of `if (!prep.ok)` comes before `fetchCardsByIdentifiers(` and `replace_collection_items`. |
| AC-12 | Source checks: `route.ts` doesn't contain `@/lib/supabase/admin`, and `cacheLookup.ts` doesn't import `@/lib/supabase/admin` and selects exactly `"scryfall_id, name, set_code"`. The fetcher is built from the route's `createClient()` value (covered by the AC-11 route test, where `from` is called on the mocked session client). |

`tests/unit/chunk.test.ts` covers the shared helper, which `fetchCardsByIdentifiers` still uses with a batch size of 75.

### Risks
1. **No privacy or RLS change.** `cards` is a public-to-authenticated Scryfall cache (`cards_select_authenticated`), and reads still go through the session client. The admin client is still only used inside `upsertCards` for writes. AC-12 guards against the route importing it.
2. **Set-code fallback reads.** There's no index on `cards.set_code`, so each page of a set chunk is a filtered scan plus a PK-ordered read. Today this is one scan, capped at 1,000 rows. Now a file with no Scryfall ids that touches big sets (`plst`, `sld`) does about ⌈cached cards in those sets / 1,000⌉ scans. That's acceptable at today's cache size and rare, because Manabox exports include ids (Q2). If it shows up in logs, the follow-up is `create index concurrently cards_set_code_idx on public.cards (set_code, scryfall_id)` in a separate migration, or the (name, set) RPC from Q2.
3. **New failure mode.** A lookup error (or a gateway rejection) now aborts the import with a 500 where it used to fall back silently (Q1, as decided). The collection stays unchanged because `replace_collection_items` is never reached. Errors are logged with the message only, never row contents.
4. **Latency.** 5,000 distinct ids take 25 sequential PK lookups at roughly 30–60 ms each on Vercel to Supabase, about 1–1.5 s. That's well inside the 5 s budget (§5.1) and replaces up to 67 Scryfall calls with ~110 ms gaps. Bounded concurrency can be added later without changing the ACs.
5. **URL bound depends on encoding.** AC-6 measures `URLSearchParams` encoding, which is what supabase-js uses for `.in()`. If someone raises `CACHE_LOOKUP_CHUNK_SIZE` above 209, AC-6 fails by design.
6. **Price staleness (Q5, accepted).** Cached cards are no longer refreshed during import. A follow-up issue is needed for scheduled refresh.
7. **Migration safety.** Not applicable, because there's no migration.
8. **Keyset ordering assumption.** The no-progress guard compares `scryfall_id` strings. PostgREST returns canonical lower-case UUIDs, so JS string order matches Postgres `uuid` order. A mismatch would at worst produce a "Paging did not advance" error (fail loudly), never silent data loss.
