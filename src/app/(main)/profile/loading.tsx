export default function ProfileLoading() {
  return (
    <div className="px-4 pt-6 space-y-6 motion-safe:animate-pulse" aria-busy="true" aria-label="Loading profile">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 shrink-0 rounded-avatar bg-elevated" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 rounded-chip bg-elevated" />
          <div className="h-4 w-28 rounded-chip bg-elevated" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-16 rounded-card bg-elevated" />
        ))}
      </div>
      <div className="h-24 w-full rounded-card bg-elevated" />
      <div className="h-24 w-full rounded-card bg-elevated" />
    </div>
  );
}
