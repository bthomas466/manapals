import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CollectionView, { type CollectionItem } from "@/components/collection/CollectionView";
import CollectionLoadError from "@/components/collection/CollectionLoadError";
import { getCollectionItems } from "@/lib/collection/queries";
import { collectionPageState } from "@/lib/collection/read";

export default async function CollectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const result = await getCollectionItems<CollectionItem>(
    supabase,
    user.id,
    "id, quantity, finish, condition, binder_name, trade_status, card:cards(scryfall_id, name, set_code, rarity, colors, image_small, image_normal, price_usd, price_usd_foil)"
  );
  const state = collectionPageState(result);

  if (state.kind === "error") {
    return (
      <div className="px-4 pt-6 space-y-4 pb-4">
        <h1 className="text-xl font-bold text-text-primary">Collection</h1>
        <CollectionLoadError title="Couldn't load your collection" />
      </div>
    );
  }

  return <CollectionView initialItems={state.items} />;
}
