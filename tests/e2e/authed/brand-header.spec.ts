import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { requireE2EUser } from "../helpers";

requireE2EUser();

async function expectBrandHeadLinks(page: Page) {
  const hrefs = await page
    .locator('head link[rel="icon"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
  expect(hrefs.map((h) => new URL(h, page.url()).pathname)).toContain("/favicon.ico");
  await expect(page.locator('head link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  const apple = page.locator('head link[rel="apple-touch-icon"]');
  await expect(apple).toHaveCount(1);
  await expect(apple).toHaveAttribute("sizes", "180x180");
  await expect(page.locator('head link[rel="manifest"]')).toHaveCount(1);
}

test("AC-4: icon, apple-touch-icon and manifest links are present on /collection", async ({ page }) => {
  await page.goto("/collection");
  await expect(page).toHaveURL(/\/collection$/);
  await expectBrandHeadLinks(page);
});

for (const path of ["/collection", "/trades", "/wishlist", "/profile"]) {
  test(`AC-14: ${path} has a header logo linking to /collection`, async ({ page }) => {
    await page.goto(path);
    const link = page.getByRole("banner").getByRole("link", { name: "ManaPals" });
    await expect(link).toHaveAttribute("href", "/collection");
    const img = link.getByRole("img");
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  });
}

test("AC-9: the header image is the unmodified lockup art", async ({ page }) => {
  await page.goto("/collection");
  const img = page.getByRole("banner").getByRole("img", { name: "ManaPals" });
  const src = await img.evaluate((el: HTMLImageElement) => el.currentSrc);
  const res = await page.request.get(src);
  expect(res.status()).toBe(200);
  const source = readFileSync(join(process.cwd(), "docs/brand/concept-3-lockup.svg"));
  expect((await res.body()).equals(source)).toBe(true);
});

test("AC-15: tapping the header logo on /wishlist goes to /collection", async ({ page }) => {
  await page.goto("/wishlist");
  await page.getByRole("banner").getByRole("link", { name: "ManaPals" }).click();
  await expect(page).toHaveURL(/\/collection$/);
});

test("AC-16: no horizontal scroll and a 44px+ header touch target on /collection", async ({ page }) => {
  await page.goto("/collection");
  const link = page.getByRole("banner").getByRole("link", { name: "ManaPals" });
  await expect(link).toBeVisible();
  const box = await link.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});
