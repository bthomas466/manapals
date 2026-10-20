import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadResult } from "@/lib/collection/read";

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

// Distinguishes a failed read from an empty wishlist. Trade matching treats an
// empty wishlist as "wants everything", so callers that count must not mistake a failure for [].
export async function readWishlistItems(
  supabase: SupabaseClient,
  userId: string
): Promise<ReadResult<WishlistItem>> {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select(
      "id, card_id, oracle_id, match_mode, created_at, card:cards(scryfall_id, name, set_code, collector_number, image_small, image_normal, price_usd, price_usd_foil)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<WishlistItem[]>();

  if (error || !data) return { ok: false, error: error?.message ?? "No data returned" };
  return { ok: true, rows: data };
}

export async function getWishlistItems(
  supabase: SupabaseClient,
  userId: string
): Promise<WishlistItem[]> {
  const result = await readWishlistItems(supabase, userId);
  return result.ok ? result.rows : [];
}
