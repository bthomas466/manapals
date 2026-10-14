import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  fetchCards: vi.fn(),
  upsert: vi.fn(),
  from: vi.fn(),
  profilesUpdate: vi.fn(),
  profilesEq: vi.fn(),
  profilesIs: vi.fn(),
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

// --- onboarding marker (#34) ---

const CARD_ID = "11111111-1111-4111-8111-111111111111";
const goodRow = {
  scryfallId: CARD_ID,
  name: "Sol Ring",
  setCode: "cmr",
  quantity: 1,
  finish: "nonfoil",
  condition: "near_mint",
  language: "en",
  binderName: "",
  manaboxId: null,
};

function post(rows: unknown[]) {
  return POST(
    new Request("http://localhost/api/collection/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }) as never
  );
}

/** `cards` lookups return `cached`; `profiles` gets a chainable update().eq().is(). */
function wireFrom(opts: { cached: unknown[]; markError?: { message: string } | null }) {
  const cards: Record<string, unknown> = {};
  for (const m of ["select", "in", "gt", "order", "limit"]) cards[m] = () => cards;
  cards.returns = async () => ({ data: opts.cached, error: null });

  const chain: Record<string, unknown> = {};
  mocks.profilesEq.mockImplementation(() => chain);
  mocks.profilesIs.mockImplementation(async () => ({ error: opts.markError ?? null }));
  chain.eq = mocks.profilesEq;
  chain.is = mocks.profilesIs;
  mocks.profilesUpdate.mockImplementation(() => chain);

  mocks.from.mockImplementation((table: string) =>
    table === "profiles" ? { update: mocks.profilesUpdate } : cards
  );
}

const cachedCard = [{ scryfall_id: CARD_ID, name: "Sol Ring", set_code: "cmr" }];

describe("import route onboarding marker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("AC-19: a successful import marks the caller's profile, only where still unset", async () => {
    wireFrom({ cached: cachedCard });
    const res = await post([goodRow]);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ imported: 1, unmatched: [], totalRows: 1 });
    expect(mocks.profilesUpdate).toHaveBeenCalledTimes(1);
    const payload = mocks.profilesUpdate.mock.calls[0][0];
    expect(Object.keys(payload)).toEqual(["onboarded_at"]);
    expect(Number.isNaN(Date.parse(payload.onboarded_at))).toBe(false);
    expect(mocks.profilesEq).toHaveBeenCalledWith("user_id", "u1");
    expect(mocks.profilesIs).toHaveBeenCalledWith("onboarded_at", null);
  });

  it("AC-19: a failing marker update still returns 200 with the import result", async () => {
    wireFrom({ cached: cachedCard, markError: { message: "nope" } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post([goodRow]);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ imported: 1 });
    expect(logged).toHaveBeenCalled();
  });

  it("AC-20/21: 400 (no rows) never touches profiles", async () => {
    wireFrom({ cached: cachedCard });
    const res = await post([]);
    expect(res.status).toBe(400);
    expect(mocks.profilesUpdate).not.toHaveBeenCalled();
  });

  it("AC-20/21: 422 (nothing matched) never touches profiles or the RPC", async () => {
    wireFrom({ cached: [] });
    mocks.fetchCards.mockResolvedValue({ found: [] });
    const res = await post([goodRow]);
    expect(res.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.profilesUpdate).not.toHaveBeenCalled();
  });

  it("AC-20/21: 502 (Scryfall down) never touches profiles", async () => {
    wireFrom({ cached: [] });
    mocks.fetchCards.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post([goodRow]);
    expect(res.status).toBe(502);
    expect(mocks.profilesUpdate).not.toHaveBeenCalled();
  });

  it("AC-21: 500 (RPC failed) never touches profiles", async () => {
    wireFrom({ cached: cachedCard });
    mocks.rpc.mockResolvedValue({ error: { message: "rpc" } });
    const res = await post([goodRow]);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Import failed, nothing was changed." });
    expect(mocks.profilesUpdate).not.toHaveBeenCalled();
  });
});
