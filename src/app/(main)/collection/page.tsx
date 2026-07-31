import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CollectionView, { type CollectionItem } from "@/components/collection/CollectionView";

export default async function CollectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: items } = await supabase
    .from("collection_items")
    .select(
      "id, quantity, finish, condition, binder_name, card:cards(scryfall_id, name, set_code, rarity, colors, image_small, image_normal, price_usd, price_usd_foil)"
    )
    .order("id")
    .returns<CollectionItem[]>();

  return <CollectionView initialItems={items ?? []} />;
}
