import { expect, test } from "@playwright/test";

test.describe("signed out", () => {
  test("protected routes redirect to sign-in", async ({ page }) => {
    for (const path of ["/", "/collection", "/wishlist", "/trades"]) {
      await page.goto(path);
      await expect(page, `${path} should redirect`).toHaveURL(/\/sign-in$/);
    }
  });

  test("sign-in page offers Google sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "ManaPals" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("sign-in page visual", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page).toHaveScreenshot("sign-in.png", { fullPage: true });
  });
});
