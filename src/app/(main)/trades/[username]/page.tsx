import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { CollectionItem } from "@/components/collection/CollectionGrid";
import { getWishlistItems, type WishlistItem } from "@/lib/wishlist/queries";

type CardSummary = {
  scryfall_id: string;
  oracle_id: string | null;
  name: string;
  set_code: string;
  image_small: string | null;
  image_normal: string | null;
  quantity: number;
  allFoil: boolean;
  price: number | null;
};

function aggregateByCard(items: CollectionItemWithOracle[]): Map<string, CardSummary> {
  const map = new Map<string, CardSummary>();
  for (const item of items) {
    if (!item.card) continue;
    const isFoil = item.finish !== "nonfoil";
    const existing = map.get(item.card.scryfall_id);
    if (existing) {
      existing.quantity += item.quantity;
      existing.allFoil = existing.allFoil && isFoil;
    } else {
      map.set(item.card.scryfall_id, {
        scryfall_id: item.card.scryfall_id,
        oracle_id: item.card.oracle_id,
        name: item.card.name,
        set_code: item.card.set_code,
        image_small: item.card.image_small,
        image_normal: item.card.image_normal,
        quantity: item.quantity,
        allFoil: isFoil,
        price: (isFoil ? (item.card.price_usd_foil ?? item.card.price_usd) : item.card.price_usd) ?? null,
      });
    }
  }
  return map;
}

// Extends the shared CollectionItem shape with oracle_id, needed only here
// to match "any printing" wishlist entries against a friend's collection.
type CollectionItemWithOracle = Omit<CollectionItem, "card"> & {
  card: (NonNullable<CollectionItem["card"]> & { oracle_id: string | null }) | null;
};

async function fetchCollectionByUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<CollectionItemWithOracle[]> {
  const { data } = await supabase
    .from("collection_items")
    .select(
      "id, quantity, finish, condition, binder_name, card:cards(scryfall_id, oracle_id, name, set_code, rarity, colors, image_small, image_normal, price_usd, price_usd_foil)"
    )
    .eq("user_id", userId)
    .order("id")
    .returns<CollectionItemWithOracle[]>();
  return data ?? [];
}

// "Available to trade" flags (US-11/12) don't exist yet, so the offering
// side always falls back to the full collection (PRD §4.6). The wanting
// side narrows to the other user's wishlist once they have one — an empty
// wishlist still means "wants everything," so existing matches are
// unaffected until a user actually adds wishlist items.
function buildWantMatcher(wishlist: WishlistItem[]): (card: CardSummary) => boolean {
  const specificIds = new Set(wishlist.filter((w) => w.match_mode === "specific").map((w) => w.card_id));
  const oracleIds = new Set(
    wishlist.filter((w) => w.match_mode === "any_printing" && w.oracle_id).map((w) => w.oracle_id)
  );
  return (card) => specificIds.has(card.scryfall_id) || (card.oracle_id != null && oracleIds.has(card.oracle_id));
}

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

  const [viewerItems, friendItems, viewerWishlist, friendWishlist] = await Promise.all([
    fetchCollectionByUser(supabase, user.id),
    fetchCollectionByUser(supabase, friendProfile.user_id),
    getWishlistItems(supabase, user.id),
    getWishlistItems(supabase, friendProfile.user_id),
  ]);

  const viewerMap = aggregateByCard(viewerItems);
  const friendMap = aggregateByCard(friendItems);
  const viewerWants = buildWantMatcher(viewerWishlist);
  const friendWants = buildWantMatcher(friendWishlist);

  const youHaveTheyWant: CardSummary[] = [];
  const theyHaveYouWant: CardSummary[] = [];
  const bothHaveExtras: CardSummary[] = [];

  for (const [id, card] of viewerMap) {
    const theirs = friendMap.get(id);
    if (!theirs) {
      if (friendWishlist.length === 0 || friendWants(card)) youHaveTheyWant.push(card);
    } else if (card.quantity > 1 || theirs.quantity > 1) {
      bothHaveExtras.push(card);
    }
  }
  for (const [id, card] of friendMap) {
    if (!viewerMap.has(id)) {
      if (viewerWishlist.length === 0 || viewerWants(card)) theyHaveYouWant.push(card);
    }
  }

  const byName = (a: CardSummary, b: CardSummary) => a.name.localeCompare(b.name);
  youHaveTheyWant.sort(byName);
  theyHaveYouWant.sort(byName);
  bothHaveExtras.sort(byName);

  return (
    <div className="px-4 pt-6 space-y-6 pb-4">
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

      <MatchSection
        title="You have, they want"
        emptyText={`${friendProfile.display_name} already owns everything you have, or you haven't imported a collection yet.`}
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

function MatchSection({
  title,
  emptyText,
  cards,
}: {
  title: string;
  emptyText: string;
  cards: CardSummary[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-text-primary">
        {title} ({cards.length})
      </h2>
      {cards.length === 0 ? (
        <p className="text-sm text-text-secondary">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {cards.map((card) => (
            <MatchTile key={card.scryfall_id} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchTile({ card }: { card: CardSummary }) {
  const image = card.image_small ?? card.image_normal;

  return (
    <div className="relative aspect-[5/7] rounded-[--radius-chip] bg-elevated border border-border overflow-hidden">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-2 text-center">
          <span className="text-[11px] font-semibold text-text-secondary leading-tight">
            {card.name}
          </span>
        </div>
      )}

      {card.quantity > 1 && (
        <span className="absolute top-1 right-1 rounded-full bg-page/80 px-1.5 py-0.5 text-[10px] font-bold text-text-primary">
          ×{card.quantity}
        </span>
      )}

      {card.allFoil && (
        <span className="absolute top-1 left-1 rounded-full bg-amber px-1.5 py-0.5 text-[10px] font-bold text-page">
          ✨
        </span>
      )}

      {card.price != null && (
        <span className="absolute bottom-1 left-1 rounded-full bg-page/80 px-1.5 py-0.5 text-[10px] font-bold text-text-primary">
          ${card.price.toFixed(2)}
        </span>
      )}
    </div>
  );
}
