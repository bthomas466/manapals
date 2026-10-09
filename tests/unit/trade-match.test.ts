import { describe, expect, it } from "vitest";
import {
  aggregateByCard,
  computeTradeMatches,
  type CollectionItemWithOracle,
} from "@/lib/trades/match";
import type { WishlistItem } from "@/lib/wishlist/queries";

let nextId = 1;

function item(
  scryfallId: string,
  opts: { quantity?: number; finish?: "nonfoil" | "foil" | "etched"; oracleId?: string; name?: string } = {}
): CollectionItemWithOracle {
  return {
    id: nextId++,
    quantity: opts.quantity ?? 1,
    finish: opts.finish ?? "nonfoil",
    condition: "near_mint",
    binder_name: "",
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
