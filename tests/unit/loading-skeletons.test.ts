import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CollectionLoading from "../../src/app/(main)/collection/loading";
import ProfileLoading from "../../src/app/(main)/profile/loading";
import TradesLoading from "../../src/app/(main)/trades/loading";
import WishlistLoading from "../../src/app/(main)/wishlist/loading";

const skeletons = [
  { name: "wishlist", label: "Loading wishlist", component: WishlistLoading, ac: "AC-15" },
  { name: "trades", label: "Loading trades", component: TradesLoading, ac: "AC-15" },
  { name: "profile", label: "Loading profile", component: ProfileLoading, ac: "AC-15" },
  { name: "collection", label: "Loading collection", component: CollectionLoading, ac: "AC-16" },
];

describe("loading skeletons", () => {
  for (const { name, label, component, ac } of skeletons) {
    it(`${ac}: ${name} is busy, labelled, and only pulses when motion is allowed`, () => {
      const html = renderToStaticMarkup(createElement(component));
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain(`aria-label="${label}"`);
      expect(html).toContain("motion-safe:animate-pulse");
      expect(html).not.toMatch(/(?<!motion-safe:)animate-pulse/);
    });
  }

  it("AC-16: the collection skeleton keeps its grid test id", () => {
    expect(renderToStaticMarkup(createElement(CollectionLoading))).toContain('data-testid="card-grid-skeleton"');
  });

  it("AC-15: the wishlist skeleton reuses the card grid skeleton", () => {
    expect(renderToStaticMarkup(createElement(WishlistLoading))).toContain('data-testid="card-grid-skeleton"');
  });
});
