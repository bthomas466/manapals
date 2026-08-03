"use client";

import { useState } from "react";
import ImportCollectionModal from "./ImportCollectionModal";
import CollectionGrid, { type CollectionItem } from "./CollectionGrid";

export type { CollectionItem };

export default function CollectionView({ initialItems }: { initialItems: CollectionItem[] }) {
  const [showImport, setShowImport] = useState(false);

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

      <CollectionGrid
        items={initialItems}
        emptyState={
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
        }
      />

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
