"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CardGrid from "@/components/cards/CardGrid";
import type { TradeStatus } from "@/lib/trades/flags";
import { batchWindow } from "@/lib/collection/batches";

export type CollectionItem = {
  id: number;
  quantity: number;
  finish: "nonfoil" | "foil" | "etched";
  condition: string;
  binder_name: string;
  trade_status?: TradeStatus | null;
  card: {
    scryfall_id: string;
    name: string;
    set_code: string;
    rarity: string;
    colors: string[];
    image_small: string | null;
    image_normal: string | null;
    price_usd: number | null;
    price_usd_foil: number | null;
  } | null;
};

const COLOR_CHIPS: { label: string; code: string | null }[] = [
  { label: "All", code: null },
  { label: "White", code: "W" },
  { label: "Blue", code: "U" },
  { label: "Black", code: "B" },
  { label: "Red", code: "R" },
  { label: "Green", code: "G" },
  { label: "Foil", code: "FOIL" },
];

const TRADE_CHIPS = ["For trade", "Not for trade"] as const;

type SortKey = "name" | "set" | "rarity" | "price";

export default function CollectionGrid({
  items,
  emptyState,
  onSelectItem,
}: {
  items: CollectionItem[];
  emptyState: React.ReactNode;
  // When set, tiles are tappable and show trade badges and trade filter chips.
  onSelectItem?: (item: CollectionItem) => void;
}) {
  const tradeEnabled = onSelectItem !== undefined;
  const [activeChip, setActiveChip] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    const chip = COLOR_CHIPS.find((c) => c.label === activeChip);

    const filtered = items.filter((item) => {
      if (!item.card) return false;
      if (query && !item.card.name.toLowerCase().includes(query)) return false;
      if (activeChip === "For trade" && item.trade_status !== "available") return false;
      if (activeChip === "Not for trade" && item.trade_status !== "not_for_trade") return false;
      if (chip?.code === "FOIL" && item.finish === "nonfoil") return false;
      if (chip?.code && chip.code !== "FOIL" && !item.card.colors.includes(chip.code)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (!a.card || !b.card) return 0;
      switch (sortKey) {
        case "set":
          return a.card.set_code.localeCompare(b.card.set_code);
        case "rarity":
          return a.card.rarity.localeCompare(b.card.rarity);
        case "price":
          return (b.card.price_usd ?? 0) - (a.card.price_usd ?? 0);
        default:
          return a.card.name.localeCompare(b.card.name);
      }
    });
  }, [items, search, activeChip, sortKey]);

  const [batchesShown, setBatchesShown] = useState(1);
  const { visibleCount, hasMore } = batchWindow(matches.length, batchesShown);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Re-created after each batch so a sentinel that is still in view loads the next one.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || !sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setBatchesShown((b) => b + 1);
      },
      { rootMargin: "0px 0px 400px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, batchesShown]);

  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <>
      <input
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setBatchesShown(1);
        }}
        placeholder="Search cards..."
        className="w-full rounded-[--radius-chip] border border-border bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted"
      />

      <div className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 flex-1">
          {[...COLOR_CHIPS.map((c) => c.label), ...(tradeEnabled ? TRADE_CHIPS : [])].map((label) => (
            <button
              key={label}
              onClick={() => {
                setActiveChip(label);
                setBatchesShown(1);
              }}
              aria-pressed={activeChip === label}
              className={`shrink-0 rounded-[--radius-chip] border px-3 text-xs font-semibold ${
                tradeEnabled ? "min-h-11" : "py-1.5"
              } ${
                activeChip === label
                  ? "border-amber bg-amber text-page"
                  : "border-border bg-elevated text-text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={sortKey}
          onChange={(e) => {
            setSortKey(e.target.value as SortKey);
            setBatchesShown(1);
          }}
          className="shrink-0 rounded-[--radius-chip] border border-border bg-elevated px-2 py-1.5 text-xs font-semibold text-text-secondary"
        >
          <option value="name">Name</option>
          <option value="set">Set</option>
          <option value="rarity">Rarity</option>
          <option value="price">Price</option>
        </select>
      </div>

      <CardGrid>
        {matches.slice(0, visibleCount).map((item) => (
          <CardTile key={item.id} item={item} onSelect={onSelectItem} />
        ))}
      </CardGrid>

      {hasMore && (
        <>
          <div ref={sentinelRef} aria-hidden="true" />
          <div className="space-y-2">
            <p className="text-xs text-text-muted text-center">
              Showing {visibleCount} of {matches.length}
            </p>
            <button
              type="button"
              onClick={() => setBatchesShown((b) => b + 1)}
              className="min-h-12 w-full rounded-[--radius-btn] border border-border bg-elevated text-sm font-semibold text-text-secondary"
            >
              Show more
            </button>
          </div>
        </>
      )}

      {matches.length === 0 && (
        <p className="text-sm text-text-muted text-center pt-8">No cards match your filters.</p>
      )}
    </>
  );
}

function CardTile({
  item,
  onSelect,
}: {
  item: CollectionItem;
  onSelect?: (item: CollectionItem) => void;
}) {
  const card = item.card;
  if (!card) return null;

  const image = card.image_small ?? card.image_normal;

  return (
    <div className="relative aspect-[5/7] rounded-[--radius-chip] bg-elevated border border-border overflow-hidden">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={card.name}
          className={`w-full h-full object-cover ${
            onSelect && item.trade_status === "not_for_trade" ? "grayscale opacity-60" : ""
          }`}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-2 text-center">
          <span className="text-[11px] font-semibold text-text-secondary leading-tight">
            {card.name}
          </span>
        </div>
      )}

      {item.quantity > 1 && (
        <span className="absolute top-1 right-1 rounded-full bg-page/80 px-1.5 py-0.5 text-[10px] font-bold text-text-primary">
          ×{item.quantity}
        </span>
      )}

      {item.finish !== "nonfoil" && (
        <span className="absolute top-1 left-1 rounded-full bg-amber px-1.5 py-0.5 text-[10px] font-bold text-page">
          {item.finish === "foil" ? "✨" : "◆"}
        </span>
      )}

      {onSelect && item.trade_status === "available" && (
        <span className="absolute bottom-1 left-1 rounded-full bg-success px-1.5 py-0.5 text-[10px] font-bold text-page">
          Available
        </span>
      )}
      {onSelect && item.trade_status === "not_for_trade" && (
        <span className="absolute bottom-1 left-1 rounded-full border border-text-muted bg-page/80 px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
          Not for trade
        </span>
      )}

      {onSelect && (
        <button
          type="button"
          onClick={() => onSelect(item)}
          aria-label={`${card.name}, ${item.binder_name || "No binder"}`}
          className="absolute inset-0 w-full h-full"
        />
      )}
    </div>
  );
}
