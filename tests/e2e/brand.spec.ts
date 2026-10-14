import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, request as pwRequest, type APIRequestContext } from "@playwright/test";

const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const repoFile = (p: string) => readFileSync(join(process.cwd(), p));

test.describe("brand assets (signed out)", () => {
  let api: APIRequestContext;

  test.beforeAll(async ({ baseURL }) => {
    // Fresh context: no cookies, no storage state.
    api = await pwRequest.newContext({
      baseURL,
      extraHTTPHeaders: bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : undefined,
    });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("AC-1: head has /favicon.ico and an SVG icon link", async ({ page, baseURL }) => {
    await page.goto("/sign-in");
    const icons = page.locator('head link[rel="icon"]');
    const hrefs = await icons.evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(hrefs.map((h) => new URL(h, baseURL).pathname)).toContain("/favicon.ico");
    await expect(page.locator('head link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  });

  test("AC-2: head has exactly one 180x180 apple-touch-icon", async ({ page }) => {
    await page.goto("/sign-in");
    const link = page.locator('head link[rel="apple-touch-icon"]');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("sizes", "180x180");
  });

  test("AC-3: head has exactly one manifest link", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator('head link[rel="manifest"]')).toHaveCount(1);
  });

  test("AC-5/AC-6: every icon and the manifest resolve without cookies; manifest contents", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/sign-in");
    const hrefOf = (sel: string) =>
      page.locator(sel).first().evaluate((e) => e.getAttribute("href") ?? "");
    const manifestHref = await hrefOf('head link[rel="manifest"]');
    const urls: { url: string; types: string[] }[] = [
      { url: await hrefOf('head link[rel="icon"][href*="favicon"]'), types: ["image/x-icon", "image/vnd.microsoft.icon"] },
      { url: await hrefOf('head link[rel="icon"][type="image/svg+xml"]'), types: ["image/svg+xml"] },
      { url: await hrefOf('head link[rel="apple-touch-icon"]'), types: ["image/png"] },
      { url: manifestHref, types: ["application/manifest+json", "application/json"] },
    ];

    const manifestRes = await api.get(new URL(manifestHref, baseURL).toString(), { maxRedirects: 0 });
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();

    // AC-6
    expect(manifest.name).toBe("ManaPals");
    expect(manifest.short_name).toBe("ManaPals");
    expect(manifest.start_url).toBe("/collection");
    expect(manifest.background_color).toBe("#0c1015");
    expect(manifest.theme_color).toBe("#0c1015");
    const icons = manifest.icons as { src: string; sizes: string; type: string }[];
    for (const size of ["192x192", "512x512"]) {
      expect(icons.filter((i) => i.type === "image/png" && i.sizes === size)).toHaveLength(1);
    }
    for (const i of icons) urls.push({ url: i.src, types: ["image/png"] });

    // AC-5
    for (const { url, types } of urls) {
      expect(url, "asset url found").not.toBe("");
      const res = await api.get(new URL(url, baseURL).toString(), { maxRedirects: 0 });
      expect(res.status(), url).toBe(200);
      const ct = res.headers()["content-type"] ?? "";
      expect(types.some((t) => ct.startsWith(t)), `${url} content-type ${ct}`).toBe(true);
    }
  });

  test("AC-11/AC-9: sign-in logo is visible, loaded, and the unmodified source art", async ({ page }) => {
    await page.goto("/sign-in");
    const logo = page.getByRole("img", { name: "ManaPals logo" });
    await expect(logo).toBeVisible();
    await expect
      .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    const src = await logo.evaluate((img: HTMLImageElement) => img.currentSrc);
    const res = await api.get(src, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect((await res.body()).equals(repoFile("docs/brand/concept-3.svg"))).toBe(true);
  });

  test("AC-12: no joker emoji; heading and button remain", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "ManaPals" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    expect(await page.content()).not.toContain("\u{1F0CF}");
  });

  test("AC-17: the starter SVG is gone (404)", async () => {
    const res = await api.get("/" + "next" + ".svg", { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });

  test("AC-18: protected pages still redirect signed-out requests to sign-in", async () => {
    for (const path of ["/collection", "/wishlist", "/trades", "/u/e2e_friend"]) {
      const res = await api.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(new URL(res.headers()["location"], "http://x").pathname, path).toBe("/sign-in");
    }
  });
});
