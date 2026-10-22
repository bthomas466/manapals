import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function walk(dir: string, exts: string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p, exts);
    return exts.some((x) => e.name.endsWith(x)) ? [p] : [];
  });
}

const PREFIXES =
  "text|bg|border(?:-[trblxy])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|divide|decoration|accent|caret|shadow";
const PALETTES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
export const PALETTE_RE = new RegExp(
  `(?<![\\w-])(?:${PREFIXES})-(?:black|white|(?:${PALETTES})-(?:50|[1-9]00|950))(?:/\\d+)?(?![\\w-])`,
  "g"
);
export const MUTED_RE = /(?<!placeholder:)(?<![\w-])text-text-muted/g;
// Tailwind 4 no longer wraps a bare custom property in var() inside [...]:
// `rounded-[--radius-btn]` compiles to `border-radius: --radius-btn` (invalid).
// Valid forms: `rounded-btn` (theme utility), `rounded-(--x)`, `rounded-[var(--x)]`.
export const BARE_VAR_ARBITRARY_RE = /(?<![\w-])(?:[\w-]+:)*[\w-]+-\[--[^\]\s]*\]/g;

describe("guard regexes", () => {
  it("flag palette colors", () => {
    for (const bad of [
      "text-red-500",
      "bg-black/60",
      "bg-black/50",
      "border-white",
      "hover:bg-slate-900",
      "placeholder:text-gray-400",
      "ring-offset-zinc-100",
      "outline-blue-600",
      "fill-white",
    ]) {
      expect(bad.match(PALETTE_RE), bad).not.toBeNull();
    }
  });

  it("do not flag system tokens", () => {
    for (const ok of [
      "text-amber",
      "border-amber/30",
      "bg-page/80",
      "bg-page/70",
      "text-danger",
      "border-text-muted",
      "text-text-secondary",
      "bg-elevated",
    ]) {
      expect(ok.match(PALETTE_RE), ok).toBeNull();
    }
  });

  it("muted regex skips placeholders and border-text-muted but catches content use", () => {
    expect("placeholder:text-text-muted".match(MUTED_RE)).toBeNull();
    expect("border-text-muted".match(MUTED_RE)).toBeNull();
    expect("text-xs text-text-muted".match(MUTED_RE)).toHaveLength(1);
  });
});

describe("bare custom property guard regex", () => {
  it("AC-7: flags the Tailwind 3 shorthand", () => {
    for (const bad of [
      "rounded-[--radius-btn]",
      "rounded-t-[--radius-card]",
      "hover:rounded-[--radius-chip]",
      "p-[--space-4]",
      "bg-[--brand]",
    ]) {
      expect(bad.match(BARE_VAR_ARBITRARY_RE), bad).not.toBeNull();
    }
  });

  it("AC-7: reports the whole class including variant prefixes", () => {
    expect('className="sm:hover:rounded-[--radius-chip] p-2"'.match(BARE_VAR_ARBITRARY_RE)).toEqual([
      "sm:hover:rounded-[--radius-chip]",
    ]);
  });

  it("AC-7: allows valid Tailwind 4 forms", () => {
    for (const ok of [
      "rounded-btn",
      "rounded-[var(--radius-btn)]",
      "rounded-(--radius-btn)",
      "w-[calc(100%-1rem)]",
      "rounded-[12px]",
    ]) {
      expect(ok.match(BARE_VAR_ARBITRARY_RE), ok).toBeNull();
    }
  });
});

describe("design system guard", () => {
  const files = walk(SRC, [".ts", ".tsx", ".css"]);

  it("scans a meaningful number of files", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("AC-5: no Tailwind palette color classes under src/", () => {
    const hits: string[] = [];
    for (const f of files) {
      const matches = readFileSync(f, "utf8").match(PALETTE_RE);
      if (matches) hits.push(`${relative(SRC, f)}: ${matches.join(", ")}`);
    }
    expect(hits).toEqual([]);
  });

  it("AC-5: no text-red-500 anywhere under src/", () => {
    const hits = files.filter((f) => readFileSync(f, "utf8").includes("text-red-500"));
    expect(hits.map((f) => relative(SRC, f))).toEqual([]);
  });

  it("AC-5: each file that used text-red-500 renders errors through FieldError", () => {
    const converted = [
      "components/wishlist/AddCardSearch.tsx",
      "components/friends/FriendActionButton.tsx",
      "components/friends/FriendRequestActions.tsx",
      "components/onboarding/ProfileStep.tsx",
      "components/onboarding/ImportStep.tsx",
      "components/profile/ProfileEditForm.tsx",
      "components/profile/VisibilityToggle.tsx",
    ];
    for (const rel of converted) {
      const text = readFileSync(join(SRC, rel), "utf8");
      expect(text, rel).toMatch(/import FieldError from "@\/components\/ui\/FieldError"/);
      expect(text, rel).toContain("<FieldError");
    }
    const requests = readFileSync(join(SRC, "components/friends/FriendRequestActions.tsx"), "utf8");
    expect(requests.match(/<FieldError/g)).toHaveLength(2);
  });

  const LEGAL = ["app/(main)/profile/page.tsx", "app/(auth)/sign-in/page.tsx"];

  it("AC-10: text-text-muted is used only for placeholders and the two legal footers", () => {
    const offenders: string[] = [];
    for (const f of walk(SRC, [".tsx"])) {
      const rel = relative(SRC, f);
      const count = (readFileSync(f, "utf8").match(MUTED_RE) ?? []).length;
      if (count === 0) continue;
      if (!LEGAL.includes(rel) || count > 1) offenders.push(`${rel} (${count})`);
    }
    expect(offenders).toEqual([]);
  });

  it("AC-10: the allowed muted line in each legal file is the affiliation footer", () => {
    for (const rel of LEGAL) {
      const text = readFileSync(join(SRC, rel), "utf8");
      expect(text, rel).toMatch(/text-text-muted[^>]*>\s*ManaPals is not affiliated/);
    }
  });

  it("AC-1: no Tailwind 3 radius classes (-[--radius-) under src/", () => {
    const hits = files.filter((f) => /-\[--radius-/.test(readFileSync(f, "utf8")));
    expect(hits.map((f) => relative(SRC, f))).toEqual([]);
  });

  it("AC-2: each radius theme utility is used at least once", () => {
    const all = files.map((f) => readFileSync(f, "utf8")).join("\n");
    for (const cls of ["rounded-card", "rounded-t-card", "rounded-btn", "rounded-chip", "rounded-avatar"]) {
      const re = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*${cls}(?![\\w-])`);
      expect(re.test(all), cls).toBe(true);
    }
  });

  it("AC-2: the three bottom sheets round their top corners with rounded-t-card", () => {
    for (const name of ["ImportCollectionModal", "TradeSettingsSheet", "CardTradeSheet"]) {
      const text = readFileSync(join(SRC, `components/collection/${name}.tsx`), "utf8");
      expect(text, name).toMatch(/(?<![\w-])rounded-t-card(?![\w-])/);
    }
  });

  it("AC-8: no bare custom property inside an arbitrary value under src/", () => {
    const hits: string[] = [];
    for (const f of files) {
      const matches = readFileSync(f, "utf8").match(BARE_VAR_ARBITRARY_RE);
      if (matches) hits.push(`${relative(SRC, f)}: ${matches.join(", ")}`);
    }
    expect(hits).toEqual([]);
  });
});
