import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import CollectionGrid, { type CollectionItem } from "@/components/collection/CollectionGrid";
import FriendActionButton from "@/components/friends/FriendActionButton";
import WishlistGrid from "@/components/wishlist/WishlistGrid";
import { getWishlistItems } from "@/lib/wishlist/queries";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const username = rawUsername.toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url, collection_visibility")
    .eq("username", username)
    .maybeSingle();

  if (!profile) notFound();
  if (profile.user_id === user.id) redirect("/profile");

  const { data: friendship } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${profile.user_id}),and(requester_id.eq.${profile.user_id},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  const status: "none" | "outgoing" | "incoming" | "friends" = !friendship
    ? "none"
    : friendship.status === "accepted"
      ? "friends"
      : friendship.requester_id === user.id
        ? "outgoing"
        : "incoming";

  const canViewCollection = profile.collection_visibility === "public" || status === "friends";

  let items: CollectionItem[] = [];
  if (canViewCollection) {
    const { data } = await supabase
      .from("collection_items")
      .select(
        "id, quantity, finish, condition, binder_name, card:cards(scryfall_id, name, set_code, rarity, colors, image_small, image_normal, price_usd, price_usd_foil)"
      )
      .eq("user_id", profile.user_id)
      .order("id")
      .returns<CollectionItem[]>();
    items = data ?? [];
  }

  // Wishlist is friends-only regardless of collection_visibility (PRD §4.7).
  const wishlistItems = status === "friends" ? await getWishlistItems(supabase, profile.user_id) : [];

  return (
    <div className="px-4 pt-6 space-y-6 pb-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-20 h-20 rounded-[--radius-avatar] bg-elevated border border-border overflow-hidden flex items-center justify-center text-3xl shrink-0">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            "👤"
          )}
        </div>
        <div>
          <p className="font-bold text-text-primary text-lg">{profile.display_name}</p>
          <p className="text-sm text-text-muted">@{profile.username}</p>
        </div>
        <FriendActionButton
          status={status}
          targetUserId={profile.user_id}
          friendshipId={friendship?.id ?? null}
        />
      </div>

      {canViewCollection ? (
        <CollectionGrid
          items={items}
          emptyState={
            <p className="text-sm text-text-secondary text-center pt-8">
              {profile.display_name} hasn&apos;t imported any cards yet.
            </p>
          }
        />
      ) : (
        <div className="flex flex-col items-center justify-center pt-12 gap-3 text-center">
          <div className="w-16 h-16 rounded-[--radius-card] bg-elevated border border-border flex items-center justify-center text-3xl">
            🔒
          </div>
          <p className="font-semibold text-text-primary">Only friends can see this collection</p>
          <p className="text-sm text-text-secondary max-w-xs">
            Add {profile.display_name} as a friend to browse their cards.
          </p>
        </div>
      )}

      {status === "friends" && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-text-primary">Wishlist</h2>
          <WishlistGrid
            items={wishlistItems}
            editable={false}
            emptyState={
              <p className="text-sm text-text-secondary">
                {profile.display_name} hasn&apos;t added anything to their wishlist yet.
              </p>
            }
          />
        </section>
      )}
    </div>
  );
}
