import { defineConfig, devices } from "@playwright/test";
import { AUTH_STATE } from "./tests/e2e/helpers";

// Local runs read Supabase + E2E credentials from .env.local; CI passes env vars.
try {
  process.loadEnvFile(".env.local");
} catch {}

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
    // Full Chromium rather than headless-shell (its download stalls on some machines).
    channel: "chromium",
    extraHTTPHeaders: bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : undefined,
  },
  // ManaPals is mobile-first, so every project uses a phone viewport.
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "mobile",
      testIgnore: /authed\//,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "authed",
      testMatch: /authed\/.*\.spec\.ts/,
      testIgnore: /\.serial\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: AUTH_STATE },
    },
    // Specs that mutate e2e_player's collection run alone, after the read-only ones.
    {
      name: "authed-serial",
      testMatch: /authed\/.*\.serial\.spec\.ts/,
      dependencies: ["authed"],
      fullyParallel: false,
      workers: 1,
      use: { ...devices["Pixel 7"], storageState: AUTH_STATE },
    },
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
