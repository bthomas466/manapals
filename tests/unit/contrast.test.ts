import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  oklchToSrgb,
  parseHex,
  parseOklch,
  readThemeColors,
  type Rgb,
} from "../../src/lib/a11y/contrast";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const theme = readThemeColors(css);

function rgb(token: string): Rgb {
  const value = theme[token];
  expect(value, `--color-${token} missing from @theme`).toBeTruthy();
  return value.startsWith("#") ? parseHex(value) : oklchToSrgb(parseOklch(value));
}

const BACKGROUNDS = ["page", "surface", "elevated"] as const;

describe("contrast helper", () => {
  it("AC-3: white on black is about 21:1", () => {
    expect(contrastRatio(parseHex("#fff"), parseHex("#000"))).toBeCloseTo(21, 0);
  });

  it("AC-3: identical colors are 1:1", () => {
    expect(contrastRatio(parseHex("#777"), parseHex("#777"))).toBeCloseTo(1, 5);
  });

  it("AC-3: oklch white converts to sRGB white and black to black", () => {
    const white = oklchToSrgb(parseOklch("oklch(100% 0 0)"));
    const black = oklchToSrgb(parseOklch("oklch(0% 0 0)"));
    expect(contrastRatio(white, black)).toBeGreaterThan(20.5);
  });

  it("AC-3: readThemeColors finds danger and the surfaces", () => {
    for (const key of ["danger", "page", "surface", "elevated", "amber", "text-secondary", "text-muted"]) {
      expect(theme[key], key).toBeTruthy();
    }
  });
});

describe("theme token contrast", () => {
  for (const bg of BACKGROUNDS) {
    it(`AC-3: danger is at least 4.5:1 on ${bg}`, () => {
      expect(contrastRatio(rgb("danger"), rgb(bg))).toBeGreaterThanOrEqual(4.5);
    });
    it(`AC-3: text-secondary is at least 4.5:1 on ${bg}`, () => {
      expect(contrastRatio(rgb("text-secondary"), rgb(bg))).toBeGreaterThanOrEqual(4.5);
    });
    it(`AC-3: amber is at least 3:1 on ${bg}`, () => {
      expect(contrastRatio(rgb("amber"), rgb(bg))).toBeGreaterThanOrEqual(3);
    });
  }

  it("AC-3: text-muted on elevated fails 4.5:1, so the helper detects low contrast", () => {
    expect(contrastRatio(rgb("text-muted"), rgb("elevated"))).toBeLessThan(4.5);
  });
});
