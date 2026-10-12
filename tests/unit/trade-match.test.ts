import { describe, expect, it } from "vitest";
import {
  aggregateByCard,
  computeTradeMatches,
  describeOffer,
  formatOfferLine,
  offeredItems,
  type CollectionItemWithOracle,
} from "@/lib/trades/match";
import type { TradeStatus } from "@/lib/trades/flags";
import type { WishlistItem } from "@/lib/wishlist/queries";

let nextId = 1;

function item(
  scryfallId: string,
  opts: {
    quantity?: number;
    finish?: "nonfoil" | "foil" | "etched";
    oracleId?: string;
    name?: string;
    status?: TradeStatus | null;
    binder?: string;
  } = {}
): CollectionItemWithOracle {
  return {
    id: nextId++,
    quantity: opts.quantity ?? 1,
    finish: opts.finish ?? "nonfoil",
    condition: "near_mint",
    binder_name: opts.binder ?? "",
    ...(opts.status !== undefined ? { trade_status: opts.status } : {}),
    card: {
      scryfall_id: scryfallId,
      oracle_id: opts.oracleId ?? `oracle-${scryfallId}`,
      name: opts.name ?? scryfallId,
      set_code: "cmr",
      rarity: "rare",
      colors: [],
      image_small: null,
      image_normal: null,
      price_usd: 1,
      price_usd_foil: 5,
    },
  };
}

function want(cardId: string, mode: "specific" | "any_printing", oracleId: string | null = null): WishlistItem {
  return {
    id: nextId++,
    card_id: cardId,
    oracle_id: oracleId,
    match_mode: mode,
    created_at: "2026-01-01T00:00:00Z",
    card: null,
  };
}

const ids = (cards: { scryfall_id: string }[]) => cards.map((c) => c.scryfall_id);

describe("aggregateByCard", () => {
  it("sums quantities across rows and tracks all-foil", () => {
    const map = aggregateByCard([item("a", { quantity: 2, finish: "foil" }), item("a", { quantity: 1 })]);
    expect(map.get("a")).toMatchObject({ quantity: 3, allFoil: false });
  });

  it("uses the foil price for foil-first cards", () => {
    const map = aggregateByCard([item("a", { finish: "foil" })]);
    expect(map.get("a")?.price).toBe(5);
  });

  it("skips rows without card data", () => {
    const map = aggregateByCard([{ ...item("a"), card: null }]);
    expect(map.size).toBe(0);
  });
});

describe("computeTradeMatches", () => {
  it("falls back to full-collection diff when neither side has a wishlist", () => {
    const result = computeTradeMatches({
      viewerItems: [item("mine"), item("shared", { quantity: 2 }), item("shared-single")],
      friendItems: [item("theirs"), item("shared"), item("shared-single")],
      viewerWishlist: [],
      friendWishlist: [],
    });
    expect(ids(result.youHaveTheyWant)).toEqual(["mine"]);
    expect(ids(result.theyHaveYouWant)).toEqual(["theirs"]);
    expect(ids(result.bothHaveExtras)).toEqual(["shared"]);
  });

  it("narrows 'you have, they want' to the friend's non-empty wishlist", () => {
    const result = computeTradeMatches({
      viewerItems: [item("wanted"), item("unwanted")],
      friendItems: [],
      viewerWishlist: [],
      friendWishlist: [want("wanted", "specific")],
    });
    expect(ids(result.youHaveTheyWant)).toEqual(["wanted"]);
  });

  it("matches 'any printing' wishlist entries by oracle id", () => {
    const result = computeTradeMatches({
      viewerItems: [],
      friendItems: [item("reprint", { oracleId: "sol-ring" }), item("other")],
      viewerWishlist: [want("original", "any_printing", "sol-ring")],
      friendWishlist: [],
    });
    expect(ids(result.theyHaveYouWant)).toEqual(["reprint"]);
  });

  it("sorts each section by name", () => {
    const result = computeTradeMatches({
      viewerItems: [item("z", { name: "Zur" }), item("a", { name: "Arcane Signet" })],
      friendItems: [],
      viewerWishlist: [],
      friendWishlist: [],
    });
    expect(result.youHaveTheyWant.map((c) => c.name)).toEqual(["Arcane Signet", "Zur"]);
  });
});

const avail = "available" as const;
const nft = "not_for_trade" as const;

function match(viewer: CollectionItemWithOracle[], friend: CollectionItemWithOracle[], opts: {
  viewerWishlist?: WishlistItem[];
  friendWishlist?: WishlistItem[];
} = {}) {
  return computeTradeMatches({
    viewerItems: viewer,
    friendItems: friend,
    viewerWishlist: opts.viewerWishlist ?? [],
    friendWishlist: opts.friendWishlist ?? [],
  });
}

describe("computeTradeMatches with trade flags", () => {
  it("AC-1: explicit null trade_status gives the same result as untagged rows", () => {
    const build = (status?: null) => ({
      viewerItems: [
        item("mine", status === null ? { status } : {}),
        item("shared", { quantity: 2, ...(status === null ? { status } : {}) }),
        item("shared-single", status === null ? { status } : {}),
      ],
      friendItems: [
        item("theirs", status === null ? { status } : {}),
        item("shared", status === null ? { status } : {}),
        item("shared-single", status === null ? { status } : {}),
      ],
      viewerWishlist: [],
      friendWishlist: [],
    });
    const untagged = computeTradeMatches(build());
    const tagged = computeTradeMatches(build(null));
    expect(tagged).toEqual(untagged);
    expect(ids(tagged.youHaveTheyWant)).toEqual(["mine"]);
    expect(ids(tagged.theyHaveYouWant)).toEqual(["theirs"]);
    expect(ids(tagged.bothHaveExtras)).toEqual(["shared"]);
  });

  it("AC-2: a Not-for-trade row is excluded in fallback mode", () => {
    const result = match([item("x", { status: nft }), item("y")], []);
    expect(ids(result.youHaveTheyWant)).toEqual(["y"]);
  });

  it("AC-3: opt-in mode offers only Available rows", () => {
    const result = match([item("A", { status: avail }), item("B", { status: null }), item("C")], []);
    expect(ids(result.youHaveTheyWant)).toEqual(["A"]);
  });

  it("AC-3: Available wins over Not-for-trade rows of other cards in opt-in mode", () => {
    const result = match([item("A", { status: avail }), item("B", { status: nft })], []);
    expect(ids(result.youHaveTheyWant)).toEqual(["A"]);
  });

  it("AC-4: the friend's opt-in mode limits what they offer (symmetry)", () => {
    const result = match([], [item("D", { status: avail }), item("E")]);
    expect(ids(result.theyHaveYouWant)).toEqual(["D"]);
  });

  it("AC-4: the friend's Not-for-trade rows are not offered in fallback mode", () => {
    const result = match([], [item("D", { status: nft }), item("E")]);
    expect(ids(result.theyHaveYouWant)).toEqual(["E"]);
  });

  it("AC-5: offered quantity counts only offered copies", () => {
    const result = match(
      [item("X", { quantity: 3, binder: "Trade" }), item("X", { quantity: 4, binder: "Deck", status: nft })],
      []
    );
    expect(result.youHaveTheyWant).toHaveLength(1);
    expect(result.youHaveTheyWant[0].quantity).toBe(3);
  });

  it("AC-5: in opt-in mode only Available copies count toward quantity", () => {
    const result = match(
      [
        item("X", { quantity: 2, binder: "Trade", status: avail }),
        item("X", { quantity: 5, binder: "Bulk" }),
      ],
      []
    );
    expect(result.youHaveTheyWant[0].quantity).toBe(2);
  });

  it("AC-6: ownership uses the full collection, even Not-for-trade rows", () => {
    const result = match([item("X")], [item("X", { status: nft })]);
    expect(result.youHaveTheyWant).toEqual([]);
  });

  it("AC-6: the friend's unoffered (non-Available) copy still counts as owned", () => {
    const result = match([item("X")], [item("X"), item("Y", { status: avail })]);
    expect(result.youHaveTheyWant).toEqual([]);
  });

  it("AC-6 (mirror): the viewer owning X as Not-for-trade blocks the friend's offer of X", () => {
    const result = match([item("X", { status: nft })], [item("X")]);
    expect(result.theyHaveYouWant).toEqual([]);
  });

  it("AC-7: the friend's wishlist still narrows an opt-in offer", () => {
    const result = match([item("A", { status: avail }), item("B", { status: avail })], [], {
      friendWishlist: [want("B", "specific")],
    });
    expect(ids(result.youHaveTheyWant)).toEqual(["B"]);
  });

  it("AC-7: wishlist never widens an opt-in offer to unflagged cards", () => {
    const result = match([item("A", { status: avail }), item("B")], [], {
      friendWishlist: [want("B", "specific")],
    });
    expect(result.youHaveTheyWant).toEqual([]);
  });

  describe("AC-8: both have extras counts only offered copies", () => {
    it("is not shown when both offered quantities are 1 and the other copies are Not for trade", () => {
      const result = match(
        [item("X", { quantity: 1, binder: "Trade" }), item("X", { quantity: 3, binder: "Deck", status: nft })],
        [item("X", { quantity: 1 })]
      );
      expect(result.bothHaveExtras).toEqual([]);
    });

    it("is shown when the viewer offers 2 or more", () => {
      const result = match([item("X", { quantity: 2 })], [item("X", { quantity: 1 })]);
      expect(ids(result.bothHaveExtras)).toEqual(["X"]);
      expect(result.bothHaveExtras[0].quantity).toBe(2);
    });

    it("is shown when only the friend offers 2 or more", () => {
      const result = match(
        [item("X", { quantity: 1 })],
        [item("X", { quantity: 2 })]
      );
      expect(ids(result.bothHaveExtras)).toEqual(["X"]);
    });

    it("hides the quantity badge (quantity 0) when only the friend has offered extras", () => {
      const result = match(
        [item("X", { quantity: 4, status: nft })],
        [item("X", { quantity: 2 })]
      );
      expect(ids(result.bothHaveExtras)).toEqual(["X"]);
      expect(result.bothHaveExtras[0].quantity).toBe(0);
    });

    it("ignores unflagged copies on a side that is in opt-in mode", () => {
      const result = match(
        [item("X", { quantity: 1, binder: "Trade", status: avail }), item("X", { quantity: 4, binder: "Bulk" })],
        [item("X", { quantity: 1 })]
      );
      expect(result.bothHaveExtras).toEqual([]);
    });
  });
});

describe("offeredItems", () => {
  it("returns everything when no flags exist", () => {
    const rows = [item("a"), item("b", { status: null })];
    expect(offeredItems(rows)).toEqual(rows);
  });

  it("drops Not-for-trade rows in fallback mode", () => {
    const rows = [item("a"), item("b", { status: nft })];
    expect(offeredItems(rows).map((r) => r.card?.scryfall_id)).toEqual(["a"]);
  });

  it("keeps only Available rows once any is Available", () => {
    const rows = [item("a", { status: avail }), item("b"), item("c", { status: nft })];
    expect(offeredItems(rows).map((r) => r.card?.scryfall_id)).toEqual(["a"]);
  });

  it("returns an empty list for an empty collection", () => {
    expect(offeredItems([])).toEqual([]);
  });
});

describe("describeOffer and formatOfferLine", () => {
  it("AC-23: one Available row reads singular", () => {
    const summary = describeOffer([item("a", { status: avail }), item("b")]);
    expect(summary).toEqual({ mode: "opt_in", availableCount: 1 });
    expect(formatOfferLine(summary)).toBe("Offering: 1 card you marked Available");
  });

  it("AC-23: several Available rows read plural and count rows", () => {
    const summary = describeOffer([item("a", { status: avail }), item("b", { status: avail }), item("c", { status: nft })]);
    expect(summary).toEqual({ mode: "opt_in", availableCount: 2 });
    expect(formatOfferLine(summary)).toBe("Offering: 2 cards you marked Available");
  });

  it("AC-24: no Available rows and two Not-for-trade rows", () => {
    const summary = describeOffer([item("a", { status: nft }), item("b", { status: nft }), item("c")]);
    expect(summary).toEqual({ mode: "fallback", notForTradeCount: 2 });
    expect(formatOfferLine(summary)).toBe("Offering: your collection except 2 not-for-trade entries");
  });

  it("AC-24: a single Not-for-trade row reads singular", () => {
    const summary = describeOffer([item("a", { status: nft })]);
    expect(formatOfferLine(summary)).toBe("Offering: your collection except 1 not-for-trade entry");
  });

  it("AC-24: zero flags reads whole collection", () => {
    const summary = describeOffer([item("a"), item("b", { status: null })]);
    expect(summary).toEqual({ mode: "fallback", notForTradeCount: 0 });
    expect(formatOfferLine(summary)).toBe("Offering: your whole collection");
  });

  it("an empty collection reads whole collection", () => {
    expect(formatOfferLine(describeOffer([]))).toBe("Offering: your whole collection");
  });
});
