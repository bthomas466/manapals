import { describe, expect, it } from "vitest";
import type { CollectionItem } from "@/components/collection/CollectionGrid";
import {
  applyStatusOverrides,
  filterByTradeChip,
  isTradeStatus,
  needsFirstAvailableWarning,
  summarizeBinders,
  type TradeStatus,
} from "@/lib/trades/flags";

let nextId = 1;

function row(
  opts: { id?: number; quantity?: number; binder?: string; status?: TradeStatus | null } = {}
): CollectionItem {
  const id = opts.id ?? nextId++;
  return {
    id,
    quantity: opts.quantity ?? 1,
    finish: "nonfoil",
    condition: "near_mint",
    binder_name: opts.binder ?? "",
    trade_status: opts.status,
    card: null,
  };
}

describe("isTradeStatus", () => {
  it("accepts only the two stored values", () => {
    expect(isTradeStatus("available")).toBe(true);
    expect(isTradeStatus("not_for_trade")).toBe(true);
    expect(isTradeStatus(null)).toBe(false);
    expect(isTradeStatus(undefined)).toBe(false);
    expect(isTradeStatus("")).toBe(false);
    expect(isTradeStatus("Available")).toBe(false);
  });
});

describe("needsFirstAvailableWarning (AC-11, AC-17)", () => {
  it("is true when choosing Available with zero Available rows", () => {
    expect(needsFirstAvailableWarning([row(), row({ status: "not_for_trade" })], "available")).toBe(true);
    expect(needsFirstAvailableWarning([], "available")).toBe(true);
  });

  it("is false once an Available row exists", () => {
    expect(needsFirstAvailableWarning([row({ status: "available" }), row()], "available")).toBe(false);
  });

  it("is false for not_for_trade and null choices", () => {
    expect(needsFirstAvailableWarning([row()], "not_for_trade")).toBe(false);
    expect(needsFirstAvailableWarning([row()], null)).toBe(false);
  });
});

describe("filterByTradeChip (AC-13)", () => {
  const available = row({ status: "available" });
  const notForTrade = row({ status: "not_for_trade" });
  const unmarked = row({ status: null });
  const untagged = row();
  const all = [available, notForTrade, unmarked, untagged];

  it("'for_trade' keeps only Available rows", () => {
    expect(filterByTradeChip(all, "for_trade")).toEqual([available]);
  });

  it("'not_for_trade' keeps only Not-for-trade rows", () => {
    expect(filterByTradeChip(all, "not_for_trade")).toEqual([notForTrade]);
  });
});

describe("summarizeBinders (AC-15, AC-19)", () => {
  it("counts rows and total cards per binder and lists item ids", () => {
    const items = [
      row({ id: 1, binder: "Deck A", quantity: 2 }),
      row({ id: 2, binder: "Deck A", quantity: 3 }),
      row({ id: 3, binder: "Trade", quantity: 4 }),
    ];
    expect(summarizeBinders(items)).toEqual([
      { name: "Deck A", rows: 2, cards: 5, itemIds: [1, 2] },
      { name: "Trade", rows: 1, cards: 4, itemIds: [3] },
    ]);
  });

  it("skips empty and whitespace-only binder names", () => {
    const items = [row({ binder: "" }), row({ binder: "   " }), row({ binder: "Trade" })];
    expect(summarizeBinders(items).map((b) => b.name)).toEqual(["Trade"]);
  });

  it("sorts by name regardless of input order", () => {
    const items = [row({ binder: "Zeta" }), row({ binder: "Alpha" }), row({ binder: "Mid" })];
    expect(summarizeBinders(items).map((b) => b.name)).toEqual(["Alpha", "Mid", "Zeta"]);
  });

  it("returns [] when every row has no binder, and for an empty collection", () => {
    expect(summarizeBinders([row(), row({ binder: "" })])).toEqual([]);
    expect(summarizeBinders([])).toEqual([]);
  });
});

describe("applyStatusOverrides", () => {
  it("returns the same array when there are no overrides", () => {
    const items = [row({ id: 1 })];
    expect(applyStatusOverrides(items, new Map())).toBe(items);
  });

  it("overrides matching ids, including clearing to null, and leaves others untouched", () => {
    const a = row({ id: 1, status: "available" });
    const b = row({ id: 2, status: null });
    const c = row({ id: 3, status: "not_for_trade" });
    const result = applyStatusOverrides(
      [a, b, c],
      new Map<number, TradeStatus | null>([
        [1, null],
        [2, "available"],
      ])
    );
    expect(result.map((r) => r.trade_status)).toEqual([null, "available", "not_for_trade"]);
    expect(result[2]).toBe(c);
  });

  it("does not mutate the input rows", () => {
    const a = row({ id: 1, status: null });
    applyStatusOverrides([a], new Map<number, TradeStatus | null>([[1, "available"]]));
    expect(a.trade_status).toBeNull();
  });

  it("ignores override ids that match no row", () => {
    const a = row({ id: 1 });
    const result = applyStatusOverrides([a], new Map<number, TradeStatus | null>([[99, "available"]]));
    expect(result[0].trade_status).toBeUndefined();
  });
});
