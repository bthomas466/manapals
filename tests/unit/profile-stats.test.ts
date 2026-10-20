import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProfileStats from "@/components/profile/ProfileStats";
import { formatStat } from "@/lib/profile/stats";

type Props = { cards: number | null; friends: number; trades: number | null };
const render = (props: Props) => renderToStaticMarkup(createElement(ProfileStats, props));

/** The markup of one tile, found by its data-testid. */
function tile(html: string, testId: string): string {
  const start = html.indexOf(`data-testid="${testId}"`);
  expect(start, `${testId} present`).toBeGreaterThan(-1);
  const rest = html.slice(start);
  const end = rest.search(/<\/(a|div)>/);
  return rest.slice(0, end);
}

describe("formatStat", () => {
  it("AC-7: null is an em dash, never 0", () => {
    expect(formatStat(null)).toBe("—");
  });
  it("groups thousands with en-US formatting", () => {
    expect(formatStat(1214)).toBe("1,214");
  });
  it("keeps a real zero as 0", () => {
    expect(formatStat(0)).toBe("0");
  });
});

describe("ProfileStats", () => {
  it("AC-7: unavailable cards and trades both show an em dash and no 0", () => {
    const html = render({ cards: null, friends: 1, trades: null });
    const cards = tile(html, "stat-cards");
    const trades = tile(html, "stat-trades");
    expect(cards).toContain("—");
    expect(trades).toContain("—");
    expect(cards).not.toMatch(/>0</);
    expect(trades).not.toMatch(/>0</);
    expect(tile(html, "stat-friends")).toContain(">1<");
  });

  it("AC-7: an unavailable cards value does not show the empty-binder line", () => {
    expect(render({ cards: null, friends: 0, trades: null })).not.toContain("Your binder is empty");
  });

  it("formats large counts with grouping and highlights a positive Trades count (D-1)", () => {
    const html = render({ cards: 1214, friends: 3, trades: 2 });
    expect(tile(html, "stat-cards")).toContain("1,214");
    const trades = tile(html, "stat-trades");
    expect(trades).toContain(">2<");
    expect(trades).toContain("text-amber");
  });

  it("D-1: a zero Trades count is not highlighted", () => {
    const trades = tile(render({ cards: 5, friends: 1, trades: 0 }), "stat-trades");
    expect(trades).toContain(">0<");
    expect(trades).not.toContain("text-amber");
  });

  it("AC-5: the Cards tile is a link to /collection with a 44px minimum height", () => {
    const html = render({ cards: 5, friends: 1, trades: 2 });
    expect(html).toMatch(/<a[^>]*href="\/collection"[^>]*data-testid="stat-cards"|<a[^>]*data-testid="stat-cards"[^>]*href="\/collection"/);
    expect(html).toMatch(/data-testid="stat-cards"[^>]*min-h-11|min-h-11[^>]*data-testid="stat-cards"/);
  });

  it("AC-6 / D-4: exactly 0 cards shows 0 and the empty-binder line", () => {
    const html = render({ cards: 0, friends: 0, trades: 0 });
    expect(tile(html, "stat-cards")).toContain(">0<");
    expect(html).toContain("Your binder is empty. Tap Cards to add some.");
  });

  it("D-4: a non-zero card count hides the empty-binder line", () => {
    expect(render({ cards: 5, friends: 1, trades: 2 })).not.toContain("Your binder is empty");
  });
});
