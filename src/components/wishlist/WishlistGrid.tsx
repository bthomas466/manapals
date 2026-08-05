import type { WishlistItem } from "@/lib/wishlist/queries";
import WishlistRemoveButton from "./WishlistRemoveButton";

export default function WishlistGrid({
  items,
  editable,
  emptyState,
}: {
  items: WishlistItem[];
  editable: boolean;
  emptyState: React.ReactNode;
}) {
  if (items.length === 0) return <>{emptyState}</>;

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map((item) => (
        <WishlistTile key={item.id} item={item} editable={editable} />
      ))}
    </div>
  );
}

function WishlistTile({ item, editable }: { item: WishlistItem; editable: boolean }) {
  const card = item.card;
  if (!card) return null;

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

      {item.match_mode === "any_printing" && (
        <span className="absolute top-1 left-1 rounded-full bg-amber px-1.5 py-0.5 text-[10px] font-bold text-page">
          Any
        </span>
      )}

      {editable && (
        <div className="absolute bottom-1 right-1">
          <WishlistRemoveButton id={item.id} />
        </div>
      )}
    </div>
  );
}
