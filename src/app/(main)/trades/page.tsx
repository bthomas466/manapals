export default function TradesPage() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-text-primary">Trades</h1>
        <p className="text-sm text-text-secondary">
          Cards you want from friends · cards they want from you.
        </p>
      </header>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center pt-16 gap-4 text-center">
        <div className="w-16 h-16 rounded-[--radius-card] bg-elevated border border-border flex items-center justify-center text-3xl">
          🤝
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-text-primary">No trade matches yet</p>
          <p className="text-sm text-text-secondary max-w-xs">
            Add friends and import your collection to see trade opportunities.
          </p>
        </div>
        <button className="rounded-[--radius-btn] bg-amber px-5 py-3 text-sm font-bold text-page">
          Find Friends
        </button>
      </div>
    </div>
  );
}
