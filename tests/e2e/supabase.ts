import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Node-side Supabase client signed in as the E2E user (RLS applies, so it can
// only write e2e_player's own rows). Used by mutating specs to set up fixtures
// and to snapshot/restore e2e_player's collection around them.

export type TradeStatus = "available" | "not_for_trade";
export type Finish = "nonfoil" | "foil" | "etched";

/** A fixture row. `card` is a seeded card name; `set` its set code. */
export type FixtureRow = {
  card: CardRef;
  quantity?: number;
  finish?: Finish;
  condition?: string;
  binder?: string;
  status?: TradeStatus | null;
};

export type CardRef = { name: string; set: string };

// Cards the staging seed puts in the `cards` table (see scripts/seed-staging.ts).
export const CARDS = {
  solRing: { name: "Sol Ring", set: "cmr" },
  arcaneSignet: { name: "Arcane Signet", set: "cmr" },
  lightningBolt: { name: "Lightning Bolt", set: "m10" },
  counterspell: { name: "Counterspell", set: "mh2" },
  swords: { name: "Swords to Plowshares", set: "ema" },
  pathToExile: { name: "Path to Exile", set: "con" },
  llanowar: { name: "Llanowar Elves", set: "dom" },
  cultivate: { name: "Cultivate", set: "m21" },
} satisfies Record<string, CardRef>;

type DbRow = {
  card_id: string;
  quantity: number;
  finish: Finish;
  condition: string;
  language: string;
  binder_name: string;
  manabox_id: string | null;
  trade_status: TradeStatus | null;
};

export type CollectionSnapshot = DbRow[];

let cached: Promise<{ client: SupabaseClient; userId: string }> | undefined;

/** Signed-in client plus the E2E user's id. Memoised per worker process. */
export function e2eSession() {
  cached ??= (async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await client.auth.signInWithPassword({
      email: process.env.E2E_EMAIL!,
      password: process.env.E2E_PASSWORD!,
    });
    if (error || !data.user) throw new Error(`E2E sign-in failed: ${error?.message}`);
    return { client, userId: data.user.id };
  })();
  return cached;
}

const idCache = new Map<string, string>();

/** scryfall_id of a seeded card, looked up by name and set code. */
export async function cardId({ name, set }: CardRef): Promise<string> {
  const key = `${name}::${set}`;
  const hit = idCache.get(key);
  if (hit) return hit;
  const { client } = await e2eSession();
  const { data, error } = await client
    .from("cards")
    .select("scryfall_id")
    .eq("name", name)
    .eq("set_code", set)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error(`Seeded card not found: ${name} (${set}). Run npm run seed:staging.`);
  idCache.set(key, data.scryfall_id);
  return data.scryfall_id;
}

type ImportRow = Omit<FixtureRow, "status">;

async function toRpcRows(rows: ImportRow[]) {
  return Promise.all(
    rows.map(async (r) => ({
      card_id: await cardId(r.card),
      quantity: r.quantity ?? 1,
      finish: r.finish ?? "nonfoil",
      condition: r.condition ?? "near_mint",
      language: "en",
      binder_name: r.binder ?? "",
      manabox_id: null,
    }))
  );
}

/**
 * Runs replace_collection_items as the E2E user WITHOUT resetting first, so
 * existing flags carry over exactly as a real re-import would.
 */
export async function importCollection(rows: ImportRow[]) {
  const { client } = await e2eSession();
  const { error } = await client.rpc("replace_collection_items", { p_items: await toRpcRows(rows) });
  if (error) throw new Error(`replace_collection_items failed: ${error.message}`);
}

/** Sets the flag on rows addressed by (card, finish, binder). */
export async function setFlags(
  flags: { card: CardRef; finish?: Finish; binder?: string; status: TradeStatus | null }[]
) {
  const { client, userId } = await e2eSession();
  for (const f of flags) {
    const { data, error } = await client
      .from("collection_items")
      .update({ trade_status: f.status })
      .eq("user_id", userId)
      .eq("card_id", await cardId(f.card))
      .eq("finish", f.finish ?? "nonfoil")
      .eq("binder_name", f.binder ?? "")
      .select("id");
    if (error || data?.length !== 1) {
      throw new Error(`setFlags failed for ${f.card.name}: ${error?.message ?? `${data?.length} rows updated`}`);
    }
  }
}

/**
 * Replaces e2e_player's whole collection with exactly these rows and flags.
 * Wipes first so no previous flag can carry over into the fixture.
 */
export async function setCollection(rows: FixtureRow[]) {
  await importCollection([]);
  if (rows.length === 0) return;
  await importCollection(rows);
  const flagged = rows.filter((r) => r.status);
  if (flagged.length > 0) {
    await setFlags(
      flagged.map((r) => ({ card: r.card, finish: r.finish, binder: r.binder, status: r.status! }))
    );
  }
}

/** e2e_player's current rows, keyed by what a test needs to assert on. */
export async function readFlags() {
  const { client, userId } = await e2eSession();
  const { data, error } = await client
    .from("collection_items")
    .select("binder_name, finish, quantity, condition, trade_status, card:cards(name)")
    .eq("user_id", userId)
    .returns<
      {
        binder_name: string;
        finish: Finish;
        quantity: number;
        condition: string;
        trade_status: TradeStatus | null;
        card: { name: string } | null;
      }[]
    >();
  if (error) throw new Error(`readFlags failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    name: r.card?.name ?? "",
    binder: r.binder_name,
    finish: r.finish,
    quantity: r.quantity,
    condition: r.condition,
    status: r.trade_status,
  }));
}

export async function snapshotCollection(): Promise<CollectionSnapshot> {
  const { client, userId } = await e2eSession();
  const { data, error } = await client
    .from("collection_items")
    .select("card_id, quantity, finish, condition, language, binder_name, manabox_id, trade_status")
    .eq("user_id", userId)
    .returns<DbRow[]>();
  if (error) throw new Error(`snapshotCollection failed: ${error.message}`);
  return data ?? [];
}

/** Puts the collection back exactly as snapshotted, flags included. */
export async function restoreCollection(snapshot: CollectionSnapshot) {
  const { client, userId } = await e2eSession();
  // Empty import first: otherwise the RPC would carry stale flags onto rows.
  const empty = await client.rpc("replace_collection_items", { p_items: [] });
  if (empty.error) throw new Error(`restore (clear) failed: ${empty.error.message}`);
  if (snapshot.length === 0) return;

  const { error } = await client.rpc("replace_collection_items", {
    // The RPC takes no trade_status; flags are re-applied below.
    p_items: snapshot.map((r) => ({
      card_id: r.card_id,
      quantity: r.quantity,
      finish: r.finish,
      condition: r.condition,
      language: r.language,
      binder_name: r.binder_name,
      manabox_id: r.manabox_id,
    })),
  });
  if (error) throw new Error(`restore (import) failed: ${error.message}`);

  for (const row of snapshot.filter((r) => r.trade_status)) {
    const { error: flagError } = await client
      .from("collection_items")
      .update({ trade_status: row.trade_status })
      .eq("user_id", userId)
      .eq("card_id", row.card_id)
      .eq("finish", row.finish)
      .eq("binder_name", row.binder_name);
    if (flagError) throw new Error(`restore (flags) failed: ${flagError.message}`);
  }
}
