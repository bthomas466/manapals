import { formatCollectionSummary, type CollectionSummary as Summary } from "@/lib/collection/summary";

export default function CollectionSummary({ summary }: { summary: Summary }) {
  if (summary.totalCards === 0) return null;
  const f = formatCollectionSummary(summary);

  return (
    <section
      role="region"
      aria-label="Collection summary"
      className="rounded-[--radius-card] border border-border bg-elevated px-4 py-3"
    >
      <p className="text-sm text-text-secondary">
        <span className="font-bold text-text-primary">{f.cards}</span>
        {" · "}
        {f.unique}
        {" · "}
        {f.valueAvailable ? (
          <span className="text-[22px] font-extrabold text-amber">{f.value}</span>
        ) : (
          <span className="text-xs text-text-muted">{f.value}</span>
        )}
      </p>
      <p className="mt-1 text-xs text-text-muted">{f.note}</p>
    </section>
  );
}
