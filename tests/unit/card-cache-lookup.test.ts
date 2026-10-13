import { describe, expect, it } from "vitest";
import {
  CACHE_LOOKUP_CHUNK_SIZE,
  lookupCachedCardsById,
  lookupCachedCardsBySet,
  type CacheChunkFetcher,
  type CardCacheRow,
} from "@/lib/cards/cacheLookup";

const MAX_ROWS = 1000;

function card(set = "abc"): CardCacheRow {
  return { scryfall_id: crypto.randomUUID(), name: `Card ${Math.random()}`, set_code: set };
}
function cards(n: number, set = "abc"): CardCacheRow[] {
  return Array.from({ length: n }, () => card(set));
}

type Call = { values: string[]; afterKey: string | null };

// Fake PostgREST: filters by the call's value list on `column`, keyset-pages on
// scryfall_id, and never returns more than 1,000 rows per call.
function fakeCache(cache: CardCacheRow[], column: "scryfall_id" | "set_code") {
  const calls: Call[] = [];
  const fetcher: CacheChunkFetcher = async (values, afterKey, pageSize) => {
    calls.push({ values: [...values], afterKey });
    const set = new Set(values);
    const data = cache
      .filter((r) => set.has(r[column]) && (afterKey === null || r.scryfall_id > afterKey))
      .sort((a, b) => (a.scryfall_id < b.scryfall_id ? -1 : 1))
      .slice(0, Math.min(pageSize, MAX_ROWS));
    return { data, error: null };
  };
  return { fetcher, calls };
}

function expectDistinct(rows: CardCacheRow[]) {
  expect(new Set(rows.map((r) => r.scryfall_id)).size).toBe(rows.length);
}

describe("lookup by Scryfall id", () => {
  it("AC-1: finds all 3,000 cached cards, each once", async () => {
    const cache = cards(3000);
    const { fetcher } = fakeCache(cache, "scryfall_id");
    const res = await lookupCachedCardsById(cache.map((c) => c.scryfall_id), fetcher);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(3000);
    expectDistinct(res.rows);
  });

  it("AC-2: returns only cached cards and never sends an id twice", async () => {
    const cache = cards(2500);
    const uncached = Array.from({ length: 400 }, () => crypto.randomUUID());
    const ids = [...cache.map((c) => c.scryfall_id), ...uncached];
    const input = [...ids, ...ids.slice(0, 600)];
    const { fetcher, calls } = fakeCache(cache, "scryfall_id");
    const res = await lookupCachedCardsById(input, fetcher);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(2500);
    expect(new Set(res.rows.map((r) => r.scryfall_id))).toEqual(
      new Set(cache.map((c) => c.scryfall_id))
    );
    const sent = calls.flatMap((c) => c.values);
    expect(sent).toHaveLength(2900);
    expect(new Set(sent).size).toBe(sent.length);
  });

  for (const n of [1, CACHE_LOOKUP_CHUNK_SIZE, CACHE_LOOKUP_CHUNK_SIZE + 1, 5000]) {
    it(`AC-3: every call has 1..CHUNK ids and the union is all ${n} ids`, async () => {
      const ids = Array.from({ length: n }, () => crypto.randomUUID());
      const { fetcher, calls } = fakeCache([], "scryfall_id");
      const res = await lookupCachedCardsById(ids, fetcher);
      expect(res.ok).toBe(true);
      expect(calls.length).toBeGreaterThan(0);
      for (const c of calls) {
        expect(c.values.length).toBeGreaterThanOrEqual(1);
        expect(c.values.length).toBeLessThanOrEqual(CACHE_LOOKUP_CHUNK_SIZE);
      }
      expect(new Set(calls.flatMap((c) => c.values))).toEqual(new Set(ids));
    });
  }

  it("AC-4: empty input returns no cards and makes no calls", async () => {
    const { fetcher, calls } = fakeCache(cards(5), "scryfall_id");
    expect(await lookupCachedCardsById([], fetcher)).toEqual({ ok: true, rows: [] });
    expect(await lookupCachedCardsBySet([], fetcher)).toEqual({ ok: true, rows: [] });
    expect(calls).toHaveLength(0);
  });
});

describe("lookup by set code", () => {
  it("AC-5: reads a set with more than 1,000 cards in full, with lower-cased deduped codes", async () => {
    const cache = [...cards(2345, "sld"), ...cards(10, "m21")];
    const { fetcher, calls } = fakeCache(cache, "set_code");
    const res = await lookupCachedCardsBySet(["SLD", "m21", "sld"], fetcher);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(2355);
    expectDistinct(res.rows);
    for (const c of calls) expect(c.values).toEqual(["sld", "m21"]);
  });
});

describe("URL bound", () => {
  it("AC-6: one chunk's encoded filter is at most 8,192 characters", () => {
    expect(CACHE_LOOKUP_CHUNK_SIZE).toBeGreaterThanOrEqual(50);
    const ids = Array.from({ length: CACHE_LOOKUP_CHUNK_SIZE }, () => crypto.randomUUID());
    const encoded = new URLSearchParams({ scryfall_id: `in.(${ids.join(",")})` }).toString();
    expect(encoded.length).toBeLessThanOrEqual(8192);
  });
});

describe("paging edge cases", () => {
  it("AC-7: exactly 2,000 matches are returned and paging stops after an empty page", async () => {
    const cache = cards(2000, "sld");
    const { fetcher, calls } = fakeCache(cache, "set_code");
    const res = await lookupCachedCardsBySet(["sld"], fetcher);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(2000);
    expect(calls).toHaveLength(3);
  });

  it("AC-8a: an error on a later chunk gives an error, not partial rows", async () => {
    const ids = Array.from({ length: CACHE_LOOKUP_CHUNK_SIZE * 2 }, () => crypto.randomUUID());
    const cache = ids.map((id) => ({ ...card(), scryfall_id: id }));
    const inner = fakeCache(cache, "scryfall_id");
    let n = 0;
    const fetcher: CacheChunkFetcher = async (v, a, p) =>
      ++n === 2 ? { data: null, error: { message: "boom" } } : inner.fetcher(v, a, p);
    const res = await lookupCachedCardsById(ids, fetcher);
    expect(res.ok).toBe(false);
    expect(res).not.toHaveProperty("rows");
  });

  it("AC-8b: an error on page 2 of a set chunk gives an error, not partial rows", async () => {
    const inner = fakeCache(cards(1500, "sld"), "set_code");
    let n = 0;
    const fetcher: CacheChunkFetcher = async (v, a, p) =>
      ++n === 2 ? { data: null, error: { message: "boom" } } : inner.fetcher(v, a, p);
    const res = await lookupCachedCardsBySet(["sld"], fetcher);
    expect(res.ok).toBe(false);
    expect(res).not.toHaveProperty("rows");
  });

  it("AC-8c: a fetcher that never advances terminates with an error", async () => {
    const page = cards(MAX_ROWS, "sld").sort((a, b) => (a.scryfall_id < b.scryfall_id ? -1 : 1));
    let calls = 0;
    const fetcher: CacheChunkFetcher = async () => {
      calls++;
      return { data: page, error: null };
    };
    const res = await lookupCachedCardsBySet(["sld"], fetcher);
    expect(res.ok).toBe(false);
    expect(calls).toBeLessThan(5);
  });
});
