"use client";

import { useEffect, useMemo, useOptimistic, useState } from "react";
import { applyStatusOverrides, type TradeStatus } from "@/lib/trades/flags";
import { setBinderTradeStatus, setItemTradeStatus } from "@/lib/trades/actions";
import { summarizeCollection } from "@/lib/collection/summary";
import ImportCollectionModal from "./ImportCollectionModal";
import CollectionSummary from "./CollectionSummary";
import CollectionGrid, { type CollectionItem } from "./CollectionGrid";
import CardTradeSheet from "./CardTradeSheet";
import TradeSettingsSheet from "./TradeSettingsSheet";

export type { CollectionItem };

export default function CollectionView({ initialItems }: { initialItems: CollectionItem[] }) {
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Flags are held as local overrides on top of the server rows so a tap never
  // re-fetches the whole collection. A re-import hands us new rows (new ids),
  // so overrides are dropped whenever initialItems changes.
  const [overrides, setOverrides] = useState<Map<number, TradeStatus | null>>(new Map());
  const [seenItems, setSeenItems] = useState(initialItems);
  if (seenItems !== initialItems) {
    setSeenItems(initialItems);
    setOverrides(new Map());
    setSelectedId(null);
  }
  const [optimisticOverrides, addOptimistic] = useOptimistic(
    overrides,
    (current, change: { ids: number[]; status: TradeStatus | null }) => {
      const next = new Map(current);
      for (const id of change.ids) next.set(id, change.status);
      return next;
    }
  );
  const items = useMemo(
    () => applyStatusOverrides(initialItems, optimisticOverrides),
    [initialItems, optimisticOverrides]
  );
  const selected = selectedId === null ? null : (items.find((i) => i.id === selectedId) ?? null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function commit(ids: number[], status: TradeStatus | null) {
    setOverrides((current) => {
      const next = new Map(current);
      for (const id of ids) next.set(id, status);
      return next;
    });
  }

  // Must run inside a transition (CardTradeSheet wraps it) for the optimistic update.
  async function saveItem(itemId: number, status: TradeStatus | null): Promise<boolean> {
    addOptimistic({ ids: [itemId], status });
    try {
      const result = await setItemTradeStatus(itemId, status);
      if (!result.ok) return false;
      commit([itemId], status);
      return true;
    } catch {
      return false;
    }
  }

  async function saveBinder(binderName: string, itemIds: number[], status: TradeStatus | null): Promise<boolean> {
    try {
      const result = await setBinderTradeStatus(binderName, status);
      if (!result.ok) {
        setToast("Couldn't update trade status");
        return false;
      }
      commit(itemIds, status);
      const n = result.updated ?? itemIds.length;
      setToast(`${n} ${n === 1 ? "entry" : "entries"} updated`);
      return true;
    } catch {
      setToast("Couldn't update trade status");
      return false;
    }
  }

  const isEmpty = initialItems.length === 0;
  // Whole-collection totals: derived from initialItems, so search, chips, sort
  // and trade-flag overrides never change them.
  const summary = useMemo(() => summarizeCollection(initialItems), [initialItems]);

  return (
    <div className="px-4 pt-6 space-y-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <Header />
        {!isEmpty && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-btn border border-border bg-elevated px-3 py-2 text-xs font-semibold text-text-secondary"
            >
              Trade settings
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="rounded-btn border border-border bg-elevated px-3 py-2 text-xs font-semibold text-text-secondary"
            >
              Re-import
            </button>
          </div>
        )}
      </div>

      {!isEmpty && <CollectionSummary summary={summary} />}

      <CollectionGrid
        items={items}
        onSelectItem={(item) => setSelectedId(item.id)}
        emptyState={
          <div className="flex flex-col items-center justify-center pt-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-card bg-elevated border border-border flex items-center justify-center text-3xl">
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
              className="rounded-btn bg-amber px-5 py-3 text-sm font-bold text-page"
            >
              Import Collection
            </button>
          </div>
        }
      />

      {selected && (
        <CardTradeSheet
          item={selected}
          allItems={items}
          onSave={saveItem}
          onClose={() => setSelectedId(null)}
        />
      )}

      {showSettings && (
        <TradeSettingsSheet items={items} onBulkSave={saveBinder} onClose={() => setShowSettings(false)} />
      )}

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex justify-center px-4">
        {toast && (
          <p className="rounded-btn border border-border bg-elevated px-4 py-3 text-sm font-semibold text-text-primary shadow-lg">
            {toast}
          </p>
        )}
      </div>

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
