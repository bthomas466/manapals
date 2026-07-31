"use client";

import { useMemo, useState } from "react";
import ImportCollectionModal from "./ImportCollectionModal";

export type CollectionItem = {
  id: number;
  quantity: number;
  finish: "nonfoil" | "foil" | "etched";
  condition: string;
  binder_name: string;
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

type SortKey = "name" | "set" | "rarity" | "price";

export default function CollectionView({ initialItems }: { initialItems: CollectionItem[] }) {
  const [activeChip, setActiveChip] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [showImport, setShowImport] = useState(false);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const chip = COLOR_CHIPS.find((c) => c.label === activeChip);

    const filtered = initialItems.filter((item) => {
      if (!item.card) return false;
      if (query && !item.card.name.toLowerCase().includes(query)) return false;
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
  }, [initialItems, search, activeChip, sortKey]);

  const isEmpty = initialItems.length === 0;

  return (
    <div className="px-4 pt-6 space-y-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <Header />
        {!isEmpty && (
          <button
            onClick={() => setShowImport(true)}
            className="shrink-0 rounded-[--radius-btn] border border-border bg-elevated px-3 py-2 text-xs font-semibold text-text-secondary"
          >
            Re-import
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center pt-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-[--radius-card] bg-elevated border border-border flex items-center justify-center text-3xl">
            📦
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-text-primary">No cards yet</p>
            <p className="text-sm text-text-secondary max-w-xs">
              Import a Manabox CSV to populate your collection.
            </p>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-[--radius-btn] bg-amber px-5 py-3 text-sm font-bold text-page"
          >
            Import Collection
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards..."
            className="w-full rounded-[--radius-chip] border border-border bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted"
          />

          <div className="flex items-center gap-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 flex-1">
              {COLOR_CHIPS.map(({ label }) => (
                <button
                  key={label}
                  onClick={() => setActiveChip(label)}
                  className={`shrink-0 rounded-[--radius-chip] border px-3 py-1.5 text-xs font-semibold ${
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
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="shrink-0 rounded-[--radius-chip] border border-border bg-elevated px-2 py-1.5 text-xs font-semibold text-text-secondary"
            >
              <option value="name">Name</option>
              <option value="set">Set</option>
              <option value="rarity">Rarity</option>
              <option value="price">Price</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {visibleItems.map((item) => (
              <CardTile key={item.id} item={item} />
            ))}
          </div>

          {visibleItems.length === 0 && (
            <p className="text-sm text-text-muted text-center pt-8">No cards match your filters.</p>
          )}
        </>
      )}

      {showImport && <ImportCollectionModal onClose={() => setShowImport(false)} />}
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-1">
      <h1 className="text-xl font-bold text-text-primary">Collection</h1>
      <p className="text-sm text-text-secondary">Your cards, organized.</p>
    </header>
  );
}

function CardTile({ item }: { item: CollectionItem }) {
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
    </div>
  );
}
