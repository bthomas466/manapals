import { expect, test } from "@playwright/test";
import { requireE2EUser } from "../helpers";
import { readOwnCollectionForSummary } from "../supabase";
import { formatCollectionSummary, summarizeCollection } from "../../../src/lib/collection/summary";

// Read-only checks against the seeded e2e_player collection:
// Sol Ring x2, Arcane Signet, Lightning Bolt (foil), Counterspell.
requireE2EUser();

const summaryRegion = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Collection summary" });

test("AC-14: summary shows the seeded totals above the search box", async ({ page }) => {
  await page.goto("/collection");
  const region = summaryRegion(page);
  await expect(region).toBeVisible();
  await expect(region).toContainText("5 cards");
  await expect(region).toContainText("4 unique");
  await expect(region).toContainText(/~\$\d[\d,]*\.\d{2}|Value unavailable/);

  // Expected value computed from the same DB rows the page reads.
  const expected = formatCollectionSummary(summarizeCollection(await readOwnCollectionForSummary()));
  await expect(region).toContainText(expected.value);

  const search = page.getByPlaceholder("Search cards...");
  const regionBox = await region.boundingBox();
  const searchBox = await search.boundingBox();
  expect(regionBox!.y + regionBox!.height).toBeLessThanOrEqual(searchBox!.y);
});

test("AC-15: the estimate disclaimer is inside the summary", async ({ page }) => {
  await page.goto("/collection");
  await expect(summaryRegion(page).getByText("Estimated from Scryfall prices")).toBeVisible();
});

test("AC-16: search and chips do not change the summary", async ({ page }) => {
  await page.goto("/collection");
  const region = summaryRegion(page);
  await expect(region).toContainText("5 cards");
  const before = await region.innerText();

  await page.getByPlaceholder("Search cards...").fill("Sol Ring");
  await page.getByRole("button", { name: "Foil", exact: true }).click();
  await expect(page.getByRole("button", { name: "Foil", exact: true })).toHaveAttribute("aria-pressed", "true");
  // The grid has narrowed (Sol Ring is nonfoil, so nothing matches Foil + "Sol Ring").
  await expect(page.getByRole("button", { name: /^Sol Ring, / })).toHaveCount(0);

  await expect(region).toContainText("5 cards");
  await expect(region).toContainText("4 unique");
  expect(await region.innerText()).toBe(before);
});

test("AC-19: totals are only the player's own; friend profile has no summary", async ({ page }) => {
  await page.goto("/collection");
  await expect(summaryRegion(page)).toContainText("5 cards");

  await page.goto("/u/e2e_friend");
  await expect(page.getByRole("img", { name: "Llanowar Elves" })).toBeVisible();
  await expect(summaryRegion(page)).toHaveCount(0);
});
