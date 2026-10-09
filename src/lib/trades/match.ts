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

// "Available to trade" flags (US-11/12) don't exist yet, so the offering
// side always falls back to the full collection (PRD §4.6). The wanting
// side narrows to the other user's wishlist once they have one — an empty
// wishlist still means "wants everything," so existing matches are
// unaffected until a user actually adds wishlist items.
export function computeTradeMatches(input: {
  viewerItems: CollectionItemWithOracle[];
  friendItems: CollectionItemWithOracle[];
  viewerWishlist: WishlistItem[];
  friendWishlist: WishlistItem[];
}): TradeMatches {
  const viewerMap = aggregateByCard(input.viewerItems);
  const friendMap = aggregateByCard(input.friendItems);
  const viewerWants = buildWantMatcher(input.viewerWishlist);
  const friendWants = buildWantMatcher(input.friendWishlist);

  const youHaveTheyWant: CardSummary[] = [];
  const theyHaveYouWant: CardSummary[] = [];
  const bothHaveExtras: CardSummary[] = [];

  for (const [id, card] of viewerMap) {
    const theirs = friendMap.get(id);
    if (!theirs) {
      if (input.friendWishlist.length === 0 || friendWants(card)) youHaveTheyWant.push(card);
    } else if (card.quantity > 1 || theirs.quantity > 1) {
      bothHaveExtras.push(card);
    }
  }
  for (const [id, card] of friendMap) {
    if (!viewerMap.has(id)) {
      if (input.viewerWishlist.length === 0 || viewerWants(card)) theyHaveYouWant.push(card);
    }
  }

  const byName = (a: CardSummary, b: CardSummary) => a.name.localeCompare(b.name);
  youHaveTheyWant.sort(byName);
  theyHaveYouWant.sort(byName);
  bothHaveExtras.sort(byName);

  return { youHaveTheyWant, theyHaveYouWant, bothHaveExtras };
}
