import { expect, test, type Locator, type Page } from "@playwright/test";
import { hasE2ECredentials, requireE2EUser } from "../helpers";
import {
  CARDS,
  importCollection,
  readFlags,
  restoreCollection,
  setCollection,
  snapshotCollection,
  type CollectionSnapshot,
  type FixtureRow,
} from "../supabase";

// Mutates e2e_player's collection, so it runs in the `authed-serial` project.
// The whole collection is snapshotted up front and restored afterwards; every
// test also sets its own fixture first and does not rely on a clean start.
requireE2EUser();
test.describe.configure({ mode: "serial" });

// UI saves are optimistic and the server action lands asynchronously, so any DB
// assertion that follows a UI-initiated write must wait for the write.
const pollStatus = (name: string) =>
  expect.poll(async () => (await readFlags()).find((r) => r.name === name)?.status, { timeout: 10_000 });
const pollBinder = (binder: string, predicate: (status: string | null) => boolean) =>
  expect.poll(async () => (await readFlags()).filter((r) => r.binder === binder).every((r) => predicate(r.status)), {
    timeout: 10_000,
  });

let snapshot: CollectionSnapshot | undefined;

test.beforeAll(async () => {
  if (!hasE2ECredentials()) return;
  snapshot = await snapshotCollection();
});

test.afterAll(async () => {
  if (!hasE2ECredentials() || !snapshot) return;
  await restoreCollection(snapshot);
});

const { solRing, arcaneSignet, lightningBolt, counterspell, swords, llanowar } = CARDS;

// --- locators ---------------------------------------------------------------

const tileButton = (page: Page, name: string, binder = "No binder") =>
  page.getByRole("button", { name: `${name}, ${binder}`, exact: true });

// The badge is a sibling of the overlay button inside the tile.
const tile = (page: Page, name: string, binder?: string) => tileButton(page, name, binder).locator("..");

const cardDialog = (page: Page, name: string) => page.getByRole("dialog", { name: `Trade status for ${name}` });
const radio = (dialog: Locator, name: string) => dialog.getByRole("radio", { name, exact: true });
const settingsDialog = (page: Page) => page.getByRole("dialog", { name: "Trade settings" });
const binderGroup = (page: Page, name: string) => settingsDialog(page).getByRole("group", { name, exact: true });
const confirmDialog = (page: Page) => page.getByRole("alertdialog");
const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const anyTile = (page: Page, binder: string) => page.getByRole("button", { name: new RegExp(`, ${binder}$`) });

async function openCard(page: Page, name: string, binder?: string) {
  await tileButton(page, name, binder).click();
  const dialog = cardDialog(page, name);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeCard(dialog: Locator) {
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
}

async function openTradeSettings(page: Page) {
  await page.getByRole("button", { name: "Trade settings" }).click();
  await expect(settingsDialog(page)).toBeVisible();
}

const row = (card: FixtureRow["card"], extra: Omit<FixtureRow, "card"> = {}): FixtureRow => ({ card, ...extra });

// --- Marking on /collection -------------------------------------------------

test.describe("marking a card", () => {
  test("AC-9: tapping a tile opens a dialog with name, finish, binder, quantity and the 3-option control", async ({ page }) => {
    await setCollection([
      row(solRing, { quantity: 2, binder: "Trade" }),
      row(lightningBolt, { finish: "foil" }),
      row(arcaneSignet),
    ]);
    await page.goto("/collection");

    const dialog = await openCard(page, "Sol Ring", "Trade");
    await expect(dialog.getByRole("heading", { name: "Sol Ring" })).toBeVisible();
    await expect(dialog).toContainText("Nonfoil");
    await expect(dialog).toContainText("Trade");
    await expect(dialog).toContainText("Qty 2");
    const group = dialog.getByRole("radiogroup", { name: "Trade status" });
    await expect(group.getByRole("radio")).toHaveText(["Available to trade", "Unmarked", "Not for trade"]);
    await expect(radio(dialog, "Unmarked")).toBeChecked();
    await expect(radio(dialog, "Available to trade")).not.toBeChecked();
    await expect(radio(dialog, "Not for trade")).not.toBeChecked();
    await closeCard(dialog);

    // Foil finish and the "No binder" fallback.
    const foilDialog = await openCard(page, "Lightning Bolt");
    await expect(foilDialog).toContainText("Foil");
    await expect(foilDialog).not.toContainText("Nonfoil");
    await expect(foilDialog).toContainText("No binder");
    await expect(foilDialog).toContainText("Qty 1");
  });

  test("AC-10: choosing Not for trade shows the badge and survives a reload", async ({ page }) => {
    await setCollection([row(solRing, { status: "available" }), row(arcaneSignet)]);
    await page.goto("/collection");

    const dialog = await openCard(page, "Arcane Signet");
    await radio(dialog, "Not for trade").click();
    await expect(radio(dialog, "Not for trade")).toBeChecked();
    await expect(tile(page, "Arcane Signet").getByText("Not for trade", { exact: true })).toBeVisible();
    await pollStatus("Arcane Signet").toBe("not_for_trade");

    await page.reload();
    await expect(tile(page, "Arcane Signet").getByText("Not for trade", { exact: true })).toBeVisible();
    const reopened = await openCard(page, "Arcane Signet");
    await expect(radio(reopened, "Not for trade")).toBeChecked();
    await pollStatus("Arcane Signet").toBe("not_for_trade");
  });

  test("AC-11: the first Available flag asks for confirmation; Cancel keeps Unmarked, Confirm saves", async ({ page }) => {
    await setCollection([row(solRing), row(arcaneSignet)]);
    await page.goto("/collection");

    let dialog = await openCard(page, "Sol Ring");
    await radio(dialog, "Available to trade").click();
    await expect(confirmDialog(page)).toBeVisible();
    await expect(confirmDialog(page)).toContainText("only cards you mark Available");

    await confirmDialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog(page)).toBeHidden();
    await expect(radio(dialog, "Unmarked")).toBeChecked();
    await expect(tile(page, "Sol Ring").getByText("Available", { exact: true })).toHaveCount(0);
    expect((await readFlags()).every((r) => r.status === null)).toBe(true);

    await radio(dialog, "Available to trade").click();
    await confirmDialog(page).getByRole("button", { name: "Confirm" }).click();
    await expect(tile(page, "Sol Ring").getByText("Available", { exact: true })).toBeVisible();
    await expect(radio(dialog, "Available to trade")).toBeChecked();
    await closeCard(dialog);
    await pollStatus("Sol Ring").toBe("available");

    // A second Available flag needs no confirmation.
    dialog = await openCard(page, "Arcane Signet");
    await radio(dialog, "Available to trade").click();
    await expect(tile(page, "Arcane Signet").getByText("Available", { exact: true })).toBeVisible();
    await expect(confirmDialog(page)).toHaveCount(0);
    await pollStatus("Arcane Signet").toBe("available");
  });

  test("AC-12: choosing Unmarked removes the badge, also after a reload", async ({ page }) => {
    await setCollection([row(solRing, { status: "available" }), row(arcaneSignet)]);
    await page.goto("/collection");
    await expect(tile(page, "Sol Ring").getByText("Available", { exact: true })).toBeVisible();

    const dialog = await openCard(page, "Sol Ring");
    await expect(radio(dialog, "Available to trade")).toBeChecked();
    await radio(dialog, "Unmarked").click();
    await expect(radio(dialog, "Unmarked")).toBeChecked();
    await expect(tile(page, "Sol Ring").getByText("Available", { exact: true })).toHaveCount(0);
    await pollStatus("Sol Ring").toBeNull();

    await page.reload();
    await expect(tileButton(page, "Sol Ring")).toBeVisible();
    await expect(tile(page, "Sol Ring").getByText("Available", { exact: true })).toHaveCount(0);
    await pollStatus("Sol Ring").toBeNull();
  });

  test("AC-13: the For trade / Not for trade chips filter the grid", async ({ page }) => {
    await setCollection([
      row(solRing, { status: "available" }),
      row(arcaneSignet, { status: "not_for_trade" }),
      row(counterspell),
    ]);
    await page.goto("/collection");

    await chip(page, "For trade").click();
    await expect(chip(page, "For trade")).toHaveAttribute("aria-pressed", "true");
    await expect(tileButton(page, "Sol Ring")).toBeVisible();
    await expect(tileButton(page, "Arcane Signet")).toHaveCount(0);
    await expect(tileButton(page, "Counterspell")).toHaveCount(0);

    await chip(page, "Not for trade").click();
    await expect(chip(page, "Not for trade")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "For trade")).toHaveAttribute("aria-pressed", "false");
    await expect(tileButton(page, "Arcane Signet")).toBeVisible();
    await expect(tileButton(page, "Sol Ring")).toHaveCount(0);
    await expect(tileButton(page, "Counterspell")).toHaveCount(0);
  });

  test("AC-14: a failed save shows the error and reverts the badge and selection", async ({ page }) => {
    await setCollection([row(solRing, { status: "available" }), row(arcaneSignet)]);
    await page.goto("/collection");

    await page.route("**/collection", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        await route.fulfill({ status: 500, contentType: "text/plain", body: "boom" });
      } else {
        await route.continue();
      }
    });

    try {
      const dialog = await openCard(page, "Arcane Signet");
      await radio(dialog, "Not for trade").click();
      await expect(dialog.getByRole("alert")).toHaveText("Couldn't update trade status");
      await expect(radio(dialog, "Unmarked")).toBeChecked();
      await expect(radio(dialog, "Not for trade")).not.toBeChecked();
      await expect(tile(page, "Arcane Signet").getByText("Not for trade", { exact: true })).toHaveCount(0);
      expect((await readFlags()).find((r) => r.name === "Arcane Signet")?.status).toBeNull();
    } finally {
      await page.unroute("**/collection");
    }
  });
});

// --- Bulk by binder ---------------------------------------------------------

const deckAFixture = (extra: Omit<FixtureRow, "card"> = {}) =>
  [solRing, arcaneSignet, lightningBolt, counterspell, swords].map((c) => row(c, { binder: "Deck A", ...extra }));
const tradeFixture = (extra: Omit<FixtureRow, "card"> = {}) =>
  [solRing, arcaneSignet, lightningBolt].map((c) => row(c, { binder: "Trade", ...extra }));

test.describe("bulk by binder", () => {
  test("AC-15: Trade settings lists exactly the non-empty binders with row counts", async ({ page }) => {
    await setCollection([...deckAFixture(), ...tradeFixture(), row(counterspell), row(llanowar)]);
    await page.goto("/collection");
    await openTradeSettings(page);

    await expect(settingsDialog(page).getByRole("group")).toHaveCount(2);
    await expect(binderGroup(page, "Deck A")).toContainText("5 entries");
    await expect(binderGroup(page, "Trade")).toContainText("3 entries");
    for (const group of ["Deck A", "Trade"]) {
      for (const action of ["Available", "Not for trade", "Clear"]) {
        await expect(binderGroup(page, group).getByRole("button", { name: action, exact: true })).toBeVisible();
      }
    }
  });

  test("AC-16: Not for trade on a binder toasts the count and flags exactly those tiles", async ({ page }) => {
    await setCollection([...deckAFixture(), ...tradeFixture()]);
    await page.goto("/collection");
    await openTradeSettings(page);

    await binderGroup(page, "Deck A").getByRole("button", { name: "Not for trade", exact: true }).click();
    const toast = page.getByRole("status");
    await expect(toast).toContainText("5 entries updated");

    await settingsDialog(page).getByRole("button", { name: "Close" }).click();
    await chip(page, "Not for trade").click();
    await expect(anyTile(page, "Deck A")).toHaveCount(5);
    await expect(anyTile(page, "Trade")).toHaveCount(0);

    await pollBinder("Deck A", (s) => s === "not_for_trade").toBe(true);
    expect((await readFlags()).filter((r) => r.binder === "Trade").every((r) => r.status === null)).toBe(true);

    // The toast dismisses itself (4s).
    await expect(toast).not.toContainText("entries updated", { timeout: 8000 });
  });

  test("AC-17: Available on a binder asks for confirmation before anything is written", async ({ page }) => {
    await setCollection([...deckAFixture(), ...tradeFixture()]);
    await page.goto("/collection");
    await openTradeSettings(page);

    await binderGroup(page, "Trade").getByRole("button", { name: "Available", exact: true }).click();
    await expect(confirmDialog(page)).toBeVisible();
    await expect(confirmDialog(page)).toContainText("only cards you mark Available");
    expect((await readFlags()).every((r) => r.status === null)).toBe(true);

    await confirmDialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog(page)).toBeHidden();
    expect((await readFlags()).every((r) => r.status === null)).toBe(true);

    // Confirming writes the whole binder.
    await binderGroup(page, "Trade").getByRole("button", { name: "Available", exact: true }).click();
    await confirmDialog(page).getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("status")).toContainText("3 entries updated");
    await pollBinder("Trade", (s) => s === "available").toBe(true);
    expect((await readFlags()).filter((r) => r.binder === "Deck A").every((r) => r.status === null)).toBe(true);
  });

  test("AC-18: Clear resets one binder and leaves the others flagged", async ({ page }) => {
    await setCollection([
      ...deckAFixture({ status: "not_for_trade" }),
      row(solRing, { binder: "Trade", status: "available" }),
      row(arcaneSignet, { binder: "Trade" }),
    ]);
    await page.goto("/collection");
    await openTradeSettings(page);

    await binderGroup(page, "Deck A").getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("5 entries updated");
    await expect(confirmDialog(page)).toHaveCount(0);

    await pollBinder("Deck A", (s) => s === null).toBe(true);
    const flags = await readFlags();
    expect(flags.filter((r) => r.binder === "Deck A")).toHaveLength(5);
    expect(flags.find((r) => r.binder === "Trade" && r.name === "Sol Ring")?.status).toBe("available");

    await settingsDialog(page).getByRole("button", { name: "Close" }).click();
    await chip(page, "Not for trade").click();
    await expect(page.getByText("No cards match your filters.")).toBeVisible();
  });

  test("AC-19: no binders shows the empty message and no bulk actions", async ({ page }) => {
    await setCollection([row(solRing), row(arcaneSignet)]);
    await page.goto("/collection");
    await openTradeSettings(page);

    await expect(settingsDialog(page)).toContainText("No Manabox binders found in your import");
    await expect(settingsDialog(page).getByRole("group")).toHaveCount(0);
    for (const action of ["Available", "Not for trade", "Clear"]) {
      await expect(settingsDialog(page).getByRole("button", { name: action, exact: true })).toHaveCount(0);
    }
  });

  test("AC-20: an empty collection hides Trade settings and keeps the import empty state", async ({ page }) => {
    await setCollection([]);
    await page.goto("/collection");

    await expect(page.getByText("No cards yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Import Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trade settings" })).toHaveCount(0);
  });
});

// --- Re-import (replace_collection_items RPC) -------------------------------

test.describe("re-import keeps flags", () => {
  test("AC-21: a re-import of the same (card, finish, binder) keeps Not for trade", async () => {
    await setCollection([row(solRing, { binder: "Deck A", status: "not_for_trade" })]);

    await importCollection([row(solRing, { binder: "Deck A", quantity: 3, condition: "lightly_played" })]);

    const rows = await readFlags();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Sol Ring",
      binder: "Deck A",
      quantity: 3,
      condition: "lightly_played",
      status: "not_for_trade",
    });
  });

  test("AC-22: a card that moved binder arrives Unmarked and the old flag is gone", async () => {
    await setCollection([row(solRing, { binder: "Deck A", status: "available" })]);

    await importCollection([row(solRing, { binder: "Trade" })]);

    const rows = await readFlags();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ binder: "Trade", status: null });
    expect(rows.some((r) => r.binder === "Deck A")).toBe(false);

    // Moving back must not resurrect the dropped flag.
    await importCollection([row(solRing, { binder: "Deck A" })]);
    expect((await readFlags())[0]).toMatchObject({ binder: "Deck A", status: null });
  });
});

// --- Trade Match page -------------------------------------------------------

test.describe("trade match offer line", () => {
  const section = (page: Page, title: string) => page.locator("section").filter({ hasText: title });

  test("AC-23: opt-in mode offers only Available cards and says so", async ({ page }) => {
    await setCollection([row(solRing, { status: "available" }), row(arcaneSignet), row(counterspell)]);
    await page.goto("/trades/e2e_friend");

    await expect(page.getByText("Offering: 1 card you marked Available")).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit on Collection" })).toHaveAttribute("href", "/collection");
    // The friend wants Arcane Signet, but it is not marked Available, so it is not offered.
    await expect(page.getByRole("heading", { name: "You have, they want (0)" })).toBeVisible();
    await expect(section(page, "You have, they want").getByRole("img")).toHaveCount(0);
    // Sol Ring is offered once (1 copy) and the friend has 1, so no shared extras.
    await expect(page.getByRole("heading", { name: "You both have extras (0)" })).toBeVisible();
  });

  test("AC-24: with only Not for trade flags it offers the collection except those entries", async ({ page }) => {
    await setCollection([
      row(solRing, { quantity: 2, status: "not_for_trade" }),
      row(arcaneSignet, { status: "not_for_trade" }),
      row(counterspell),
    ]);
    await page.goto("/trades/e2e_friend");

    await expect(page.getByText("Offering: your collection except 2 not-for-trade entries")).toBeVisible();
    // Arcane Signet is the only card the friend wants, and it is excluded.
    await expect(page.getByRole("heading", { name: "You have, they want (0)" })).toBeVisible();
    // The friend owns 1 Sol Ring and we own 2, but ours are Not for trade, so no shared extra.
    await expect(page.getByRole("heading", { name: "You both have extras (0)" })).toBeVisible();
  });

  test("AC-26: the empty 'You have, they want' text links to Collection", async ({ page }) => {
    await setCollection([row(solRing, { status: "available" }), row(arcaneSignet)]);
    await page.goto("/trades/e2e_friend");

    await expect(page.getByRole("heading", { name: "You have, they want (0)" })).toBeVisible();
    await expect(section(page, "You have, they want").getByRole("link", { name: "mark cards for trade" })).toHaveAttribute(
      "href",
      "/collection"
    );
  });
});
