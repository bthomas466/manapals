import { expect, test, type Page } from "@playwright/test";
import { requireE2EUser } from "../helpers";

// Read-only geometry checks for the shared card grid (spec #33). Relies on
// `npm run seed:staging`. Expected values are hard-coded as an independent oracle.
requireE2EUser();

const VIEWPORTS = [
  { width: 375, height: 800 },
  { width: 412, height: 915 },
  { width: 639, height: 900 },
  { width: 640, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const EXPECTED_COLUMNS: Record<number, number> = {
  375: 3, 412: 3, 639: 3, 640: 4, 768: 5, 1024: 6, 1280: 8, 1440: 8, 1920: 10,
};

const PAGES = [
  { path: "/collection", grids: 1 },
  { path: "/u/e2e_friend", grids: 2 },
  { path: "/wishlist", grids: 1 },
  { path: "/trades/e2e_friend", grids: 3 },
];

type GridInfo = {
  columns: number;
  columnGap: number;
  tiles: { left: number; right: number; width: number; height: number }[];
};

async function openAndMeasure(page: Page, path: string, expectedGrids: number): Promise<GridInfo[]> {
  await page.goto(path);
  await expect(page.getByTestId("card-grid")).toHaveCount(expectedGrids);
  await expect(page.getByTestId("card-grid").last().locator(":scope > *").first()).toBeVisible();
  return page.getByTestId("card-grid").evaluateAll((grids) =>
    grids.map((grid) => {
      const style = getComputedStyle(grid);
      return {
        columns: style.gridTemplateColumns.split(" ").length,
        columnGap: parseFloat(style.columnGap),
        tiles: Array.from(grid.children).map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width, height: r.height };
        }),
      };
    })
  );
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("card grid sizing", () => {
  for (const vp of VIEWPORTS) {
    const cols = EXPECTED_COLUMNS[vp.width];

    test.describe(`${vp.width}px`, () => {
      test.use({ viewport: vp });

      test(`AC-1/4/5/9/10: every grid has ${cols} columns, sane tiles, no horizontal scroll`, async ({ page }) => {
        for (const { path, grids } of PAGES) {
          const infos = await openAndMeasure(page, path, grids);
          expect(infos.length, path).toBe(grids);
          for (const info of infos) {
            expect(info.columns, `${path} columns`).toBe(cols);
            expect(info.tiles.length, `${path} has tiles`).toBeGreaterThan(0);
            if (vp.width < 640) expect(Math.abs(info.columnGap - 10), `${path} gap`).toBeLessThanOrEqual(1);
            for (const tile of info.tiles) {
              expect(tile.width, `${path} tile min`).toBeGreaterThanOrEqual(100);
              if (vp.width >= 640) expect(tile.width, `${path} tile max`).toBeLessThanOrEqual(200);
              expect(Math.abs(tile.height / tile.width - 1.4), `${path} ratio`).toBeLessThanOrEqual(0.02);
            }
          }
          expect(await noHorizontalScroll(page), `${path} horizontal scroll`).toBe(true);
        }
      });

      test("AC-7: every grid on every page has the same columns and tile width", async ({ page }) => {
        const all: GridInfo[] = [];
        for (const { path, grids } of PAGES) {
          all.push(...(await openAndMeasure(page, path, grids)));
        }
        expect(all.length).toBe(7);
        const first = all[0];
        for (const info of all) {
          expect(info.columns).toBe(first.columns);
          expect(Math.abs(info.tiles[0].width - first.tiles[0].width)).toBeLessThanOrEqual(1);
        }
      });
    });
  }

  test("AC-2: mobile tile widths are unchanged", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const [at375] = await openAndMeasure(page, "/collection", 1);
    for (const t of at375.tiles) {
      expect(t.width).toBeGreaterThanOrEqual(107);
      expect(t.width).toBeLessThanOrEqual(109);
    }
    await page.setViewportSize({ width: 412, height: 915 });
    const [at412] = await openAndMeasure(page, "/collection", 1);
    for (const t of at412.tiles) {
      expect(t.width).toBeGreaterThanOrEqual(119);
      expect(t.width).toBeLessThanOrEqual(121);
    }
  });

  test("AC-3: touch targets are kept at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/collection");
    const grid = page.getByTestId("card-grid");
    await expect(grid).toBeVisible();
    for (const name of ["Sol Ring", "Arcane Signet", "Lightning Bolt", "Counterspell"]) {
      const box = await grid.getByRole("button", { name: new RegExp(`^${name},`) }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.width, name).toBeGreaterThanOrEqual(44);
      expect(box!.height, name).toBeGreaterThanOrEqual(44);
    }
    for (const name of ["All", "White", "Blue", "Black", "Red", "Green", "Foil", "For trade", "Not for trade"]) {
      const box = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.height, name).toBeGreaterThanOrEqual(44);
    }
  });

  test("AC-3: wishlist remove buttons are the same size on phone and desktop", async ({ page }) => {
    // The button's classes are untouched, so its size must not depend on viewport.
    // (No fixed value is hard-coded because it depends on font rendering.)
    const sizeAt = async (width: number) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/wishlist");
      const button = page.getByTestId("card-grid").getByRole("button", { name: "✕" }).first();
      await expect(button).toBeVisible();
      return (await button.boundingBox())!;
    };
    const phone = await sizeAt(375);
    const desktop = await sizeAt(1280);
    expect(phone.width).toBeGreaterThan(0);
    expect(Math.abs(desktop.width - phone.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(desktop.height - phone.height)).toBeLessThanOrEqual(1);
  });

  test("AC-6: collection column count never decreases and hits the minimums", async ({ page }) => {
    let prev = 0;
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      const [info] = await openAndMeasure(page, "/collection", 1);
      expect(info.columns, `${vp.width}px`).toBe(EXPECTED_COLUMNS[vp.width]);
      expect(info.columns).toBeGreaterThanOrEqual(prev);
      prev = info.columns;
      if (vp.width === 1024) expect(info.columns).toBeGreaterThanOrEqual(5);
      if (vp.width === 1440) expect(info.columns).toBeGreaterThanOrEqual(7);
    }
  });

  test("AC-11: badges stay inside tiles and the trade sheet still opens at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/collection");
    const grid = page.getByTestId("card-grid");
    const bolt = grid.locator(":scope > *").filter({ has: page.getByRole("img", { name: "Lightning Bolt" }) });
    const foil = bolt.getByText("✨");
    await expect(foil).toBeVisible();
    const tileBox = (await bolt.boundingBox())!;
    const foilBox = (await foil.boundingBox())!;
    expect(foilBox.x).toBeGreaterThanOrEqual(tileBox.x);
    expect(foilBox.y).toBeGreaterThanOrEqual(tileBox.y);
    expect(foilBox.x + foilBox.width).toBeLessThanOrEqual(tileBox.x + tileBox.width + 0.5);
    expect(foilBox.y + foilBox.height).toBeLessThanOrEqual(tileBox.y + tileBox.height + 0.5);

    await grid.getByRole("button", { name: /^Sol Ring,/ }).click();
    const dialog = page.getByRole("dialog", { name: "Trade status for Sol Ring" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/trades/e2e_friend");
    await expect(page.getByTestId("card-grid")).toHaveCount(3);
    const prices = page.getByTestId("card-grid").getByText(/^\$\d/);
    const count = await prices.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const badge = prices.nth(i);
      await expect(badge).toBeVisible();
      const b = (await badge.boundingBox())!;
      const t = (await badge.locator("xpath=..").boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(t.x);
      expect(b.y).toBeGreaterThanOrEqual(t.y);
      expect(b.x + b.width).toBeLessThanOrEqual(t.x + t.width + 0.5);
      expect(b.y + b.height).toBeLessThanOrEqual(t.y + t.height + 0.5);
    }
  });

  test("AC-12: a search with no matches shows the empty text and no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/collection");
    await page.getByPlaceholder("Search cards...").fill("zzzz-no-match");
    await expect(page.getByText("No cards match your filters.")).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test("AC-13: a non-friend sees the lock state and no card grid at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/u/e2e_stranger");
    await expect(page.getByText("Only friends can see this collection")).toBeVisible();
    await expect(page.getByTestId("card-grid")).toHaveCount(0);
  });
});
