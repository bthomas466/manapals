export default function WishlistPage() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-text-primary">Wishlist</h1>
          <p className="text-sm text-text-secondary">Cards you&apos;re looking for.</p>
        </div>
        <button className="rounded-[--radius-chip] bg-amber px-3 py-2 text-xs font-bold text-page">
          + Add Card
        </button>
      </header>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center pt-16 gap-4 text-center">
        <div className="w-16 h-16 rounded-[--radius-card] bg-elevated border border-border flex items-center justify-center text-3xl">
          ✨
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-text-primary">Wishlist is empty</p>
          <p className="text-sm text-text-secondary max-w-xs">
            Add cards you want and ManaPals will alert you when a friend has one.
          </p>
        </div>
      </div>
    </div>
  );
}
