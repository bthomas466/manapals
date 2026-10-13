export type CardPrices = {
  price_usd: number | null;
  price_usd_foil: number | null;
};

function toPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// The one price rule: foil and etched use the foil price, falling back to the
// regular price; nonfoil uses the regular price only.
export function unitPriceUsd(card: CardPrices, finish: "nonfoil" | "foil" | "etched"): number | null {
  const regular = toPrice(card.price_usd);
  if (finish === "nonfoil") return regular;
  return toPrice(card.price_usd_foil) ?? regular;
}
