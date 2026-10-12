import { expect, test } from "@playwright/test";
import { requireE2EUser } from "../helpers";
import { e2eSession } from "../supabase";

// RLS checks through a Node Supabase client signed in as e2e_player (no
// browser). Read-only on seeded data; it lives in the serial project only so it
// never overlaps with the specs that rewrite e2e_player's collection.
requireE2EUser();

async function userIdOf(username: string) {
  const { client } = await e2eSession();
  const { data, error } = await client.from("profiles").select("user_id").eq("username", username).maybeSingle();
  expect(error).toBeNull();
  expect(data, `${username} should exist; run npm run seed:staging`).not.toBeNull();
  return data!.user_id as string;
}

type FriendRow = { id: number; trade_status: string | null; card: { name: string } | null };

async function friendRows(friendId: string) {
  const { client } = await e2eSession();
  const { data, error } = await client
    .from("collection_items")
    .select("id, trade_status, card:cards(name)")
    .eq("user_id", friendId)
    .returns<FriendRow[]>();
  expect(error).toBeNull();
  return data ?? [];
}

test("AC-27: a non-friend cannot read a friends-only collection or its flags", async () => {
  const { client } = await e2eSession();
  const strangerId = await userIdOf("e2e_stranger");

  const { data, error } = await client
    .from("collection_items")
    .select("id, trade_status")
    .eq("user_id", strangerId);
  expect(error).toBeNull();
  expect(data).toEqual([]);

  const flagged = await client
    .from("collection_items")
    .select("id")
    .eq("user_id", strangerId)
    .eq("trade_status", "not_for_trade");
  expect(flagged.data).toEqual([]);
});

test("AC-28: a friend cannot set or clear another user's trade flag", async () => {
  const { client } = await e2eSession();
  const friendId = await userIdOf("e2e_friend");
  const before = await friendRows(friendId);
  expect(before.find((r) => r.card?.name === "Swords to Plowshares")?.trade_status).toBe("available");

  for (const trade_status of ["not_for_trade", null] as const) {
    const { data, error } = await client
      .from("collection_items")
      .update({ trade_status })
      .eq("user_id", friendId)
      .select("id");
    // Either an error or zero affected rows is acceptable; a changed row is not.
    if (!error) expect(data).toEqual([]);
  }

  const after = await friendRows(friendId);
  expect(after.map((r) => [r.id, r.trade_status]).sort()).toEqual(before.map((r) => [r.id, r.trade_status]).sort());
  expect(after.find((r) => r.card?.name === "Swords to Plowshares")?.trade_status).toBe("available");
});

test("AC-29: an accepted friend can read the flag values", async () => {
  const friendId = await userIdOf("e2e_friend");
  const rows = await friendRows(friendId);

  expect(rows.length).toBeGreaterThan(1);
  expect(rows.find((r) => r.card?.name === "Swords to Plowshares")?.trade_status).toBe("available");
  expect(rows.find((r) => r.card?.name === "Path to Exile")?.trade_status).toBeNull();
});
