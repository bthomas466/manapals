import { describe, expect, it } from "vitest";
import type { CacheChunkFetcher, CardCacheRow } from "@/lib/cards/cacheLookup";
import type { NormalizedRow } from "@/lib/csv/manabox";
import { prepareImport } from "@/lib/collection/importPlan";

function row(over: Partial<NormalizedRow>): NormalizedRow {
  return {
    scryfallId: null,
    name: "Lightning Bolt",
    setCode: "LEA",
    quantity: 1,
    finish: "nonfoil",
    condition: "near_mint",
    language: "en",
    binderName: "Main",
    manaboxId: null,
    ...over,
  } as NormalizedRow;
}

function fetcherOver(cache: CardCacheRow[], column: "scryfall_id" | "set_code"): CacheChunkFetcher {
  return async (values, afterKey, pageSize) => {
    const set = new Set(values);
    const data = cache
      .filter((r) => set.has(r[column]) && (afterKey === null || r.scryfall_id > afterKey))
      .sort((a, b) => (a.scryfall_id < b.scryfall_id ? -1 : 1))
      .slice(0, Math.min(pageSize, 1000));
    return { data, error: null };
  };
}

const failing: CacheChunkFetcher = async () => ({ data: null, error: { message: "boom" } });
const empty: CacheChunkFetcher = async () => ({ data: [], error: null });

describe("prepareImport", () => {
  it("AC-9: only the 50 truly uncached ids are queued for Scryfall", async () => {
    const ids = Array.from({ length: 3900 }, () => crypto.randomUUID());
    const cache: CardCacheRow[] = ids
      .slice(0, 3850)
      .map((id, i) => ({ scryfall_id: id, name: `C${i}`, set_code: "abc" }));
    const rows = [...ids, ...ids.slice(0, 900)].map((id) => row({ scryfallId: id }));
    expect(rows).toHaveLength(4800);

    const res = await prepareImport(rows, {
      byId: fetcherOver(cache, "scryfall_id"),
      bySet: empty,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.missingIdentifiers).toHaveLength(50);
    expect(new Set(res.missingIdentifiers.map((m) => ("id" in m ? m.id : "")))).toEqual(
      new Set(ids.slice(3850))
    );
  });

  it("AC-9: name+set rows are queued only if uncached, once, lower-cased", async () => {
    const cached: CardCacheRow = { scryfall_id: crypto.randomUUID(), name: "Lightning Bolt", set_code: "lea" };
    const rows = [
      row({ name: "Lightning Bolt", setCode: "LEA" }),
      row({ name: "Counterspell", setCode: "LEA" }),
      row({ name: "Counterspell", setCode: "LEA", binderName: "Other" }),
    ];
    const res = await prepareImport(rows, { byId: empty, bySet: fetcherOver([cached], "set_code") });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.missingIdentifiers).toEqual([{ name: "Counterspell", set: "lea" }]);
  });

  it("malformed ids skip the cache lookup but are still queued for Scryfall", async () => {
    const good = crypto.randomUUID();
    const cached: CardCacheRow = { scryfall_id: good, name: "A", set_code: "abc" };
    const base = fetcherOver([cached], "scryfall_id");
    const uuidOnly: CacheChunkFetcher = async (values, afterKey, pageSize) => {
      if (values.some((v) => !/^[0-9a-f-]{36}$/i.test(v))) {
        return { data: null, error: { message: "invalid input syntax for type uuid" } };
      }
      return base(values, afterKey, pageSize);
    };
    const res = await prepareImport(
      [row({ scryfallId: good }), row({ scryfallId: "not-a-uuid" })],
      { byId: uuidOnly, bySet: empty }
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.missingIdentifiers).toEqual([{ id: "not-a-uuid" }]);
  });

  const msg = "Couldn't read card data. Nothing was changed — try again shortly.";
  it("AC-11: an id lookup error gives a 500 with the exact message", async () => {
    const res = await prepareImport([row({ scryfallId: crypto.randomUUID() })], {
      byId: failing,
      bySet: empty,
    });
    expect(res).toEqual({ ok: false, status: 500, body: { error: msg } });
  });

  it("AC-11: a set lookup error gives a 500 with the exact message", async () => {
    const res = await prepareImport([row({})], { byId: empty, bySet: failing });
    expect(res).toEqual({ ok: false, status: 500, body: { error: msg } });
  });
});
