import { expect, test } from "@playwright/test";
import { requireE2EUser } from "../helpers";

// Read-only: only computed styles are read. Nothing is imported or mutated.
requireE2EUser();

test("AC-4: collection summary card is 16px and a filter chip is 8px", async ({ page }) => {
  await page.goto("/collection");
  const summary = page.getByRole("region", { name: "Collection summary" });
  await expect(summary).toBeVisible();
  expect(await summary.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("16px");

  const chip = page.getByRole("button", { name: "Foil", exact: true });
  await expect(chip).toBeVisible();
  expect(await chip.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("8px");
});

test("AC-5: the profile avatar is a circle", async ({ page }) => {
  await page.goto("/profile");
  const avatar = page.locator(".rounded-avatar").first();
  await expect(avatar).toBeVisible();
  expect(await avatar.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("9999px");
});

test("AC-6: the import sheet rounds only its top corners", async ({ page }) => {
  await page.goto("/collection");
  await page.getByRole("button", { name: "Re-import" }).click();
  const panel = page
    .locator(".rounded-t-card")
    .filter({ has: page.getByRole("heading", { name: "Import Collection" }) });
  await expect(panel).toBeVisible();
  const r = await panel.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      tl: s.borderTopLeftRadius,
      tr: s.borderTopRightRadius,
      bl: s.borderBottomLeftRadius,
      br: s.borderBottomRightRadius,
    };
  });
  expect(r).toEqual({ tl: "16px", tr: "16px", bl: "0px", br: "0px" });

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(panel).toHaveCount(0);
});
