import { expect, test, type Page } from "@playwright/test";
import { hasE2ECredentials, requireE2EUser } from "../helpers";
import { RENDER_BATCH_SIZE as B } from "../../../src/lib/collection/batches";
import {
  CARDS,
  e2eSession,
  cardId,
  restoreCollection,
  setCollection,
  snapshotCollection,
  type CollectionSnapshot,
  type FixtureRow,
} from "../supabase";

// Writes a 1,250-row collection for e2e_player, so it runs in `authed-serial`.
// Snapshot/restore like trade-flags.serial.spec.ts. NOTE: snapshotCollection is
// capped at 1,000 rows; if a local run crashes mid-way, run `npm run seed:staging`.
requireE2EUser();
test.describe.configure({ mode: "serial" });

let snapshot: CollectionSnapshot | undefined;
let bigReady = false;

test.beforeAll(async () => {
  if (!hasE2ECredentials()) return;
  snapshot = await snapshotCollection();
});

test.afterAll(async () => {
  if (!hasE2ECredentials() || !snapshot) return;
  await restoreCollection(snapshot);
});

const bulk = (n: number) => `Bulk ${String(n).padStart(4, "0")}`;

function bigFixture(): FixtureRow[] {
  const rows: FixtureRow[] = [];
  for (let i = 1; i <= 1248; i++) rows.push({ card: CARDS.solRing, binder: bulk(i) });
  rows.push({ card: CARDS.swords, binder: bulk(1249) });
  rows.push({ card: CARDS.cultivate, binder: bulk(1250), finish: "foil" });
  return rows;
}

/** Writes the big fixture once and proves the last two rows sit past the old 1,000-row cap. */
async function ensureBig() {
  if (bigReady) return;
  await setCollection(bigFixture());
  const { client, userId } = await e2eSession();
  for (const card of [CARDS.swords, CARDS.cultivate]) {
    const { data, error } = await client
      .from("collection_items")
      .select("id")
      .eq("user_id", userId)
      .eq("card_id", await cardId(card))
      .single();
    expect(error).toBeNull();
    const { count } = await client
      .from("collection_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lt("id", data!.id);
    expect(count).toBeGreaterThanOrEqual(1000);
  }
  bigReady = true;
}

const tiles = (page: Page) => page.getByRole("button", { name: /, Bulk \d{4}$/ });
const showMore = (page: Page) => page.getByRole("button", { name: "Show more", exact: true });
const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function loadMoreByTap(page: Page) {
  const before = await tiles(page).count();
  // dispatchEvent avoids Playwright's scroll-into-view also firing the observer.
  await showMore(page).dispatchEvent("click");
  await expect.poll(() => tiles(page).count()).toBeGreaterThan(before);
  return before;
}

test.describe("large collection", () => {
  test.beforeEach(async () => {
    await ensureBig();
  });

  test("AC-5: search finds a card that sits past the first 1,000 rows", async ({ page }) => {
    await page.goto("/collection");
    await page.getByPlaceholder("Search cards...").fill("Cultivate");
    await expect(tiles(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Cultivate, Bulk 1250" })).toBeVisible();
  });

  // #11 (collection summary) has not merged on this branch. Enable and assert the
  // summary total reads "1,250" once it does.
  test.skip("AC-6: summary total reads 1,250 (needs #11)", async () => {});

  test("AC-7: trade match does not list Swords as 'They have, you want' when the player owns it in row 1,249", async ({ page }) => {
    await page.goto("/trades/e2e_friend");
    await expect(page.getByRole("heading", { name: "They have, you want (0)" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Swords to Plowshares" })).toHaveCount(0);
  });

  test("AC-9: first render is capped at the batch size and shows Show more", async ({ page }) => {
    await page.goto("/collection");
    await expect(showMore(page)).toBeVisible();
    const n = await tiles(page).count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(B);
  });

  test("AC-10: scroll and Show more add tiles until everything is rendered", async ({ page }) => {
    await page.goto("/collection");
    await expect(showMore(page)).toBeVisible();
    expect(await tiles(page).count()).toBeLessThanOrEqual(B);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => tiles(page).count(), { timeout: 10_000 }).toBeGreaterThan(B);

    // Keep tapping until the button is gone; each tap adds at most B tiles.
    for (let i = 0; i < 40 && (await showMore(page).count()) > 0; i++) {
      const before = await tiles(page).count();
      await showMore(page).dispatchEvent("click").catch(() => {});
      await expect.poll(() => tiles(page).count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(before);
      expect(await tiles(page).count()).toBeLessThanOrEqual(before + B);
    }
    await expect(showMore(page)).toHaveCount(0);
    await expect(tiles(page)).toHaveCount(1250);
  });

  test("AC-11: the Foil chip filters the full list down to one tile with no Show more", async ({ page }) => {
    await page.goto("/collection");
    await chip(page, "Foil").click();
    await expect(tiles(page)).toHaveCount(1);
    await expect(showMore(page)).toHaveCount(0);
  });

  test("AC-12: changing search, chip or sort resets to the first batch", async ({ page }) => {
    await page.goto("/collection");
    await expect(showMore(page)).toBeVisible();

    const reload = async () => {
      await loadMoreByTap(page);
      expect(await tiles(page).count()).toBeGreaterThan(B);
    };

    await reload();
    await page.getByPlaceholder("Search cards...").fill("Sol");
    await expect.poll(() => tiles(page).count()).toBeLessThanOrEqual(B);

    await page.getByPlaceholder("Search cards...").fill("");
    await expect.poll(() => tiles(page).count()).toBeLessThanOrEqual(B);
    await reload();
    await chip(page, "Red").click();
    // Sol Ring is colorless, so Red matches nothing; the point is the batch reset.
    await expect.poll(() => tiles(page).count()).toBeLessThanOrEqual(B);
    await chip(page, "All").click();
    await expect.poll(() => tiles(page).count()).toBeLessThanOrEqual(B);

    await reload();
    await page.getByRole("combobox").selectOption("set");
    await expect.poll(() => tiles(page).count()).toBeLessThanOrEqual(B);
  });
});

test.describe("empty and small collections", () => {
  test("AC-17: an empty collection shows the import empty state, no Show more or error", async ({ page }) => {
    bigReady = false;
    await setCollection([]);
    await page.goto("/collection");
    await expect(page.getByText("No cards yet")).toBeVisible();
    await expect(showMore(page)).toHaveCount(0);
    await expect(page.getByText("Couldn't load")).toHaveCount(0);
  });
});
