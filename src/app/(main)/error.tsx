"use client";

import { useEffect } from "react";

// "Nothing was changed" holds because server actions return errors instead of
// throwing (CODING_STANDARDS: "Return results, don't throw, from server actions"),
// so only read and render failures reach this boundary.
export default function MainError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="px-4 pt-6">
      <div
        role="alert"
        className="rounded-card border border-border bg-elevated p-4 space-y-3 text-center motion-safe:animate-[settle_250ms_ease-out_both]"
      >
        <h1 className="font-semibold text-text-primary">Something went wrong</h1>
        <p className="text-sm text-text-secondary">This page couldn&apos;t load. Nothing was changed.</p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="min-h-11 w-full rounded-btn border border-border bg-elevated text-sm font-semibold text-text-secondary transition-colors active:scale-[0.98]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
