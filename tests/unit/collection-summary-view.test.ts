import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CollectionSummaryView from "@/components/collection/CollectionSummary";
import { summarizeCollection } from "@/lib/collection/summary";

type Row = Parameters<typeof summarizeCollection>[0][number];

function row(id: string, price: number | null, quantity = 1): Row {
  return {
    quantity,
    finish: "nonfoil",
    card: { scryfall_id: id, price_usd: price, price_usd_foil: null } as unknown as Row["card"],
  };
}

const render = (items: Row[]) =>
  renderToStaticMarkup(createElement(CollectionSummaryView, { summary: summarizeCollection(items) }));

describe("CollectionSummary view", () => {
  it("AC-17: renders nothing for an empty collection", () => {
    expect(render([])).toBe("");
  });

  it("AC-14/15: renders a labelled region with counts, value and disclaimer", () => {
    const html = render([row("a", 2, 2), row("b", 1)]);
    expect(html).toContain('aria-label="Collection summary"');
    expect(html).toContain("3 cards");
    expect(html).toContain("2 unique");
    expect(html).toContain("~$5.00");
    expect(html).toContain("Estimated from Scryfall prices");
  });

  it("AC-18: shows the singular unpriced count", () => {
    expect(render([row("a", 1), row("b", null)])).toContain("1 card has no price");
  });

  it("AC-18: shows the plural unpriced count", () => {
    expect(render([row("a", 1), row("b", null, 3)])).toContain("3 cards have no price");
  });

  it("AC-18: shows no 'no price' text when everything is priced", () => {
    expect(render([row("a", 1), row("b", 2)])).not.toContain("no price");
  });

  it("AC-9: shows Value unavailable when nothing is priced", () => {
    const html = render([row("a", null), row("b", null)]);
    expect(html).toContain("Value unavailable");
    expect(html).not.toContain("~$");
  });

  it("AC-20: renders a large value with separators", () => {
    expect(render([row("a", 1234.5, 10)])).toContain("~$12,345.00");
  });
});
