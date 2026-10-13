import { expect, test } from "@playwright/test";
import { requireE2EUser } from "../helpers";

// Relies on `npm run seed:staging`: e2e_player ↔ e2e_friend with fixed
// collections and wishlists. Treat seeded data as read-only — tests that
// mutate data must create and clean up their own rows.
requireE2EUser();

test("collection shows only your own cards", async ({ page }) => {
  await page.goto("/collection");
  for (const name of ["Sol Ring", "Arcane Signet", "Lightning Bolt", "Counterspell"]) {
    await expect(page.getByRole("img", { name })).toBeVisible();
  }
  // e2e_friend's cards are readable via the friends RLS policy, but must not
  // appear in your own collection.
  for (const name of ["Llanowar Elves", "Cultivate", "Swords to Plowshares"]) {
    await expect(page.getByRole("img", { name })).toHaveCount(0);
  }
  // AC-13: a small collection never shows the progressive-loading button.
  await expect(page.getByRole("button", { name: "Show more", exact: true })).toHaveCount(0);
});

test("AC-18: a non-friend with a friends-only collection sees the lock state and no Show more", async ({ page }) => {
  await page.goto("/u/e2e_stranger");
  await expect(page.getByText("Only friends can see this collection")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show more", exact: true })).toHaveCount(0);
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

test("AC-24: with no trade flags the offer line says whole collection", async ({ page }) => {
  await page.goto("/trades/e2e_friend");
  await expect(page.getByText("Offering: your whole collection")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit on Collection" })).toHaveAttribute("href", "/collection");
});

test("AC-25: a friend in opt-in mode does not offer their Unmarked cards", async ({ page }) => {
  await page.goto("/trades/e2e_friend");
  // Path to Exile is on the player's wishlist and the player doesn't own it, but
  // the friend only marked Swords to Plowshares Available.
  await expect(page.getByRole("heading", { name: "They have, you want (1)" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Swords to Plowshares" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Path to Exile" })).toHaveCount(0);
});
