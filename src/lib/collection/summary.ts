import type { CollectionItem } from "@/components/collection/CollectionGrid";
import { unitPriceUsd } from "@/lib/cards/price";

export type CollectionSummary = {
  totalCards: number;
  uniqueCards: number;
  pricedCards: number;
  unpricedCards: number;
  estimatedValueCents: number | null;
};

export function summarizeCollection(
  items: Pick<CollectionItem, "quantity" | "finish" | "card">[]
): CollectionSummary {
  let totalCards = 0;
  let pricedCards = 0;
  let cents = 0;
  const unique = new Set<string>();

  for (const item of items) {
    const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
    totalCards += qty;
    if (!item.card) continue;
    unique.add(item.card.scryfall_id);
    const price = unitPriceUsd(item.card, item.finish);
    if (price === null) continue;
    pricedCards += qty;
    cents += Math.round(price * 100) * qty;
  }

  return {
    totalCards,
    uniqueCards: unique.size,
    pricedCards,
    unpricedCards: totalCards - pricedCards,
    estimatedValueCents: pricedCards === 0 ? null : cents,
  };
}

export type FormattedSummary = {
  cards: string;
  unique: string;
  value: string;
  valueAvailable: boolean;
  note: string;
};

const number = new Intl.NumberFormat("en-US");
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCollectionSummary(s: CollectionSummary): FormattedSummary {
  const valueAvailable = s.estimatedValueCents !== null;
  let note = "Estimated from Scryfall prices";
  if (s.unpricedCards > 0) {
    note += ` · ${number.format(s.unpricedCards)} ${s.unpricedCards === 1 ? "card has" : "cards have"} no price`;
  }
  return {
    cards: `${number.format(s.totalCards)} ${s.totalCards === 1 ? "card" : "cards"}`,
    unique: `${number.format(s.uniqueCards)} unique`,
    value: s.estimatedValueCents !== null ? `~${currency.format(s.estimatedValueCents / 100)}` : "Value unavailable",
    valueAvailable,
    note,
  };
}
