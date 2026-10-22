import { expect, test } from "@playwright/test";
import { requireE2EUser } from "../helpers";

// Writes e2e_player's collection_visibility, so it runs in the `authed-serial` project.
// The seeded value is "friends"; it is restored in `finally`.
requireE2EUser();
test.describe.configure({ mode: "serial" });

test("AC-2: tapping a visibility option with a pointer shows no focus ring", async ({ page }) => {
  await page.goto("/profile");
  const friendsOnly = page.getByRole("button", { name: "Friends only", exact: true });
  const publicBtn = page.getByRole("button", { name: "Public", exact: true });
  await expect(friendsOnly).toHaveClass(/bg-amber/);
  try {
    // Press without releasing: focus lands on mousedown, before the action disables the button.
    const box = (await publicBtn.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(publicBtn).toBeFocused();
    await expect(publicBtn).toHaveCSS("outline-style", "none");
    await page.mouse.up();
    // The class flips only after the server action succeeds, so the write has landed.
    await expect(publicBtn).toHaveClass(/bg-amber/, { timeout: 10_000 });
  } finally {
    const current = await publicBtn.getAttribute("class");
    if (current?.includes("bg-amber")) {
      await friendsOnly.click();
      await expect(friendsOnly).toHaveClass(/bg-amber/, { timeout: 10_000 });
    }
  }
});
