import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWishlistItems, readWishlistItems } from "@/lib/wishlist/queries";

function fakeSupabase(response: { data: unknown; error: { message: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.returns = () => Promise.resolve(response);
  const client = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("readWishlistItems", () => {
  it("AC-2: a Supabase error is reported as ok:false, not as an empty wishlist", async () => {
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } });
    expect(await readWishlistItems(client, "u1")).toEqual({ ok: false, error: "boom" });
  });

  it("returns the rows for the given user", async () => {
    const rows = [{ id: 1 }];
    const { client, calls } = fakeSupabase({ data: rows, error: null });
    expect(await readWishlistItems(client, "u1")).toEqual({ ok: true, rows });
    expect(calls[0]).toEqual({ method: "from", args: ["wishlist_items"] });
    expect(calls).toContainEqual({ method: "eq", args: ["user_id", "u1"] });
  });
});

describe("getWishlistItems", () => {
  it("still returns [] when the read fails", async () => {
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } });
    expect(await getWishlistItems(client, "u1")).toEqual([]);
  });

  it("returns the rows when the read succeeds", async () => {
    const rows = [{ id: 7 }];
    const { client } = fakeSupabase({ data: rows, error: null });
    expect(await getWishlistItems(client, "u1")).toEqual(rows);
  });
});
