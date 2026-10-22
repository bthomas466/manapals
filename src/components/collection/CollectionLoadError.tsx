"use client";

export default function CollectionLoadError({ title }: { title: string }) {
  return (
    <div
      role="alert"
      className="rounded-card border border-border bg-elevated p-4 space-y-3 text-center"
    >
      <p className="font-semibold text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary">
        Something went wrong loading cards. Nothing was changed.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 w-full rounded-btn border border-border bg-elevated text-sm font-semibold text-text-secondary"
      >
        Try again
      </button>
    </div>
  );
}
