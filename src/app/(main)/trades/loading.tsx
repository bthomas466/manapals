export default function TradesLoading() {
  return (
    <div className="px-4 pt-6 space-y-4 motion-safe:animate-pulse" aria-busy="true" aria-label="Loading trades">
      <div className="space-y-2">
        <div className="h-6 w-24 rounded-chip bg-elevated" />
        <div className="h-4 w-64 rounded-chip bg-elevated" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-16 rounded-card bg-elevated" />
        ))}
      </div>
    </div>
  );
}
