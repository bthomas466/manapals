import CardGrid from "@/components/cards/CardGrid";

export default function CollectionLoading() {
  return (
    <div className="px-4 pt-6 space-y-4 pb-4 motion-safe:animate-pulse" aria-busy="true" aria-label="Loading collection">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-32 rounded-chip bg-elevated" />
          <div className="h-4 w-44 rounded-chip bg-elevated" />
        </div>
        <div className="h-9 w-24 rounded-btn bg-elevated" />
      </div>
      <div className="h-[62px] w-full rounded-card bg-elevated" />
      <div className="h-11 w-full rounded-chip bg-elevated" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-11 w-16 shrink-0 rounded-chip bg-elevated" />
        ))}
      </div>
      <CardGrid testId="card-grid-skeleton">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="aspect-[5/7] rounded-chip bg-elevated border border-border" />
        ))}
      </CardGrid>
    </div>
  );
}
