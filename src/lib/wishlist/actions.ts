"use server";

import { createClient } from "@/lib/supabase/server";
import { upsertCards } from "@/lib/scryfall/cardRow";
import type { ScryfallCard } from "@/lib/scryfall/client";

type ActionResult = { error?: string };
type MatchMode = "specific" | "any_printing";

export async function addWishlistItem(card: ScryfallCard, matchMode: MatchMode): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (matchMode === "any_printing" && !card.oracle_id) {
    return { error: "This card can't be added as \"any printing\"." };
  }

  try {
    await upsertCards([card]);
  } catch {
    return { error: "Couldn't save card data. Try again shortly." };
  }

  const { error } = await supabase.from("wishlist_items").insert({
    user_id: user.id,
    card_id: card.id,
    oracle_id: card.oracle_id ?? null,
    match_mode: matchMode,
  });

  if (error) {
    if (error.code === "23505") return { error: "Already on your wishlist." };
    return { error: "Couldn't add to wishlist." };
  }
  return {};
}

export async function removeWishlistItem(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("wishlist_items").delete().eq("id", id);
  if (error) return { error: "Couldn't remove." };
  return {};
}
