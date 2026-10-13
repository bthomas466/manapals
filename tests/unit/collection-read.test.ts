import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COLLECTION_PAGE_SIZE,
  collectionPageState,
  readAllPages,
  type PageResponse,
} from "@/lib/collection/read";
import { getCollectionItems } from "@/lib/collection/queries";

type Row = { id: number };

const makeRows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

/** Keyset fetcher over `all`, honouring afterId and a per-call row cap like PostgREST max_rows. */
function fakeFetcher(all: Row[], cap = COLLECTION_PAGE_SIZE) {
  const calls: (number | null)[] = [];
  const fetchPage = async (afterId: number | null, pageSize: number): Promise<PageResponse<Row>> => {
    calls.push(afterId);
    const data = all
      .filter((r) => afterId === null || r.id > afterId)
      .slice(0, Math.min(pageSize, cap));
    return { data, error: null };
  };
  return { fetchPage, calls };
}

describe("readAllPages", () => {
  it("AC-1: returns all 2,345 rows in ascending id order with no duplicates", async () => {
    const { fetchPage, calls } = fakeFetcher(makeRows(2345));
    const result = await readAllPages(fetchPage, 1000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.rows.map((r) => r.id);
    expect(ids).toHaveLength(2345);
    expect(new Set(ids).size).toBe(2345);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(calls).toHaveLength(3);
  });

  it("AC-2: an exact multiple of the page size stops after the trailing empty page", async () => {
    const { fetchPage, calls } = fakeFetcher(makeRows(2000));
    const result = await readAllPages(fetchPage, 1000);
    expect(result.ok && result.rows.length).toBe(2000);
    expect(calls).toHaveLength(3);
  });

  it("AC-3: an empty collection returns [] after one call", async () => {
    const { fetchPage, calls } = fakeFetcher([]);
    expect(await readAllPages(fetchPage, 1000)).toEqual({ ok: true, rows: [] });
    expect(calls).toHaveLength(1);
  });

  it("AC-3: a small collection returns 7 rows after one call", async () => {
    const { fetchPage, calls } = fakeFetcher(makeRows(7));
    const result = await readAllPages(fetchPage, 1000);
    expect(result.ok && result.rows).toHaveLength(7);
    expect(calls).toHaveLength(1);
  });

  it("AC-4: an error on page 2 is reported and page-1 rows are not returned", async () => {
    const all = makeRows(1500);
    let call = 0;
    const result = await readAllPages<Row>(async (afterId, size) => {
      call++;
      if (call === 2) return { data: null, error: { message: "boom" } };
      return { data: all.filter((r) => afterId === null || r.id > afterId).slice(0, size), error: null };
    }, 1000);
    expect(result).toEqual({ ok: false, error: "boom" });
    expect("rows" in result).toBe(false);
  });

  it("AC-4: a fetcher that never advances terminates with an error", async () => {
    const page = makeRows(1000);
    const fetchPage = vi.fn(async (): Promise<PageResponse<Row>> => ({ data: page, error: null }));
    const result = await readAllPages(fetchPage, 1000);
    expect(result.ok).toBe(false);
    expect(fetchPage.mock.calls.length).toBeLessThan(5);
  });
});

describe("collectionPageState", () => {
  it("AC-15: a failed read maps to the error state", () => {
    expect(collectionPageState({ ok: false, error: "x" })).toEqual({ kind: "error" });
  });

  it("AC-15: an empty successful read is ready, not an error", () => {
    expect(collectionPageState({ ok: true, rows: [] })).toEqual({ kind: "ready", items: [] });
  });
});

describe("getCollectionItems", () => {
  /** Chainable fake that records each page's calls and serves rows by keyset. */
  function fakeSupabase(all: Row[]) {
    const pages: { method: string; args: unknown[] }[][] = [];
    const client = {
      from(table: string) {
        const log: { method: string; args: unknown[] }[] = [{ method: "from", args: [table] }];
        pages.push(log);
        let afterId: number | null = null;
        let limit = 1000;
        const builder = {
          select(...args: unknown[]) {
            log.push({ method: "select", args });
            return builder;
          },
          eq(...args: unknown[]) {
            log.push({ method: "eq", args });
            return builder;
          },
          gt(...args: unknown[]) {
            log.push({ method: "gt", args });
            afterId = args[1] as number;
            return builder;
          },
          order(...args: unknown[]) {
            log.push({ method: "order", args });
            return builder;
          },
          limit(n: number) {
            log.push({ method: "limit", args: [n] });
            limit = n;
            return builder;
          },
          returns() {
            const data = all.filter((r) => afterId === null || r.id > afterId).slice(0, limit);
            return Promise.resolve({ data, error: null });
          },
        };
        return builder;
      },
    };
    return { client: client as unknown as SupabaseClient, pages };
  }

  it("AC-19: every page filters by the given user id, orders by id and keysets on the last id", async () => {
    const { client, pages } = fakeSupabase(makeRows(2345));
    const columns = "id, quantity, card:cards(name)";
    const result = await getCollectionItems<Row>(client, "user-42", columns);

    expect(result.ok && result.rows).toHaveLength(2345);
    expect(pages).toHaveLength(3);
    const lastIds = [1000, 2000];
    pages.forEach((log, i) => {
      const find = (m: string) => log.filter((c) => c.method === m);
      expect(log[0]).toEqual({ method: "from", args: ["collection_items"] });
      expect(find("select")[0].args).toEqual([columns]);
      expect(find("eq")).toEqual([{ method: "eq", args: ["user_id", "user-42"] }]);
      expect(find("order")[0].args[0]).toBe("id");
      if (i === 0) expect(find("gt")).toHaveLength(0);
      else expect(find("gt")).toEqual([{ method: "gt", args: ["id", lastIds[i - 1]] }]);
    });
  });
});
