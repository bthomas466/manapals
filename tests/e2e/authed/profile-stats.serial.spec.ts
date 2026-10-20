import { expect, test } from "@playwright/test";
import { hasE2ECredentials, requireE2EUser } from "../helpers";
import { restoreCollection, setCollection, snapshotCollection, type CollectionSnapshot } from "../supabase";

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

test("AC-6: an empty collection shows 0 cards, the empty-binder hint, and the page still renders", async ({ page }) => {
  await setCollection([]);
  await page.goto("/profile");
  await expect(page.getByTestId("stat-cards")).toHaveText(/^\s*0\s*Cards/);
  await expect(page.getByText("Your binder is empty. Tap Cards to add some.")).toBeVisible();
  await expect(page.getByTestId("stat-friends")).toBeVisible();
  await expect(page.getByTestId("stat-trades")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find a Friend" })).toBeVisible();
});
