import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hasE2ECredentials, requireE2EUser } from "../helpers";
import {
  CARDS,
  e2eSession,
  readFlags,
  readProfile,
  restoreCollection,
  restoreProfile,
  setCollection,
  setOnboardedAt,
  snapshotCollection,
  snapshotProfile,
  updateProfileRow,
  type CollectionSnapshot,
  type ProfileSnapshot,
} from "../supabase";
import { MANABOX_EXPORT_STEPS } from "../../../src/lib/onboarding/manaboxInstructions";

// Mutates e2e_player's profile and collection, so it runs in `authed-serial`.
requireE2EUser();
test.describe.configure({ mode: "serial" });

const VALID_CSV = path.join(__dirname, "..", "fixtures", "onboarding-valid.csv");
const NO_ROWS_CSV = path.join(__dirname, "..", "fixtures", "onboarding-no-rows.csv");
const FIXTURE_CARDS = 3; // Sol Ring, Lightning Bolt, Not A Real Card
const FIXTURE_IMPORTED = 2;

let profileSnap: ProfileSnapshot | undefined;
let collectionSnap: CollectionSnapshot | undefined;

test.beforeAll(async () => {
  if (!hasE2ECredentials()) return;
  profileSnap = await snapshotProfile();
  collectionSnap = await snapshotCollection();
});

test.afterAll(async () => {
  if (!hasE2ECredentials()) return;
  if (profileSnap) await restoreProfile(profileSnap);
  if (collectionSnap) await restoreCollection(collectionSnap);
});

/** Known starting point for every test: seeded identity, marker cleared, empty collection. */
test.beforeEach(async () => {
  await updateProfileRow({
    username: profileSnap!.username,
    display_name: profileSnap!.display_name,
    avatar_url: null,
    collection_visibility: "friends",
    onboarded_at: null,
  });
  await setCollection([]);
});

const step1 = (page: Page) => page.getByText("Step 1 of 2");
const step2 = (page: Page) => page.getByText("Step 2 of 2");

async function goToStep2(page: Page) {
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(step2(page)).toBeVisible();
}

async function pickFile(page: Page, file: string) {
  await page.locator('input[type="file"]').setInputFiles(file);
}

test("AC-1/AC-2/AC-8: every main page is gated to the wizard, and step 1 has no Skip", async ({ page }) => {
  for (const p of ["/collection", "/", "/trades", "/wishlist", "/profile", "/u/e2e_friend"]) {
    await page.goto(p);
    await expect(page, p).toHaveURL(/\/welcome$/);
    await expect(step1(page)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /skip/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /skip/i })).toHaveCount(0);
});

test("AC-3: a finished user stays on /collection and /welcome redirects there", async ({ page }) => {
  await setOnboardedAt(new Date().toISOString());
  await page.goto("/collection");
  await expect(page).toHaveURL(/\/collection$/);
  await expect(step1(page)).toHaveCount(0);
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/collection$/);
});

test("AC-4: the seeded marker is set for pre-existing profiles and e2e_player is not gated", async ({ page }) => {
  expect(profileSnap!.onboarded_at).not.toBeNull();
  const { client } = await e2eSession();
  const { data, error } = await client
    .from("profiles")
    .select("user_id")
    .is("onboarded_at", null)
    .lt("created_at", "2026-10-14T12:00:00Z");
  expect(error).toBeNull();
  expect(data).toEqual([]);

  await setOnboardedAt(profileSnap!.onboarded_at);
  await page.goto("/collection");
  await expect(page).toHaveURL(/\/collection$/);
});

test("AC-7/AC-15: step 1 is pre-filled, previews the profile URL live, and shows the privacy note", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page.getByLabel("Display name")).toHaveValue(profileSnap!.display_name);
  await expect(page.getByLabel("Username")).toHaveValue(profileSnap!.username);
  await expect(page.getByText(`/u/${profileSnap!.username}`)).toBeVisible();
  await page.getByLabel("Username").fill("new_name");
  await expect(page.getByText("/u/new_name")).toBeVisible();
  expect((await readProfile()).username).toBe(profileSnap!.username);
  await expect(page.getByText("Only friends can see your collection")).toBeVisible();
});

test("AC-9: an invalid username shows the message, saves nothing, and input is lower-cased", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByLabel("Username").fill("ab");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByText("Username must be 3-20 characters: lowercase letters, numbers, underscores.")
  ).toBeVisible();
  await expect(step1(page)).toBeVisible();
  expect((await readProfile()).username).toBe(profileSnap!.username);

  await page.getByLabel("Username").fill("Sam_R");
  await expect(page.getByLabel("Username")).toHaveValue("sam_r");
});

test("AC-10: a username held by another user is rejected", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByLabel("Username").fill("e2e_friend");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That username is taken.")).toBeVisible();
  await expect(step1(page)).toBeVisible();
  expect((await readProfile()).username).toBe(profileSnap!.username);
});

test("AC-11: an empty or whitespace display name is rejected", async ({ page }) => {
  await page.goto("/welcome");
  for (const value of ["", "   "]) {
    await page.getByLabel("Display name").fill(value);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Display name is required.")).toBeVisible();
    await expect(step1(page)).toBeVisible();
  }
});

test("AC-12/AC-25: a valid save moves to step 2, writes the profile but not the marker, and Back keeps the values", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByLabel("Display name").fill("  Sam Rivera  ");
  await page.getByLabel("Username").fill("sam_rivera");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(step2(page)).toBeVisible();

  await expect
    .poll(async () => {
      const p = await readProfile();
      return [p.username, p.display_name, p.onboarded_at];
    }, { timeout: 10_000 })
    .toEqual(["sam_rivera", "Sam Rivera", null]);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(step1(page)).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveValue("sam_rivera");
});

test("AC-13: Remove photo clears avatar_url; with no photo there is a placeholder and no control", async ({ page }) => {
  await updateProfileRow({ avatar_url: "/favicon.ico" });
  await page.goto("/welcome");
  await expect(page.getByRole("img", { name: "Your profile photo" })).toBeVisible();
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(step2(page)).toBeVisible();
  await expect.poll(async () => (await readProfile()).avatar_url, { timeout: 10_000 }).toBeNull();

  await page.goto("/welcome");
  await expect(page.getByRole("img", { name: "Your profile photo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(0);
});

test("AC-14: a failing save shows an error, stays on step 1 and keeps the typed values", async ({ page }) => {
  await page.goto("/welcome");
  await page.route("**/welcome", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"]) {
      await route.fulfill({ status: 500, body: "boom" });
    } else {
      await route.continue();
    }
  });
  await page.getByLabel("Display name").fill("Typed Name");
  await page.getByLabel("Username").fill("typed_name");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Couldn't update profile.")).toBeVisible();
  await expect(step1(page)).toBeVisible();
  await expect(page.getByLabel("Display name")).toHaveValue("Typed Name");
  await expect(page.getByLabel("Username")).toHaveValue("typed_name");
});

test("AC-17: step 2 lists the Manabox export steps and offers Choose CSV file, Skip and Back", async ({ page }) => {
  await goToStep2(page);
  const items = page.getByRole("main").getByRole("listitem");
  expect(await items.count()).toBeGreaterThanOrEqual(3);
  const text = (await items.allTextContents()).join(" ");
  for (const word of ["Manabox", "Export", "CSV"]) expect(text).toContain(word);
  await expect(page.getByRole("button", { name: "Choose CSV file" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip for now" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
});

test("AC-18/AC-19/AC-22/AC-31: importing the fixture lists unmatched cards, marks onboarding at once, and keeps visibility", async ({ page }) => {
  await goToStep2(page);
  await pickFile(page, VALID_CSV);
  await expect(page.getByText(`Found ${FIXTURE_CARDS} cards`)).toBeVisible();
  await expect(page.getByText(/replace/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Import cards" }).click();
  await expect(page.getByText(`Imported ${FIXTURE_IMPORTED} cards`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("1 card couldn't be matched")).toBeVisible();
  await expect(page.getByText(/Not A Real Card/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Go to my collection" })).toBeVisible();

  // AC-19: marked by the import itself, before "Go to my collection" is tapped.
  await page.goto("/collection");
  await expect(page).toHaveURL(/\/collection$/);
  await expect(step1(page)).toHaveCount(0);
  expect((await readProfile()).onboarded_at).not.toBeNull();
  expect((await readProfile()).collection_visibility).toBe("friends");

  // AC-18: the Done button leads to the collection with cards.
  await updateProfileRow({ onboarded_at: null });
  await setCollection([]);
  await goToStep2(page);
  await pickFile(page, VALID_CSV);
  await page.getByRole("button", { name: "Import cards" }).click();
  await page.getByRole("button", { name: "Go to my collection" }).click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.getByRole("img", { name: "Sol Ring" })).toBeVisible();
  await expect.poll(async () => (await readProfile()).collection_visibility, { timeout: 10_000 }).toBe("friends");
});

test("AC-20: a file with no usable rows shows the parser error and changes nothing", async ({ page }) => {
  await goToStep2(page);
  await pickFile(page, NO_ROWS_CSV);
  await expect(page.getByText("No usable rows found in this file.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try another file" })).toBeVisible();
  expect((await readProfile()).onboarded_at).toBeNull();
  expect(await readFlags()).toHaveLength(0);
});

test("AC-21: a server error on import shows the message and leaves the marker unset", async ({ page }) => {
  await page.route("**/api/collection/import", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Import failed." }) })
  );
  await goToStep2(page);
  await pickFile(page, VALID_CSV);
  await page.getByRole("button", { name: "Import cards" }).click();
  await expect(page.getByText("Import failed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try another file" })).toBeVisible();
  expect((await readProfile()).onboarded_at).toBeNull();
});

test("AC-23: with existing rows, the confirm step warns that the collection is replaced", async ({ page }) => {
  await setCollection([{ card: CARDS.solRing }]);
  await goToStep2(page);
  await pickFile(page, VALID_CSV);
  await expect(page.getByText(/replace your current collection/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Replace collection" })).toBeVisible();
});

test("AC-24/AC-31: Skip for now lands on the empty collection, sticks after reload, and keeps visibility", async ({ page }) => {
  await goToStep2(page);
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.getByText("No cards yet")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/collection$/);
  await expect.poll(async () => (await readProfile()).onboarded_at, { timeout: 10_000 }).not.toBeNull();
  expect((await readProfile()).collection_visibility).toBe("friends");
});

test("AC-26: the Import modal's disclosure shows the same instructions as the wizard", async ({ page }) => {
  await setOnboardedAt(new Date().toISOString());
  await page.goto("/collection");
  await page.getByRole("button", { name: "Import Collection" }).first().click();
  await page.getByText("How to export from Manabox").click();
  const expected = MANABOX_EXPORT_STEPS.map((segments) => segments.map((s) => s.text).join(""));
  const modalItems = page.locator("details").getByRole("listitem");
  await expect(modalItems).toHaveCount(expected.length);
  expect((await modalItems.allTextContents()).map((t) => t.trim())).toEqual(expected);
});

for (const width of [375, 390]) {
  test(`AC-27: no horizontal scroll at ${width}px in every wizard state`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const noOverflow = async (label: string) => {
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(sw, label).toBeLessThanOrEqual(width);
    };

    await page.goto("/welcome");
    await noOverflow("step 1");
    await page.getByLabel("Username").fill("ab");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await noOverflow("step 1 error");

    await page.getByLabel("Username").fill(profileSnap!.username);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(step2(page)).toBeVisible();
    await noOverflow("step 2");

    await pickFile(page, NO_ROWS_CSV);
    await expect(page.getByRole("button", { name: "Try another file" })).toBeVisible();
    await noOverflow("step 2 parse error");

    await page.getByRole("button", { name: "Try another file" }).click();
    await pickFile(page, VALID_CSV);
    await page.getByRole("button", { name: "Import cards" }).click();
    await expect(page.getByRole("button", { name: "Go to my collection" })).toBeVisible({ timeout: 30_000 });
    await noOverflow("import done");
  });
}

test("AC-28/AC-29: controls are at least 44px tall and the wizard has no bottom nav", async ({ page }) => {
  const checkTargets = async (label: string) => {
    const controls = page.getByRole("main").locator("button, input, a");
    const count = await controls.count();
    expect(count, label).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const el = controls.nth(i);
      if (!(await el.isVisible())) continue; // hidden file input
      const box = await el.boundingBox();
      expect(box?.height ?? 0, `${label} control #${i}`).toBeGreaterThanOrEqual(44);
    }
  };

  await page.goto("/welcome");
  await updateProfileRow({ avatar_url: "/favicon.ico" });
  await page.reload();
  await checkTargets("step 1");
  await expect(page.getByRole("navigation").getByRole("link", { name: "Collection" })).toHaveCount(0);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(step2(page)).toBeVisible();
  await checkTargets("step 2");
  await expect(page.getByRole("navigation").getByRole("link", { name: "Collection" })).toHaveCount(0);
});
