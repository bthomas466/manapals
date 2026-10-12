import type { CollectionItem } from "@/components/collection/CollectionGrid";
import type { WishlistItem } from "@/lib/wishlist/queries";

export type CardSummary = {
  scryfall_id: string;
  oracle_id: string | null;
  name: string;
  set_code: string;
  image_small: string | null;
  image_normal: string | null;
  quantity: number;
  allFoil: boolean;
  price: number | null;
};

// Extends the shared CollectionItem shape with oracle_id, needed only for
// trade matching to match "any printing" wishlist entries.
export type CollectionItemWithOracle = Omit<CollectionItem, "card"> & {
  card: (NonNullable<CollectionItem["card"]> & { oracle_id: string | null }) | null;
};

export type TradeMatches = {
  youHaveTheyWant: CardSummary[];
  theyHaveYouWant: CardSummary[];
  bothHaveExtras: CardSummary[];
};

export function aggregateByCard(items: CollectionItemWithOracle[]): Map<string, CardSummary> {
  const map = new Map<string, CardSummary>();
  for (const item of items) {
    if (!item.card) continue;
    const isFoil = item.finish !== "nonfoil";
    const existing = map.get(item.card.scryfall_id);
    if (existing) {
      existing.quantity += item.quantity;
      existing.allFoil = existing.allFoil && isFoil;
    } else {
      map.set(item.card.scryfall_id, {
        scryfall_id: item.card.scryfall_id,
        oracle_id: item.card.oracle_id,
        name: item.card.name,
        set_code: item.card.set_code,
        image_small: item.card.image_small,
        image_normal: item.card.image_normal,
        quantity: item.quantity,
        allFoil: isFoil,
        price: (isFoil ? (item.card.price_usd_foil ?? item.card.price_usd) : item.card.price_usd) ?? null,
      });
    }
  }
  return map;
}

export function buildWantMatcher(wishlist: WishlistItem[]): (card: CardSummary) => boolean {
  const specificIds = new Set(wishlist.filter((w) => w.match_mode === "specific").map((w) => w.card_id));
  const oracleIds = new Set(
    wishlist.filter((w) => w.match_mode === "any_printing" && w.oracle_id).map((w) => w.oracle_id)
  );
  return (card) => specificIds.has(card.scryfall_id) || (card.oracle_id != null && oracleIds.has(card.oracle_id));
}

// What a user offers: if any row is Available they are in opt-in mode and
// offer only those rows; otherwise (fallback) everything except Not-for-trade
// rows. Unmarked is null/undefined. Ownership checks still use every row.
export function offeredItems(items: CollectionItemWithOracle[]): CollectionItemWithOracle[] {
  if (items.some((i) => i.trade_status === "available")) {
    return items.filter((i) => i.trade_status === "available");
  }
  return items.filter((i) => i.trade_status !== "not_for_trade");
}

export type OfferSummary =
  | { mode: "opt_in"; availableCount: number }
  | { mode: "fallback"; notForTradeCount: number };

export function describeOffer(items: Pick<CollectionItem, "trade_status">[]): OfferSummary {
  const availableCount = items.filter((i) => i.trade_status === "available").length;
  if (availableCount > 0) return { mode: "opt_in", availableCount };
  return {
    mode: "fallback",
    notForTradeCount: items.filter((i) => i.trade_status === "not_for_trade").length,
  };
}

export function formatOfferLine(summary: OfferSummary): string {
  if (summary.mode === "opt_in") {
    const n = summary.availableCount;
    return `Offering: ${n} ${n === 1 ? "card" : "cards"} you marked Available`;
  }
  const n = summary.notForTradeCount;
  if (n === 0) return "Offering: your whole collection";
  return `Offering: your collection except ${n} not-for-trade ${n === 1 ? "entry" : "entries"}`;
}

// The offering side follows the offer rule (see offeredItems). The wanting
// side narrows to the other user's wishlist once they have one — an empty
// wishlist still means "wants everything." With no flags set, offered equals
// owned, so behaviour is unchanged.
export function computeTradeMatches(input: {
  viewerItems: CollectionItemWithOracle[];
  friendItems: CollectionItemWithOracle[];
  viewerWishlist: WishlistItem[];
  friendWishlist: WishlistItem[];
}): TradeMatches {
  const viewerOwned = aggregateByCard(input.viewerItems);
  const friendOwned = aggregateByCard(input.friendItems);
  const viewerOffered = aggregateByCard(offeredItems(input.viewerItems));
  const friendOffered = aggregateByCard(offeredItems(input.friendItems));
  const viewerWants = buildWantMatcher(input.viewerWishlist);
  const friendWants = buildWantMatcher(input.friendWishlist);

  const youHaveTheyWant: CardSummary[] = [];
  const theyHaveYouWant: CardSummary[] = [];
  const bothHaveExtras: CardSummary[] = [];

  for (const [id, card] of viewerOffered) {
    if (friendOwned.has(id)) continue;
    if (input.friendWishlist.length === 0 || friendWants(card)) youHaveTheyWant.push(card);
  }
  for (const [id, card] of friendOffered) {
    if (viewerOwned.has(id)) continue;
    if (input.viewerWishlist.length === 0 || viewerWants(card)) theyHaveYouWant.push(card);
  }
  for (const [id, owned] of viewerOwned) {
    if (!friendOwned.has(id)) continue;
    const mine = viewerOffered.get(id);
    const theirs = friendOffered.get(id);
    if ((mine?.quantity ?? 0) >= 2 || (theirs?.quantity ?? 0) >= 2) {
      bothHaveExtras.push(mine ?? { ...owned, quantity: 0 });
    }
  }

  const byName = (a: CardSummary, b: CardSummary) => a.name.localeCompare(b.name);
  youHaveTheyWant.sort(byName);
  theyHaveYouWant.sort(byName);
  bothHaveExtras.sort(byName);

  return { youHaveTheyWant, theyHaveYouWant, bothHaveExtras };
}
