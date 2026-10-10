/**
 * Seeds the STAGING Supabase project with two friended test users, real
 * Scryfall cards, collections, and wishlists that exercise every Trade Match
 * section. Idempotent: re-running resets the seeded users' data.
 *
 *   npm run seed:staging
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local
 * and refuses to run against production.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCardsByIdentifiers, type ScryfallCard } from "@/lib/scryfall/client";
import { upsertCards } from "@/lib/scryfall/cardRow";

const PROD_REF = "wzjkexompmfvuxnmkzxl";

type Finish = "nonfoil" | "foil" | "etched";
type SeedItem = { name: string; set: string; quantity?: number; finish?: Finish };
type SeedWant = { name: string; set: string; mode: "specific" | "any_printing" };
type SeedUser = {
  email: string;
  username: string;
  displayName: string;
  collection: SeedItem[];
  wishlist: SeedWant[];
};

// Expected Trade Match for e2e_player viewing e2e_friend:
//   You have, they want:   Arcane Signet        (friend's wishlist narrows to it)
//   They have, you want:   Swords to Plowshares (any-printing wish, matched by oracle id)
//   You both have extras:  Sol Ring             (player owns 2)
const USERS: SeedUser[] = [
  {
    email: "e2e@manapals.test",
    username: "e2e_player",
    displayName: "E2E Player",
    collection: [
      { name: "Sol Ring", set: "cmr", quantity: 2 },
      { name: "Arcane Signet", set: "cmr" },
      { name: "Lightning Bolt", set: "m10", finish: "foil" },
      { name: "Counterspell", set: "mh2" },
    ],
    wishlist: [{ name: "Swords to Plowshares", set: "ema", mode: "any_printing" }],
  },
  {
    email: "e2e-friend@manapals.test",
    username: "e2e_friend",
    displayName: "E2E Friend",
    collection: [
      { name: "Sol Ring", set: "cmr" },
      { name: "Swords to Plowshares", set: "ema" },
      { name: "Llanowar Elves", set: "dom", quantity: 3 },
      { name: "Cultivate", set: "m21" },
    ],
    wishlist: [{ name: "Arcane Signet", set: "cmr", mode: "specific" }],
  },
];

function assertStaging() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (expected in .env.local).");
  }
  if (url.includes(PROD_REF)) {
    throw new Error(`Refusing to seed: ${url} is the PRODUCTION project.`);
  }
  return url;
}

const cardKey = (name: string, set: string) => `${name.toLowerCase()}::${set.toLowerCase()}`;

async function fetchSeedCards(): Promise<Map<string, ScryfallCard>> {
  const wanted = new Map<string, { name: string; set: string }>();
  for (const user of USERS) {
    for (const { name, set } of [...user.collection, ...user.wishlist]) wanted.set(cardKey(name, set), { name, set });
  }

  const { found, notFound } = await fetchCardsByIdentifiers([...wanted.values()]);
  if (notFound.length > 0) throw new Error(`Scryfall could not find: ${JSON.stringify(notFound)}`);

  await upsertCards(found);
  return new Map(found.map((card) => [cardKey(card.name, card.set), card]));
}

async function ensureUser(admin: ReturnType<typeof createAdminClient>, user: SeedUser): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const existing = data.users.find((u) => u.email === user.email);
  if (existing) return existing.id;

  // Only the friend is auto-created; the primary E2E user's password lives in
  // the user's password manager / GitHub secrets, so it must already exist.
  if (user.email === USERS[0].email) {
    throw new Error(`${user.email} does not exist. Create it in the Supabase dashboard (Authentication → Users).`);
  }
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: user.email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: user.displayName },
  });
  if (createError) throw createError;
  return created.user.id;
}

async function main() {
  const url = assertStaging();
  console.log(`Seeding ${url}`);
  const admin = createAdminClient();

  const cards = await fetchSeedCards();
  console.log(`✓ ${cards.size} cards upserted from Scryfall`);

  const ids: string[] = [];
  for (const user of USERS) {
    const userId = await ensureUser(admin, user);
    ids.push(userId);

    // The signup trigger creates the profile; pin a stable username for tests.
    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        { user_id: userId, username: user.username, display_name: user.displayName },
        { onConflict: "user_id" }
      );
    if (profileError) throw profileError;

    const lookup = (name: string, set: string) => {
      const card = cards.get(cardKey(name, set));
      if (!card) throw new Error(`Card missing after fetch: ${name} (${set})`);
      return card;
    };

    await admin.from("collection_items").delete().eq("user_id", userId).throwOnError();
    await admin
      .from("collection_items")
      .insert(
        user.collection.map((item) => ({
          user_id: userId,
          card_id: lookup(item.name, item.set).id,
          quantity: item.quantity ?? 1,
          finish: item.finish ?? "nonfoil",
        }))
      )
      .throwOnError();

    await admin.from("wishlist_items").delete().eq("user_id", userId).throwOnError();
    await admin
      .from("wishlist_items")
      .insert(
        user.wishlist.map((want) => {
          const card = lookup(want.name, want.set);
          return { user_id: userId, card_id: card.id, oracle_id: card.oracle_id ?? null, match_mode: want.mode };
        })
      )
      .throwOnError();

    console.log(`✓ ${user.username}: ${user.collection.length} collection rows, ${user.wishlist.length} wishlist`);
  }

  await admin
    .from("friendships")
    .upsert({ requester_id: ids[0], addressee_id: ids[1], status: "accepted" }, { onConflict: "user_low,user_high" })
    .throwOnError();
  console.log("✓ e2e_player ↔ e2e_friend are friends");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
