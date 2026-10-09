// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  mergeDuplicateRows,
  normalizeCondition,
  normalizeFinish,
  parseManaboxCsv,
  type NormalizedRow,
} from "@/lib/csv/manabox";

function csvFile(contents: string): File {
  return new File([contents], "export.csv", { type: "text/csv" });
}

const HEADER = "Name,Set Code,Quantity,Foil,Condition,Language,Scryfall ID,Binder/List Name,ManaBox ID";

describe("normalizeFinish", () => {
  it.each([
    ["foil", "foil"],
    ["FOIL", "foil"],
    ["etched", "etched"],
    ["foil etched", "etched"],
    ["normal", "nonfoil"],
    ["", "nonfoil"],
    [undefined, "nonfoil"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeFinish(raw)).toBe(expected);
  });
});

describe("normalizeCondition", () => {
  it.each([
    ["near_mint", "near_mint"],
    ["NM", "near_mint"],
    ["Lightly Played", "lightly_played"],
    ["hp", "heavily_played"],
    ["dmg", "damaged"],
    ["garbage", "near_mint"],
    [undefined, "near_mint"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeCondition(raw)).toBe(expected);
  });
});

describe("mergeDuplicateRows", () => {
  const base: NormalizedRow = {
    scryfallId: "abc",
    name: "Sol Ring",
    setCode: "cmr",
    quantity: 1,
    finish: "nonfoil",
    condition: "near_mint",
    language: "en",
    binderName: "",
    manaboxId: null,
  };

  it("sums quantities for the same card, finish, and binder", () => {
    const merged = mergeDuplicateRows([base, { ...base, quantity: 2 }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(3);
  });

  it("keeps different finishes and binders separate", () => {
    const merged = mergeDuplicateRows([base, { ...base, finish: "foil" }, { ...base, binderName: "Trade" }]);
    expect(merged).toHaveLength(3);
  });

  it("falls back to name + set identity when scryfall id is missing", () => {
    const noId = { ...base, scryfallId: null };
    const merged = mergeDuplicateRows([noId, { ...noId, name: "SOL RING", setCode: "CMR" }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(2);
  });

  it("does not mutate the input rows", () => {
    const rows = [{ ...base }, { ...base }];
    mergeDuplicateRows(rows);
    expect(rows[0].quantity).toBe(1);
  });
});

describe("parseManaboxCsv", () => {
  it("parses and normalizes a Manabox export", async () => {
    const result = await parseManaboxCsv(
      csvFile(`${HEADER}\nSol Ring,cmr,2,foil,NM,en,abc,Main,42\nSol Ring,cmr,1,foil,NM,en,abc,Main,43\n`)
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        scryfallId: "abc",
        name: "Sol Ring",
        setCode: "cmr",
        quantity: 3,
        finish: "foil",
        condition: "near_mint",
        language: "en",
        binderName: "Main",
        manaboxId: "42",
      },
    ]);
  });

  it("matches headers case-insensitively", async () => {
    const result = await parseManaboxCsv(csvFile("name,set code,QUANTITY\nSol Ring,cmr,1\n"));
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
  });

  it("rejects files missing required columns", async () => {
    const result = await parseManaboxCsv(csvFile("Name,Quantity\nSol Ring,1\n"));
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toMatch(/missing required column\(s\): Set Code/);
  });

  it("skips invalid rows and reports their line numbers", async () => {
    const result = await parseManaboxCsv(
      csvFile(`${HEADER}\nSol Ring,cmr,1,,,,,,\n,cmr,1,,,,,,\nArcane Signet,cmr,0,,,,,,\n`)
    );
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([
      "Row 3: skipped — missing name, set code, or valid quantity.",
      "Row 4: skipped — missing name, set code, or valid quantity.",
    ]);
  });
});
