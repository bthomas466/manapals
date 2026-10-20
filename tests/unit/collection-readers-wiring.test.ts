import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CollectionLoadError from "@/components/collection/CollectionLoadError";

const root = join(__dirname, "..", "..");
const pages = [
  "src/app/(main)/collection/page.tsx",
  "src/app/(main)/trades/[username]/page.tsx",
  "src/app/(main)/u/[username]/page.tsx",
  "src/app/(main)/profile/page.tsx",
];

describe("page wiring", () => {
  for (const file of pages) {
    it(`AC-8: ${file} reads collections only through the shared reader`, () => {
      const src = readFileSync(join(root, file), "utf8");
      expect(src).not.toMatch(/from\(\s*["']collection_items["']\s*\)/);
      expect(src).toContain("getCollectionItems");
    });
  }
});

describe("CollectionLoadError", () => {
  it("AC-16: renders an alert with the title and a Try again button", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionLoadError, { title: "Couldn't load your collection" })
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn&#x27;t load your collection");
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/);
  });

  it("AC-16: the trades/profile variant names the other user", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionLoadError, { title: "Couldn't load E2E Friend's collection" })
    );
    expect(html).toContain("Couldn&#x27;t load E2E Friend&#x27;s collection");
    expect(html).toContain("Try again");
  });
});
