import { describe, expect, it } from "vitest";
import { unitPriceUsd } from "@/lib/cards/price";
import { formatCollectionSummary, summarizeCollection, type CollectionSummary } from "@/lib/collection/summary";

type Finish = "nonfoil" | "foil" | "etched";
type Row = Parameters<typeof summarizeCollection>[0][number];

let nextId = 1;

function row(
  opts: {
    id?: string;
    quantity?: number;
    finish?: Finish;
    price?: number | null;
    foil?: number | null;
    noCard?: boolean;
  } = {}
): Row {
  const id = opts.id ?? `card-${nextId++}`;
  return {
    quantity: opts.quantity ?? 1,
    finish: opts.finish ?? "nonfoil",
    card: opts.noCard
      ? null
      : ({
          scryfall_id: id,
          name: id,
          set_code: "tst",
          rarity: "common",
          colors: [],
          price_usd: opts.price ?? null,
          price_usd_foil: opts.foil ?? null,
        } as unknown as NonNullable<Row["card"]>),
  };
}

describe("summarizeCollection", () => {
  it("AC-1: totals cards and distinct printings", () => {
    const s = summarizeCollection([
      row({ id: "A", quantity: 2 }),
      row({ id: "A", finish: "foil" }),
      row({ id: "B" }),
    ]);
    expect(s.totalCards).toBe(4);
    expect(s.uniqueCards).toBe(2);
  });

  it("AC-2: the same printing in two binders counts once as unique", () => {
    const s = summarizeCollection([row({ id: "A", quantity: 3 }), row({ id: "A", quantity: 1 })]);
    expect(s.totalCards).toBe(4);
    expect(s.uniqueCards).toBe(1);
  });

  it("AC-3: nonfoil uses the regular price", () => {
    const s = summarizeCollection([row({ quantity: 3, price: 1.5, foil: 9 })]);
    expect(s.estimatedValueCents).toBe(450);
  });

  it("AC-4: foil uses the foil price", () => {
    const s = summarizeCollection([row({ finish: "foil", quantity: 2, price: 1, foil: 5.25 })]);
    expect(s.estimatedValueCents).toBe(1050);
  });

  it("AC-5: foil falls back to the regular price", () => {
    const s = summarizeCollection([row({ finish: "foil", price: 2, foil: null })]);
    expect(s.estimatedValueCents).toBe(200);
    expect(s.unpricedCards).toBe(0);
  });

  it("AC-6: etched follows the foil rule, including the fallback", () => {
    expect(summarizeCollection([row({ finish: "etched", foil: 7, price: 3 })]).estimatedValueCents).toBe(700);
    expect(summarizeCollection([row({ finish: "etched", foil: null, price: 3 })]).estimatedValueCents).toBe(300);
  });

  it("AC-7: nonfoil does not borrow the foil price", () => {
    const s = summarizeCollection([row({ quantity: 2, price: null, foil: 4 })]);
    expect(s.unpricedCards).toBe(2);
    expect(s.estimatedValueCents).toBeNull();
    // Alongside a priced row, the unpriced one adds nothing.
    const mixed = summarizeCollection([row({ quantity: 2, price: null, foil: 4 }), row({ price: 1 })]);
    expect(mixed.estimatedValueCents).toBe(100);
    expect(mixed.unpricedCards).toBe(2);
  });

  it("AC-8: missing prices do not break the total", () => {
    const s = summarizeCollection([row({ price: 1 }), row({ finish: "foil", quantity: 3 })]);
    expect(s.estimatedValueCents).toBe(100);
    expect(s.unpricedCards).toBe(3);
    expect(s.totalCards).toBe(4);
    expect(Number.isFinite(s.estimatedValueCents)).toBe(true);
    expect(Number.isNaN(s.totalCards)).toBe(false);
  });

  it("AC-9: with no priced cards the value is unavailable, not 0", () => {
    const s = summarizeCollection([row({ quantity: 2 }), row({ finish: "foil" })]);
    expect(s.estimatedValueCents).toBeNull();
    expect(s.unpricedCards).toBe(s.totalCards);
    expect(formatCollectionSummary(s).value).toBe("Value unavailable");
    expect(formatCollectionSummary(s).valueAvailable).toBe(false);
  });

  it("AC-10: empty input", () => {
    const s = summarizeCollection([]);
    expect(s).toMatchObject({ totalCards: 0, uniqueCards: 0, unpricedCards: 0, estimatedValueCents: null });
  });

  it("AC-11: sums without float drift", () => {
    const s = summarizeCollection([row({ price: 0.1 }), row({ price: 0.2 }), row({ price: 0.3 })]);
    expect(s.estimatedValueCents).toBe(60);
    expect(formatCollectionSummary(s).value).toBe("~$0.60");
  });

  it("AC-12: rows without card data count as total and unpriced, not unique", () => {
    const s = summarizeCollection([row({ noCard: true, quantity: 2 }), row({ id: "A", price: 1 })]);
    expect(s.totalCards).toBe(3);
    expect(s.uniqueCards).toBe(1);
    expect(s.unpricedCards).toBe(2);
    expect(s.estimatedValueCents).toBe(100);
  });
});

describe("formatCollectionSummary (AC-13)", () => {
  const base: CollectionSummary = {
    totalCards: 1214,
    uniqueCards: 873,
    pricedCards: 1214,
    unpricedCards: 0,
    estimatedValueCents: 243118,
  };

  it("formats thousands separators and the estimate prefix", () => {
    const f = formatCollectionSummary(base);
    expect(f.cards).toBe("1,214 cards");
    expect(f.unique).toBe("873 unique");
    expect(f.value).toBe("~$2,431.18");
    expect(f.valueAvailable).toBe(true);
    expect(f.note).toBe("Estimated from Scryfall prices");
  });

  it("uses singulars", () => {
    const f = formatCollectionSummary({ ...base, totalCards: 1, pricedCards: 0, unpricedCards: 1 });
    expect(f.cards).toBe("1 card");
    expect(f.note).toBe("Estimated from Scryfall prices · 1 card has no price");
  });

  it("uses plurals for the unpriced note", () => {
    const f = formatCollectionSummary({ ...base, pricedCards: 1202, unpricedCards: 12 });
    expect(f.note).toBe("Estimated from Scryfall prices · 12 cards have no price");
  });
});

describe("unitPriceUsd", () => {
  const prices = { price_usd: 1.5, price_usd_foil: 9 };
  it("foil and etched prefer the foil price", () => {
    expect(unitPriceUsd(prices, "foil")).toBe(9);
    expect(unitPriceUsd(prices, "etched")).toBe(9);
  });
  it("nonfoil uses the regular price", () => {
    expect(unitPriceUsd(prices, "nonfoil")).toBe(1.5);
  });
  it("nonfoil with only a foil price is null", () => {
    expect(unitPriceUsd({ price_usd: null, price_usd_foil: 4 }, "nonfoil")).toBeNull();
  });
  it("foil falls back to the regular price", () => {
    expect(unitPriceUsd({ price_usd: 2, price_usd_foil: null }, "foil")).toBe(2);
  });
  it("both null is null", () => {
    expect(unitPriceUsd({ price_usd: null, price_usd_foil: null }, "foil")).toBeNull();
  });
  it("coerces numeric strings and rejects non-finite values", () => {
    expect(unitPriceUsd({ price_usd: "1.50" as unknown as number, price_usd_foil: null }, "nonfoil")).toBe(1.5);
    expect(unitPriceUsd({ price_usd: "abc" as unknown as number, price_usd_foil: null }, "nonfoil")).toBeNull();
  });
});
