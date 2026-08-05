import { createAdminClient } from "@/lib/supabase/admin";
import { getColors, getImageUris, type ScryfallCard } from "@/lib/scryfall/client";

export function toCardInsert(card: ScryfallCard) {
  const images = getImageUris(card);
  return {
    scryfall_id: card.id,
    oracle_id: card.oracle_id ?? null,
    name: card.name,
    set_code: card.set,
    set_name: card.set_name,
    collector_number: card.collector_number,
    rarity: card.rarity,
    mana_cost: card.mana_cost ?? null,
    cmc: card.cmc ?? null,
    type_line: card.type_line,
    colors: getColors(card),
    color_identity: card.color_identity ?? [],
    image_small: images?.small ?? null,
    image_normal: images?.normal ?? null,
    price_usd: card.prices?.usd ? Number(card.prices.usd) : null,
    price_usd_foil: card.prices?.usd_foil ? Number(card.prices.usd_foil) : null,
    scryfall_uri: card.scryfall_uri ?? null,
    raw_data: card,
  };
}

// cards has no INSERT policy for regular users (only cards_select_authenticated),
// so writes go through the service-role admin client.
export async function upsertCards(cards: ScryfallCard[]): Promise<void> {
  if (cards.length === 0) return;
  const unique = Array.from(new Map(cards.map((c) => [c.id, c])).values());

  const admin = createAdminClient();
  const { error } = await admin
    .from("cards")
    .upsert(unique.map(toCardInsert), { onConflict: "scryfall_id" });

  if (error) throw error;
}
