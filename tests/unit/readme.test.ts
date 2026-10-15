import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = resolve(__dirname, "../..");
const readme = readFileSync(join(root, "README.md"), "utf8");
const templatesDir = join(root, ".github/ISSUE_TEMPLATE");

const GETTING_STARTED = "\n## Getting started";
const gsIndex = readme.indexOf(GETTING_STARTED);
const top = gsIndex >= 0 ? readme.slice(0, gsIndex) : readme;

type Field = {
  type: string;
  id?: string;
  attributes?: { value?: string; options?: string[] };
  validations?: { required?: boolean };
};
type Template = {
  name?: string;
  description?: string;
  labels?: string | string[];
  body?: Field[];
};

const loadTemplate = (file: string) =>
  parse(readFileSync(join(templatesDir, file), "utf8")) as Template;

const labelsOf = (t: Template): string[] => {
  if (t.labels === undefined || t.labels === null) return [];
  if (Array.isArray(t.labels)) return t.labels.map(String);
  return String(t.labels)
    .split(",")
    .map((s) => s.trim());
};

/** Text from the heading matching `heading` to the next heading of any level. */
function sectionUnder(md: string, heading: RegExp): string | null {
  const m = heading.exec(md);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = md.slice(start);
  const next = rest.search(/^#{1,6} /m);
  return next >= 0 ? rest.slice(0, next) : rest;
}

const stripFences = (md: string) => md.replace(/```[\s\S]*?```/g, "");

function images(md: string): string[] {
  const out: string[] = [];
  for (const m of md.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) out.push(m[1]);
  for (const m of md.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) out.push(m[1]);
  return out;
}

// Suggest section (heading containing "Suggest", `##` level).
const suggestHeading = /^## [^\n]*Suggest[^\n]*$/m;
const suggestBody = sectionUnder(readme, suggestHeading);

const TEMPLATE_LINK =
  /https:\/\/github\.com\/bthomas466\/manapals\/issues\/new\?template=([\w.-]+)/;
const linkedTemplate = suggestBody?.match(TEMPLATE_LINK)?.[1];

describe("README: identity and live link", () => {
  it("AC-1: top section links to the live app", () => {
    expect(gsIndex).toBeGreaterThan(0);
    expect(
      /\]\(https:\/\/manapals\.vercel\.app\/?\)/.test(top) ||
        /href="https:\/\/manapals\.vercel\.app\/?"/.test(top),
    ).toBe(true);
  });

  it("AC-2: a relative logo under public/brand/ exists in the first 10 lines", () => {
    const first10 = readme.split("\n").slice(0, 10).join("\n");
    const logos = images(first10)
      .map((s) => s.replace(/^\.\//, ""))
      .filter((s) => s.startsWith("public/brand/"));
    expect(logos.length).toBeGreaterThan(0);
    for (const l of logos) expect(existsSync(join(root, l))).toBe(true);
  });

  it("AC-3: keeps the not-affiliated note and required headings in order", () => {
    expect(readme).toContain(
      "ManaPals is not affiliated with Manabox or SkillDevs SC.",
    );
    const idx = (re: RegExp) => readme.search(re);
    const what = idx(/^## What it is\s*$/m);
    const features = idx(/^## Features\s*$/m);
    const start = idx(/^## Getting started\s*$/m);
    const tech = idx(/^## Tech stack\s*$/m);
    for (const i of [what, features, start, tech]) expect(i).toBeGreaterThanOrEqual(0);
    expect(what).toBeLessThan(features);
    expect(features).toBeLessThan(start);
    expect(start).toBeLessThan(tech);
  });
});

describe("README: features are accurate", () => {
  it("AC-4: shipped features are listed under Available today", () => {
    const m = /^### Available today[^\n]*$/m.exec(readme);
    expect(m).not.toBeNull();
    const rest = readme.slice(m!.index + m![0].length);
    const end = rest.search(
      /^(#{2,3} [^\n]*(not yet|coming soon)|## )/im,
    );
    const section = (end >= 0 ? rest.slice(0, end) : rest).toLowerCase();
    expect(section.trim().length).toBeGreaterThan(0);

    expect(section).toContain("trade match");
    expect(section).toContain("wishlist");
    expect(section).toContain("onboarding");
    expect(
      section.includes("available to trade") ||
        section.includes("trade availability"),
    ).toBe(true);
    expect(
      section.includes("estimated value") ||
        section.includes("collection value"),
    ).toBe(true);
    expect(section).toContain("public");
    expect(section).toContain("friend");
  });

  it("AC-5: shipped features are not listed as not yet / coming soon", () => {
    const section = sectionUnder(
      readme,
      /^#{2,3} [^\n]*(not yet|coming soon)[^\n]*$/im,
    );
    expect(section).not.toBeNull();
    expect(section!.trim().length).toBeGreaterThan(0);
    const lower = section!.toLowerCase();
    expect(lower).not.toContain("trade match");
    expect(lower).not.toContain("wishlist");
    expect(lower).not.toContain("public collection visibility");
  });

  it("AC-6: no stale 'coming soon' wording", () => {
    expect(readme).not.toContain("so trade matching has something to match against");
  });
});

describe("README: suggesting ideas", () => {
  it("AC-7: Suggest section precedes Getting started and has the three steps in order", () => {
    const h = suggestHeading.exec(readme);
    expect(h).not.toBeNull();
    expect(h!.index).toBeLessThan(readme.search(/^## Getting started/m));
    const body = suggestBody!.toLowerCase();
    const i = body.indexOf("suggest");
    const j = body.indexOf("review", i);
    const k = body.indexOf("built", j);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(j).toBeGreaterThanOrEqual(0);
    expect(k).toBeGreaterThanOrEqual(0);
  });

  it("AC-8: links to an existing template that is not feature.yml", () => {
    expect(suggestBody).not.toBeNull();
    expect(linkedTemplate).toBeDefined();
    expect(linkedTemplate).not.toBe("feature.yml");
    expect(existsSync(join(templatesDir, linkedTemplate!))).toBe(true);
  });

  it("AC-9: outsiders are not sent to the factory", () => {
    expect(readme).not.toContain("template=feature.yml");
    expect(top.toLowerCase()).not.toContain("factory");
  });
});

describe("issue templates", () => {
  it("AC-10: linked template is a valid form without the factory label", () => {
    expect(linkedTemplate).toBeDefined();
    const t = loadTemplate(linkedTemplate!);
    expect(typeof t.name).toBe("string");
    expect(t.name!.length).toBeGreaterThan(0);
    expect(typeof t.description).toBe("string");
    expect(t.description!.length).toBeGreaterThan(0);
    expect(Array.isArray(t.body)).toBe(true);
    expect(t.body!.length).toBeGreaterThan(0);

    expect(labelsOf(t)).not.toContain("factory");

    expect(
      t.body!.some(
        (b) => b.type === "textarea" && b.validations?.required === true,
      ),
    ).toBe(true);

    const options = t
      .body!.filter((b) => b.type === "dropdown")
      .flatMap((b) => b.attributes?.options ?? []);
    expect(options.some((o) => /idea/i.test(o))).toBe(true);
    expect(options.some((o) => /broken|bug/i.test(o))).toBe(true);
  });

  it("AC-11: linked template explains that the maintainer reviews suggestions", () => {
    const t = loadTemplate(linkedTemplate!);
    expect(
      t.body!.some(
        (b) => b.type === "markdown" && /review/i.test(b.attributes?.value ?? ""),
      ),
    ).toBe(true);
  });

  it("AC-12: feature.yml keeps its factory flow and is marked maintainer-only", () => {
    const t = loadTemplate("feature.yml");
    expect(t.labels).toEqual(["factory"]);
    expect(t.body!.map((b) => b.id).filter(Boolean)).toEqual([
      "idea",
      "why",
      "notes",
    ]);
    expect(`${t.name} ${t.description}`).toMatch(/maintainer/i);
  });

  it("AC-13: only feature.yml auto-applies the factory label", () => {
    const files = readdirSync(templatesDir).filter(
      (f) => /\.ya?ml$/.test(f) && f !== "config.yml",
    );
    expect(files.length).toBeGreaterThan(1);
    const withFactory = files.filter((f) =>
      labelsOf(loadTemplate(f)).includes("factory"),
    );
    expect(withFactory).toEqual(["feature.yml"]);
  });
});

describe("README: links and privacy", () => {
  it("AC-14: relative links and image paths resolve", () => {
    const md = stripFences(readme);
    const targets: string[] = [];
    for (const m of md.matchAll(/\]\(([^)\s]+)/g)) targets.push(m[1]);
    for (const m of md.matchAll(/\b(?:src|href)="([^"]+)"/g)) targets.push(m[1]);
    const relative = targets
      .filter((t) => !/^(https?:|#|mailto:)/.test(t))
      .map((t) => t.replace(/[#?].*$/, "").replace(/^\.\//, ""))
      .filter(Boolean);
    expect(relative.length).toBeGreaterThan(0);
    for (const r of relative) {
      expect(existsSync(join(root, r)), `missing: ${r}`).toBe(true);
    }
  });

  it("AC-15: no internal project refs or key values", () => {
    expect(readme).not.toContain("rycuhmeorqdymbdotpys");
    expect(readme).not.toContain("wzjkexompmfvuxnmkzxl");
    expect(readme).not.toMatch(/SERVICE_ROLE_KEY=[^\s`]/);
  });

  it("AC-16: every `npm run <name>` is a real script", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const names = [...readme.matchAll(/npm run ([\w:.-]+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(Object.keys(pkg.scripts), `script: ${n}`).toContain(n);
    }
  });
});
