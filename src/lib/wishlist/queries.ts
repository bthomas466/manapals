import type { SupabaseClient } from "@supabase/supabase-js";

export type WishlistItem = {
  id: number;
  card_id: string;
  oracle_id: string | null;
  match_mode: "specific" | "any_printing";
  created_at: string;
  card: {
    scryfall_id: string;
    name: string;
    set_code: string;
    collector_number: string;
    image_small: string | null;
    image_normal: string | null;
    price_usd: number | null;
    price_usd_foil: number | null;
  } | null;
};

export async function getWishlistItems(
  supabase: SupabaseClient,
  userId: string
): Promise<WishlistItem[]> {
  const { data } = await supabase
    .from("wishlist_items")
    .select(
      "id, card_id, oracle_id, match_mode, created_at, card:cards(scryfall_id, name, set_code, collector_number, image_small, image_normal, price_usd, price_usd_foil)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<WishlistItem[]>();

  return data ?? [];
}
