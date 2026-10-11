import { expect, test } from "@playwright/test";
import { requireE2EUser } from "../helpers";

// Relies on `npm run seed:staging`: e2e_player ↔ e2e_friend with fixed
// collections and wishlists. Treat seeded data as read-only — tests that
// mutate data must create and clean up their own rows.
requireE2EUser();

test("collection shows the seeded cards", async ({ page }) => {
  await page.goto("/collection");
  for (const name of ["Sol Ring", "Arcane Signet", "Lightning Bolt", "Counterspell"]) {
    await expect(page.getByRole("img", { name })).toBeVisible();
  }
});

test("trade match fills every section from the seeded wishlists", async ({ page }) => {
  await page.goto("/trades/e2e_friend");
  await expect(page.getByRole("heading", { name: "You have, they want (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "They have, you want (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You both have extras (1)" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Arcane Signet" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Swords to Plowshares" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Sol Ring" })).toBeVisible();
});
