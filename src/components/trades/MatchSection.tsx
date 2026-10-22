import CardGrid from "@/components/cards/CardGrid";
import type { CardSummary } from "@/lib/trades/match";

export function MatchSection({
  title,
  emptyText,
  cards,
}: {
  title: string;
  emptyText: React.ReactNode;
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
        <CardGrid>
          {cards.map((card) => (
            <MatchTile key={card.scryfall_id} card={card} />
          ))}
        </CardGrid>
      )}
    </section>
  );
}

function MatchTile({ card }: { card: CardSummary }) {
  const image = card.image_small ?? card.image_normal;

  return (
    <div className="relative aspect-[5/7] rounded-chip bg-elevated border border-border overflow-hidden">
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
