export default function CollectionPage() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-text-primary">Collection</h1>
        <p className="text-sm text-text-secondary">Your cards, organized.</p>
      </header>

      {/* Filter chips row — built out when collection import is wired */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {["All", "White", "Blue", "Black", "Red", "Green", "Foil"].map(
          (label) => (
            <button
              key={label}
              className="shrink-0 rounded-[--radius-chip] border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-text-secondary"
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* Empty state */}
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
        <button className="rounded-[--radius-btn] bg-amber px-5 py-3 text-sm font-bold text-page">
          Import Collection
        </button>
      </div>
    </div>
  );
}
