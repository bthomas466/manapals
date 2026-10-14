import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CARD_GRID_CLASS, CARD_GRID_LADDER, cardGridColumns, cardTileWidth } from "@/lib/cards/grid";
import CollectionGrid, { type CollectionItem } from "@/components/collection/CollectionGrid";
import WishlistGrid from "@/components/wishlist/WishlistGrid";
import { MatchSection } from "@/components/trades/MatchSection";
import CollectionLoading from "../../src/app/(main)/collection/loading";
import type { WishlistItem } from "@/lib/wishlist/queries";
import type { CardSummary } from "@/lib/trades/match";

// Avoid loading next/navigation and the server action.
vi.mock("@/components/wishlist/WishlistRemoveButton", () => ({
  default: () => null,
}));

const root = join(__dirname, "..", "..");

function collectionItem(): CollectionItem {
  return {
    id: 1,
    quantity: 1,
    finish: "nonfoil",
    condition: "NM",
    binder_name: "Main",
    card: {
      scryfall_id: "a",
      name: "Sol Ring",
      set_code: "c21",
      rarity: "uncommon",
      colors: [],
      image_small: "https://example.test/a.jpg",
      image_normal: null,
      price_usd: 1,
      price_usd_foil: null,
    },
  };
}

function wishlistItem(): WishlistItem {
  return {
    id: 1,
    card_id: "a",
    oracle_id: null,
    match_mode: "specific",
    created_at: "2026-01-01",
    card: {
      scryfall_id: "a",
      name: "Sol Ring",
      set_code: "c21",
      collector_number: "1",
      image_small: "https://example.test/a.jpg",
      image_normal: null,
      price_usd: 1,
      price_usd_foil: null,
    },
  } as unknown as WishlistItem;
}

function matchCard(): CardSummary {
  return {
    scryfall_id: "a",
    oracle_id: null,
    name: "Sol Ring",
    set_code: "c21",
    image_small: "https://example.test/a.jpg",
    image_normal: null,
    quantity: 1,
    allFoil: false,
    price: 1,
  };
}

const gridAttr = `class="${CARD_GRID_CLASS}"`;

describe("cardGridColumns", () => {
  it("AC-1/AC-6: matches the approved ladder at the test viewports", () => {
    const expected: Record<number, number> = {
      375: 3, 412: 3, 639: 3, 640: 4, 768: 5, 1024: 6, 1280: 8, 1440: 8, 1920: 10,
    };
    for (const [width, cols] of Object.entries(expected)) {
      expect(cardGridColumns(Number(width)), `at ${width}px`).toBe(cols);
    }
  });

  it("AC-6: never decreases from 320 to 1920 and meets the minimums", () => {
    let prev = 0;
    for (let w = 320; w <= 1920; w++) {
      const cols = cardGridColumns(w);
      expect(cols).toBeGreaterThanOrEqual(prev);
      prev = cols;
    }
    expect(cardGridColumns(1024)).toBeGreaterThanOrEqual(5);
    expect(cardGridColumns(1440)).toBeGreaterThanOrEqual(7);
  });
});

describe("cardTileWidth", () => {
  it("AC-2: mobile tile widths are unchanged", () => {
    expect(cardTileWidth(375)).toBeGreaterThanOrEqual(107);
    expect(cardTileWidth(375)).toBeLessThanOrEqual(109);
    expect(cardTileWidth(412)).toBeGreaterThanOrEqual(119);
    expect(cardTileWidth(412)).toBeLessThanOrEqual(121);
  });

  it("AC-4: tiles are at most 200px wide from 640 to 1920", () => {
    for (let w = 640; w <= 1920; w++) {
      expect(cardTileWidth(w), `at ${w}px`).toBeLessThanOrEqual(200);
    }
  });

  it("AC-5: tiles are at least 100px wide from 375 to 1920", () => {
    for (let w = 375; w <= 1920; w++) {
      expect(cardTileWidth(w), `at ${w}px`).toBeGreaterThanOrEqual(100);
    }
  });
});

describe("CARD_GRID_CLASS", () => {
  it("starts with the unchanged mobile classes", () => {
    expect(CARD_GRID_CLASS.startsWith("grid grid-cols-3 gap-2.5")).toBe(true);
  });

  it("stays in sync with CARD_GRID_LADDER", () => {
    const tokens = CARD_GRID_CLASS.split(" ");
    for (const step of CARD_GRID_LADDER) {
      const token = step.prefix ? `${step.prefix}:grid-cols-${step.columns}` : `grid-cols-${step.columns}`;
      expect(tokens).toContain(token);
    }
  });
});

describe("grid wiring", () => {
  it("AC-7: CollectionGrid renders the shared grid, with and without onSelectItem", () => {
    const noop = () => {};
    for (const props of [{}, { onSelectItem: noop }]) {
      const html = renderToStaticMarkup(
        createElement(CollectionGrid, { items: [collectionItem()], emptyState: "empty", ...props })
      );
      expect(html).toContain(gridAttr);
      expect(html).toContain('data-testid="card-grid"');
    }
  });

  it("AC-7: WishlistGrid renders the shared grid", () => {
    const html = renderToStaticMarkup(
      createElement(WishlistGrid, { items: [wishlistItem()], editable: false, emptyState: "empty" })
    );
    expect(html).toContain(gridAttr);
    expect(html).toContain('data-testid="card-grid"');
  });

  it("AC-7: MatchSection renders the shared grid", () => {
    const html = renderToStaticMarkup(
      createElement(MatchSection, { title: "T", emptyText: "none", cards: [matchCard()] })
    );
    expect(html).toContain(gridAttr);
    expect(html).toContain('data-testid="card-grid"');
  });

  it("AC-8: the loading skeleton uses the shared grid and keeps its label", () => {
    const html = renderToStaticMarkup(createElement(CollectionLoading));
    expect(html).toContain('aria-label="Loading collection"');
    expect(html).toContain(gridAttr);
    expect(html).toContain('data-testid="card-grid-skeleton"');
  });

  it("AC-7: no source file still hard-codes the old grid class", () => {
    for (const file of [
      "src/components/collection/CollectionGrid.tsx",
      "src/components/wishlist/WishlistGrid.tsx",
      "src/components/trades/MatchSection.tsx",
      "src/app/(main)/collection/loading.tsx",
      "src/app/(main)/trades/[username]/page.tsx",
    ]) {
      expect(readFileSync(join(root, file), "utf8"), file).not.toContain("grid-cols-3 gap-2.5");
    }
  });
});

describe("empty states", () => {
  it("AC-12: an empty match section shows its text and no grid", () => {
    const html = renderToStaticMarkup(
      createElement(MatchSection, { title: "T", emptyText: "Nothing here", cards: [] })
    );
    expect(html).toContain("Nothing here");
    expect(html).not.toContain('data-testid="card-grid"');
  });

  it("AC-12: an empty collection renders only the empty state", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionGrid, { items: [], emptyState: createElement("p", null, "No cards yet") })
    );
    expect(html).toContain("No cards yet");
    expect(html).not.toContain('data-testid="card-grid"');
  });
});
