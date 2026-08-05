import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getWishlistItems } from "@/lib/wishlist/queries";
import AddCardSearch from "@/components/wishlist/AddCardSearch";
import WishlistGrid from "@/components/wishlist/WishlistGrid";

export default async function WishlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const items = await getWishlistItems(supabase, user.id);

  return (
    <div className="px-4 pt-6 space-y-4 pb-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-text-primary">Wishlist</h1>
          <p className="text-sm text-text-secondary">Cards you&apos;re looking for.</p>
        </div>
        <AddCardSearch />
      </header>

      <WishlistGrid
        items={items}
        editable
        emptyState={
          <div className="flex flex-col items-center justify-center pt-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-[--radius-card] bg-elevated border border-border flex items-center justify-center text-3xl">
              ✨
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-text-primary">Wishlist is empty</p>
              <p className="text-sm text-text-secondary max-w-xs">
                Add cards you want — friends will see them on your profile and in trade matches.
              </p>
            </div>
          </div>
        }
      />
    </div>
  );
}
