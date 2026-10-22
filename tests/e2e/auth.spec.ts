import { expect, test } from "@playwright/test";

test.describe("signed out", () => {
  test("protected routes redirect to sign-in", async ({ page }) => {
    for (const path of ["/", "/collection", "/wishlist", "/trades", "/u/e2e_friend", "/u/no_such_user"]) {
      await page.goto(path);
      await expect(page, `${path} should redirect`).toHaveURL(/\/sign-in$/);
    }
  });

  test("sign-in page offers Google sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "ManaPals" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("AC-3: Continue with Google button renders the 12px button radius", async ({ page }) => {
    await page.goto("/sign-in");
    const button = page.getByRole("button", { name: "Continue with Google" });
    await expect(button).toBeVisible();
    const radius = await button.evaluate((el) => getComputedStyle(el).borderRadius);
    expect(radius).toBe("12px");
  });

  test("sign-in page visual", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    const logo = page.getByRole("img", { name: "ManaPals logo" });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", /concept-3\.svg/);
    await expect
      .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    // Vercel preview deployments inject a feedback toolbar; hide it so it can't
    // end up in the baseline. A no-op when absent (local runs, prod).
    await page.addStyleTag({
      content: "vercel-live-feedback { display: none !important; }",
    });
    await expect(page).toHaveScreenshot("sign-in.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
      mask: [page.locator("vercel-live-feedback")],
    });
  });
});
