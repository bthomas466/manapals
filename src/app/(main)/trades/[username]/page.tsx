import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import CollectionLoadError from "@/components/collection/CollectionLoadError";
import { MatchSection } from "@/components/trades/MatchSection";
import { getCollectionItems } from "@/lib/collection/queries";
import { getWishlistItems } from "@/lib/wishlist/queries";
import {
  computeTradeMatches,
  describeOffer,
  formatOfferLine,
  type CollectionItemWithOracle,
} from "@/lib/trades/match";

const TRADE_COLLECTION_COLUMNS =
  "id, quantity, finish, condition, binder_name, trade_status, card:cards(scryfall_id, oracle_id, name, set_code, rarity, colors, image_small, image_normal, price_usd, price_usd_foil)";

export default async function TradeMatchPage({
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

  const { data: friendProfile } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!friendProfile) notFound();

  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${friendProfile.user_id}),and(requester_id.eq.${friendProfile.user_id},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  if (!friendship) redirect("/trades");

  const [viewerResult, friendResult, viewerWishlist, friendWishlist] = await Promise.all([
    getCollectionItems<CollectionItemWithOracle>(supabase, user.id, TRADE_COLLECTION_COLUMNS),
    getCollectionItems<CollectionItemWithOracle>(
      supabase,
      friendProfile.user_id,
      TRADE_COLLECTION_COLUMNS
    ),
    getWishlistItems(supabase, user.id),
    getWishlistItems(supabase, friendProfile.user_id),
  ]);

  const header = (
    <>
      <div className="flex items-center gap-3">
        <Link href="/trades" className="text-sm font-semibold text-text-muted">
          ← Trades
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[--radius-avatar] bg-elevated border border-border overflow-hidden flex items-center justify-center text-xl shrink-0">
          {friendProfile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={friendProfile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            "👤"
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-text-primary truncate">Matches with {friendProfile.display_name}</p>
          <p className="text-sm text-text-muted truncate">@{friendProfile.username}</p>
        </div>
      </div>
    </>
  );

  if (!viewerResult.ok || !friendResult.ok) {
    return (
      <div className="px-4 pt-6 space-y-6 pb-4">
        {header}
        <CollectionLoadError
          title={
            !viewerResult.ok
              ? "Couldn't load your collection"
              : `Couldn't load ${friendProfile.display_name}'s collection`
          }
        />
      </div>
    );
  }

  const viewerItems = viewerResult.rows;
  const friendItems = friendResult.rows;

  const { youHaveTheyWant, theyHaveYouWant, bothHaveExtras } = computeTradeMatches({
    viewerItems,
    friendItems,
    viewerWishlist,
    friendWishlist,
  });

  const offer = describeOffer(viewerItems);
  const offerDot =
    offer.mode === "opt_in"
      ? "bg-success"
      : offer.notForTradeCount > 0
        ? "bg-amber"
        : "bg-text-muted";

  return (
    <div className="px-4 pt-6 space-y-6 pb-4">
      {header}

      <p className="flex items-center gap-2 text-sm text-text-secondary">
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${offerDot}`} />
        <span>
          {formatOfferLine(offer)} ·{" "}
          <Link href="/collection" className="font-semibold text-amber">
            Edit on Collection
          </Link>
        </span>
      </p>

      <MatchSection
        title="You have, they want"
        emptyText={
          <>
            {friendProfile.display_name} already owns everything you offer, or you haven&apos;t imported a
            collection yet. You can{" "}
            <Link href="/collection" className="font-semibold text-amber">
              mark cards for trade
            </Link>
            .
          </>
        }
        cards={youHaveTheyWant}
      />
      <MatchSection
        title="They have, you want"
        emptyText={`You already own everything ${friendProfile.display_name} has, or they haven't synced their collection yet.`}
        cards={theyHaveYouWant}
      />
      <MatchSection
        title="You both have extras"
        emptyText="No shared cards with spare copies on either side yet."
        cards={bothHaveExtras}
      />
    </div>
  );
}
