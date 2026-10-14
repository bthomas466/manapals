import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(join(root, p));

const STARTER_FAVICON_SHA256 =
  "2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function icoEntries(buf: Buffer) {
  expect(buf.readUInt16LE(0)).toBe(0); // reserved
  expect(buf.readUInt16LE(2)).toBe(1); // type: icon
  const count = buf.readUInt16LE(4);
  const entries: { width: number; height: number; size: number; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16;
    entries.push({
      width: buf[o] || 256,
      height: buf[o + 1] || 256,
      size: buf.readUInt32LE(o + 8),
      offset: buf.readUInt32LE(o + 12),
    });
  }
  return entries;
}

function pngSize(buf: Buffer) {
  expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("brand assets", () => {
  it("AC-7: favicon.ico has 16x16 and 32x32 entries and is not the Next.js starter favicon", () => {
    const ico = read("src/app/favicon.ico");
    const entries = icoEntries(ico);
    const sizes = entries.map((e) => `${e.width}x${e.height}`);
    expect(sizes).toContain("16x16");
    expect(sizes).toContain("32x32");
    for (const e of entries) {
      expect(e.offset + e.size).toBeLessThanOrEqual(ico.length);
    }
    const sha = createHash("sha256").update(ico).digest("hex");
    expect(sha).not.toBe(STARTER_FAVICON_SHA256);
  });

  it.each([
    ["src/app/apple-icon.png", 180],
    ["public/icons/manapals-192.png", 192],
    ["public/icons/manapals-512.png", 512],
  ])("AC-8: %s is a %ipx square PNG", (path, size) => {
    expect(pngSize(read(path))).toEqual({ width: size, height: size });
  });

  it.each([
    ["src/app/icon.svg", "docs/brand/concept-3.svg"],
    ["public/brand/concept-3.svg", "docs/brand/concept-3.svg"],
    ["public/brand/concept-3-lockup.svg", "docs/brand/concept-3-lockup.svg"],
  ])("AC-9: %s is byte-identical to %s", (served, source) => {
    expect(read(served).equals(read(source))).toBe(true);
  });

  it("AC-10: @theme defines exactly the 10 existing --color-* tokens", () => {
    const css = read("src/app/globals.css").toString("utf8");
    const block = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
    expect(block).not.toBeNull();
    const names = [...block![1].matchAll(/--color-([a-z-]+)\s*:/g)].map((m) => m[1]).sort();
    expect(names).toEqual(
      [
        "page",
        "surface",
        "elevated",
        "border",
        "border-strong",
        "amber",
        "success",
        "text-primary",
        "text-secondary",
        "text-muted",
      ].sort(),
    );
  });

  // Names are built at runtime so this file doesn't match its own scan.
  const starterSvgs = ["next", "vercel", "file", "globe", "window"].map((n) => n + ".svg");

  it("AC-17: the starter SVGs are deleted from public/", () => {
    for (const name of starterSvgs) {
      expect(existsSync(join(root, "public", name)), name).toBe(false);
    }
  });

  it("AC-17: nothing under src/ or tests/ mentions the starter SVGs", () => {
    const self = resolve(__filename);
    const textExt = /\.(tsx?|jsx?|css|json|md|html|mjs|cjs)$/;
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === "node_modules" || entry === "__screenshots__") continue;
          walk(full);
        } else if (textExt.test(entry) && resolve(full) !== self) {
          const text = readFileSync(full, "utf8");
          for (const name of starterSvgs) {
            if (text.includes(name)) hits.push(`${full}: ${name}`);
          }
        }
      }
    };
    walk(join(root, "src"));
    walk(join(root, "tests"));
    expect(hits).toEqual([]);
  });
});
