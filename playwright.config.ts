import { defineConfig, devices } from "@playwright/test";

// E2E runs against PLAYWRIGHT_BASE_URL when set (e.g. a Vercel preview in CI),
// otherwise against a local dev server.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Screenshots differ by OS font rendering, so baselines are kept per platform.
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{testFilePath}/{arg}{ext}",
  // A missing baseline is written and passes, so new screens (or a new OS)
  // don't fail the first run; CI uploads them to commit.
  updateSnapshots: "missing",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    extraHTTPHeaders: bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : undefined,
  },
  projects: [
    // ManaPals is mobile-first, so the primary project is a phone viewport.
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chromium" } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
