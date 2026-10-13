import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  fetchCards: vi.fn(),
  upsert: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/lib/scryfall/client", () => ({ fetchCardsByIdentifiers: mocks.fetchCards }));
vi.mock("@/lib/scryfall/cardRow", () => ({ upsertCards: mocks.upsert }));

import { POST } from "@/app/api/collection/import/route";

const root = join(__dirname, "..", "..");
const routeSrc = readFileSync(join(root, "src/app/api/collection/import/route.ts"), "utf8");
const lookupSrc = readFileSync(join(root, "src/lib/cards/cacheLookup.ts"), "utf8");

describe("import route wiring", () => {
  it("AC-10: uses the lookup helper, not raw .in() queries", () => {
    expect(routeSrc).not.toMatch(/\.in\(\s*["'](scryfall_id|set_code)["']/);
    expect(routeSrc).toContain("prepareImport");
    expect(routeSrc).toContain("supabaseCacheFetcher");
  });

  it("AC-12: never uses the admin client; reads only the three card columns", () => {
    expect(routeSrc).not.toContain("@/lib/supabase/admin");
    expect(lookupSrc).not.toContain("@/lib/supabase/admin");
    expect(lookupSrc).toContain('.select("scryfall_id, name, set_code")');
  });
});

describe("import route lookup failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC-11/AC-12: aborts with 500 before Scryfall, upsert or the RPC, reading via the session client", async () => {
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "in", "gt", "order", "limit"]) builder[m] = () => builder;
    builder.returns = async () => ({ data: null, error: { message: "boom" } });
    mocks.from.mockReturnValue(builder);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const rows = [
      {
        scryfallId: crypto.randomUUID(),
        name: "X",
        setCode: "abc",
        quantity: 1,
        finish: "nonfoil",
        condition: "near_mint",
        language: "en",
        binderName: "Main",
        manaboxId: null,
      },
    ];
    const req = new Request("http://localhost/api/collection/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
    const res = await POST(req as never);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Couldn't read card data. Nothing was changed — try again shortly.",
    });
    expect(mocks.from).toHaveBeenCalledWith("cards");
    expect(mocks.fetchCards).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
