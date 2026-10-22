import { expect, test, type Locator, type Page } from "@playwright/test";
import { requireE2EUser } from "../helpers";

// Read-only checks for #46. Relies on `npm run seed:staging`: e2e_player is friends with
// e2e_friend ("E2E Friend"), not with e2e_stranger, and wishlists Swords to Plowshares + Path to Exile.
// The confirm-Remove path is deliberately NOT exercised here: it would delete the seeded friendship.
requireE2EUser();

/** Resolves a design token to a computed rgb() string, the form getComputedStyle returns for colors. */
async function resolveToken(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--color-${n})`;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

async function expectBox(locator: Locator, label: string) {
  await expect(locator, label).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, label).not.toBeNull();
  expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${label} height`).toBeGreaterThanOrEqual(44);
}

const ringOf = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    const tag = `${el.tagName.toLowerCase()}${el.textContent ? `:${el.textContent.trim().slice(0, 30)}` : ""}`;
    return {
      tag,
      isBody: el === document.body,
      style: s.outlineStyle,
      width: s.outlineWidth,
      offset: s.outlineOffset,
      color: s.outlineColor,
    };
  });

for (const path of ["/profile", "/collection", "/wishlist", "/u/e2e_friend"]) {
  test(`AC-1: every keyboard-focused element on ${path} has the amber 2px ring`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("navigation").first()).toBeVisible();
    const amber = await resolveToken(page, "amber");
    let checked = 0;
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      let ring = await ringOf(page);
      if (ring.isBody) break;
      // The Next.js dev overlay (dev server) and the Vercel preview toolbar are not part of the app.
      if (ring.tag.startsWith("nextjs-portal") || ring.tag.startsWith("vercel-live-feedback")) continue;
      // Some elements carry transition-colors, which briefly animates the outline-color in.
      await expect
        .poll(async () => (ring = await ringOf(page)).color, { timeout: 2_000 })
        .toBe(amber)
        .catch(() => {});
      checked++;
      expect(ring.style, ring.tag).toBe("solid");
      expect(ring.width, ring.tag).toBe("2px");
      expect(ring.offset, ring.tag).toBe("2px");
      expect(ring.color, ring.tag).toBe(amber);
    }
    expect(checked).toBeGreaterThan(3);
  });
}

test("AC-1: the username input's wrapper shows the amber ring on keyboard focus while editing", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const amber = await resolveToken(page, "amber");
  await page.getByPlaceholder("Display name").focus();
  await page.keyboard.press("Tab");
  const username = page.getByPlaceholder("username", { exact: true });
  await expect(username).toBeFocused();
  const ring = await username.evaluate((el) => {
    const pick = (n: Element) => {
      const s = getComputedStyle(n);
      return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor };
    };
    return { input: pick(el), wrapper: pick(el.closest(".focus-ring-within") ?? el) };
  });
  const ok = (r: { style: string; width: string; color: string }) =>
    r.style === "solid" && r.width === "2px" && r.color === amber;
  expect(ok(ring.input) || ok(ring.wrapper), JSON.stringify(ring)).toBe(true);
});

test("AC-6: a validation error is shown in danger color at 14px with role=alert", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByPlaceholder("Display name").fill("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const alert = page.locator('p[role="alert"]');
  await expect(alert).toBeVisible();
  await expect(alert).toHaveText("Display name is required.");
  const danger = await resolveToken(page, "danger");
  await expect(alert).toHaveCSS("color", danger);
  await expect(alert).toHaveCSS("font-size", "14px");
});

test("AC-7: wishlist remove buttons and the Add-card Close button are at least 44x44", async ({ page }) => {
  await page.goto("/wishlist");
  const removes = page.getByRole("button", { name: /^Remove .* from wishlist$/ });
  await expect(removes.first()).toBeVisible();
  const count = await removes.count();
  expect(count).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < count; i++) await expectBox(removes.nth(i), `wishlist remove #${i}`);

  await page.getByRole("button", { name: /Add Card/ }).click();
  await expectBox(page.getByRole("button", { name: "Close", exact: true }), "Add to wishlist Close");
});

test("AC-7: collection color chips and sort select are at least 44x44", async ({ page }) => {
  await page.goto("/collection");
  const sort = page.getByRole("combobox", { name: "Sort cards" });
  await expectBox(sort, "sort select");
  const chips = page.locator("button[aria-pressed]");
  await expect(chips.first()).toBeVisible();
  const count = await chips.count();
  expect(count).toBeGreaterThanOrEqual(5);
  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    await chip.scrollIntoViewIfNeeded();
    await expectBox(chip, `chip ${await chip.textContent()}`);
  }
});

test("AC-7: profile Edit, visibility options, Go, Save and Cancel are at least 44x44", async ({ page }) => {
  await page.goto("/profile");
  await expectBox(page.getByRole("button", { name: "Friends only", exact: true }), "Friends only");
  await expectBox(page.getByRole("button", { name: "Public", exact: true }), "Public");
  await expectBox(page.getByRole("button", { name: "Go", exact: true }), "Go");
  const edit = page.getByRole("button", { name: "Edit", exact: true });
  await expectBox(edit, "Edit");
  await edit.click();
  await expectBox(page.getByRole("button", { name: "Save", exact: true }), "Save");
  await expectBox(page.getByRole("button", { name: "Cancel", exact: true }), "Cancel");
});

test("AC-7: the Trades back link is at least 44x44", async ({ page }) => {
  await page.goto("/trades/e2e_friend");
  await expectBox(page.getByRole("link", { name: "← Trades", exact: true }), "back link");
});

test("AC-7: Remove friend (friend) and Add Friend (stranger) are at least 44x44", async ({ page }) => {
  await page.goto("/u/e2e_friend");
  await expectBox(page.getByRole("button", { name: "Remove friend" }), "Remove friend");
  await page.goto("/u/e2e_stranger");
  await expectBox(page.getByRole("button", { name: "Add Friend" }), "Add Friend");
});

test("AC-9: wishlist remove buttons are named after their card, and none is named ✕", async ({ page }) => {
  await page.goto("/wishlist");
  await expect(page.getByRole("button", { name: "Remove Swords to Plowshares from wishlist" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Path to Exile from wishlist" })).toBeVisible();
  await expect(page.getByRole("button", { name: "✕", exact: true })).toHaveCount(0);
});

test("AC-11: content handles and inactive nav use text-secondary; the legal footer stays muted", async ({ page }) => {
  await page.goto("/profile");
  const secondary = await resolveToken(page, "text-secondary");
  const muted = await resolveToken(page, "text-muted");
  const friends = page.locator("section", { has: page.getByRole("heading", { name: /^Friends/ }) });
  await expect(friends.getByText("@e2e_friend")).toHaveCSS("color", secondary);
  await expect(page.getByRole("navigation").getByText("Collection", { exact: true })).toHaveCSS("color", secondary);
  await expect(page.getByText(/ManaPals is not affiliated/)).toHaveCSS("color", muted);

  await page.goto("/u/e2e_friend");
  await expect(page.getByText("@e2e_friend", { exact: true })).toHaveCSS("color", secondary);
});

test.describe("AC-12: no horizontal scroll at 375px", () => {
  test.use({ viewport: { width: 375, height: 800 } });
  for (const path of ["/profile", "/collection", "/wishlist", "/u/e2e_friend"]) {
    test(`AC-12: ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("navigation").first()).toBeVisible();
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(375);
    });
  }
});

test("AC-13: Friends is a non-interactive chip beside a separate Remove friend button", async ({ page }) => {
  await page.goto("/u/e2e_friend");
  await expect(page.getByText("Friends ✓", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Friends/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove friend" })).toBeVisible();
  await expect(page.getByText("Friends ✓ · Remove")).toHaveCount(0);
});

test("AC-14: Cancel and Escape close the confirm dialog without removing the friend", async ({ page }) => {
  await page.goto("/u/e2e_friend");
  const trigger = page.getByRole("button", { name: "Remove friend" });
  await trigger.click();

  const dialog = page.getByRole("alertdialog", { name: "Remove E2E Friend as a friend?" });
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const remove = dialog.getByRole("button", { name: "Remove", exact: true });
  for (const b of [cancel, remove]) {
    // Poll: the dialog scales in over 150ms, so the first measurement can read ~96%.
    await expect.poll(async () => (await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="alertdialog"]'))).toBe(true);

  await cancel.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByText("Friends ✓", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Friends ✓", { exact: true })).toBeVisible();

  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Friends ✓", { exact: true })).toBeVisible();
});
