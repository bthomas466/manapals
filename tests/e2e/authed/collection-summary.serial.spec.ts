import { expect, test } from "@playwright/test";
import { hasE2ECredentials, requireE2EUser } from "../helpers";
import {
  CARDS,
  cardPrices,
  restoreCollection,
  setCollection,
  snapshotCollection,
  type CollectionSnapshot,
} from "../supabase";

// Mutates e2e_player's collection, so it runs in the `authed-serial` project.
requireE2EUser();
test.describe.configure({ mode: "serial" });

let snapshot: CollectionSnapshot | undefined;

test.beforeAll(async () => {
  if (!hasE2ECredentials()) return;
  snapshot = await snapshotCollection();
});

test.afterAll(async () => {
  if (!hasE2ECredentials() || !snapshot) return;
  await restoreCollection(snapshot);
});

test("AC-17: an empty collection shows no summary, only the empty state", async ({ page }) => {
  await setCollection([]);
  await page.goto("/collection");
  await expect(page.getByText("No cards yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Import Collection" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Collection summary" })).toHaveCount(0);
});

test("AC-20: a large collection value fits a 375px viewport without horizontal scroll", async ({ page }) => {
  const { price_usd } = await cardPrices(CARDS.solRing);
  const quantity = price_usd && price_usd > 0 ? Math.ceil(10_000 / price_usd) + 1 : 99_999;
  await setCollection([
    { card: CARDS.solRing, quantity },
    { card: CARDS.lightningBolt, finish: "foil" },
  ]);

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/collection");
  const region = page.getByRole("region", { name: "Collection summary" });
  await expect(region).toBeVisible();
  if (price_usd && price_usd > 0) {
    await expect(region).toContainText(/~\$\d{2,3},\d{3}\.\d{2}/);
  }
  await expect(region).toContainText(`${(quantity + 1).toLocaleString("en-US")} cards`);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});
