import Papa from "papaparse";

export type Finish = "nonfoil" | "foil" | "etched";

export type Condition =
  | "mint"
  | "near_mint"
  | "lightly_played"
  | "moderately_played"
  | "heavily_played"
  | "damaged";

export type NormalizedRow = {
  scryfallId: string | null;
  name: string;
  setCode: string;
  quantity: number;
  finish: Finish;
  condition: Condition;
  language: string;
  binderName: string;
  manaboxId: string | null;
};

export type ParseResult = {
  rows: NormalizedRow[];
  errors: string[];
};

const REQUIRED_HEADERS = ["Name", "Set Code", "Quantity"];

const CONDITION_MAP: Record<string, Condition> = {
  mint: "mint",
  m: "mint",
  near_mint: "near_mint",
  "near mint": "near_mint",
  nm: "near_mint",
  lightly_played: "lightly_played",
  "lightly played": "lightly_played",
  lp: "lightly_played",
  moderately_played: "moderately_played",
  "moderately played": "moderately_played",
  mp: "moderately_played",
  heavily_played: "heavily_played",
  "heavily played": "heavily_played",
  hp: "heavily_played",
  damaged: "damaged",
  dmg: "damaged",
  d: "damaged",
};

export function normalizeFinish(raw: string | undefined): Finish {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "foil") return "foil";
  if (value === "etched" || value === "foil etched") return "etched";
  return "nonfoil";
}

export function normalizeCondition(raw: string | undefined): Condition {
  const value = (raw ?? "").trim().toLowerCase();
  return CONDITION_MAP[value] ?? "near_mint";
}

function rowKey(row: NormalizedRow): string {
  const identity = row.scryfallId ?? `${row.name.toLowerCase()}::${row.setCode.toLowerCase()}`;
  return `${identity}::${row.finish}::${row.binderName}`;
}

export function mergeDuplicateRows(rows: NormalizedRow[]): NormalizedRow[] {
  const merged = new Map<string, NormalizedRow>();
  for (const row of rows) {
    const key = rowKey(row);
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += row.quantity;
    } else {
      merged.set(key, { ...row });
    }
  }
  return Array.from(merged.values());
}

type ManaboxRawRow = Record<string, string>;

export function parseManaboxCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<ManaboxRawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
        if (missing.length > 0) {
          resolve({
            rows: [],
            errors: [
              `This doesn't look like a Manabox export — missing required column(s): ${missing.join(", ")}.`,
            ],
          });
          return;
        }

        const errors: string[] = [];
        const rows: NormalizedRow[] = [];

        results.data.forEach((raw, index) => {
          const name = raw["Name"]?.trim();
          const setCode = raw["Set Code"]?.trim();
          const quantityRaw = raw["Quantity"]?.trim();
          const quantity = quantityRaw ? parseInt(quantityRaw, 10) : NaN;

          if (!name || !setCode || !Number.isFinite(quantity) || quantity <= 0) {
            errors.push(`Row ${index + 2}: skipped — missing name, set code, or valid quantity.`);
            return;
          }

          rows.push({
            scryfallId: raw["Scryfall ID"]?.trim() || null,
            name,
            setCode,
            quantity,
            finish: normalizeFinish(raw["Foil"]),
            condition: normalizeCondition(raw["Condition"]),
            language: raw["Language"]?.trim() || "en",
            binderName: raw["Binder/List Name"]?.trim() || "",
            manaboxId: raw["ManaBox ID"]?.trim() || null,
          });
        });

        resolve({ rows: mergeDuplicateRows(rows), errors });
      },
      error: (error) => {
        resolve({ rows: [], errors: [`Failed to read file: ${error.message}`] });
      },
    });
  });
}
