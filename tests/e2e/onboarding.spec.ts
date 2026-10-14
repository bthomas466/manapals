import { expect, test } from "@playwright/test";

test("AC-5: signed out, /welcome redirects to sign-in", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/sign-in$/);
});
