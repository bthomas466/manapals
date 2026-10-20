import { expect, test } from "@playwright/test";
import { requireE2EUser } from "../helpers";

// Relies on `npm run seed:staging`: e2e_player owns 5 cards (Sol Ring x2, Arcane Signet,
// Lightning Bolt, Counterspell), is friends with e2e_friend only (who owns 7 cards),
// and has 2 trade matches (Arcane Signet + Swords to Plowshares).
requireE2EUser();

test("AC-3: the Cards tile shows my real card count, not 0", async ({ page }) => {
  await page.goto("/profile");
  const cards = page.getByTestId("stat-cards");
  await expect(cards).toBeVisible();
  await expect(cards).toContainText("5");
  await expect(cards).not.toContainText("0");
});

test("AC-4: Trades shows 2 and Friends shows 1", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByTestId("stat-trades")).toContainText("2");
  await expect(page.getByTestId("stat-trades")).toContainText("Trades");
  await expect(page.getByTestId("stat-friends")).toContainText("1");
  await expect(page.getByTestId("stat-friends")).toContainText("Friends");
});

test("AC-8: the Cards tile shows only my count, not my friend's or a combined total", async ({ page }) => {
  await page.goto("/profile");
  const cards = page.getByTestId("stat-cards");
  await expect(cards).toHaveText(/^\s*5\s*Cards/);
  // e2e_friend owns 7; a combined total would be 12.
  await expect(cards).not.toContainText("7");
  await expect(cards).not.toContainText("12");
});

test("AC-5: tapping the Cards tile opens Collection, and the tile is at least 44px tall", async ({ page }) => {
  await page.goto("/profile");
  const tile = page.getByRole("link", { name: /Cards/ });
  await expect(tile).toBeVisible();
  const box = await tile.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await tile.click();
  await expect(page).toHaveURL(/\/collection$/);
});

test("AC-17: /profile has no horizontal scroll at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/profile");
  await expect(page.getByTestId("stat-cards")).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});
