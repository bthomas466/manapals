import { expect, test, type Page } from "@playwright/test";
import { requireE2EUser } from "../helpers";

requireE2EUser();

const BODY = "We couldn't find that username. Check the spelling, or find your friend from Profile.";

async function expectThemedNotFound(page: Page) {
  await expect(page.getByRole("heading", { name: "No ManaPal here" })).toBeVisible();
  await expect(page.getByText(BODY)).toBeVisible();
}

test("AC-9: an unknown profile shows the themed page inside the app chrome", async ({ page }) => {
  await page.goto("/u/no_such_user");
  await expectThemedNotFound(page);
  await expect(page.getByRole("banner").getByRole("link", { name: "ManaPals" })).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByText("This page could not be found")).toHaveCount(0);
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).not.toBe("rgb(255, 255, 255)");
});

test("AC-10: Find a friend goes to Profile's Find a Friend section and is at least 44px tall", async ({ page }) => {
  await page.goto("/u/no_such_user");
  const link = page.getByRole("link", { name: "Find a friend" });
  await expect(link).toBeVisible();
  const box = await link.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Find a Friend" })).toBeVisible();
});

test("AC-11: an unknown Trade Match username shows the same themed page", async ({ page }) => {
  await page.goto("/trades/no_such_user");
  await expectThemedNotFound(page);
  await expect(page.getByRole("link", { name: "Find a friend" })).toHaveAttribute("href", "/profile");
});

test("AC-17: the not-found page has no horizontal scroll at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/u/no_such_user");
  await expectThemedNotFound(page);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});
