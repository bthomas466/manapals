"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCollectionVisibility } from "@/lib/friends/actions";

type Visibility = "friends" | "public";

export default function VisibilityToggle({ initialVisibility }: { initialVisibility: Visibility }) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function choose(next: Visibility) {
    if (next === visibility || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCollectionVisibility(next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setVisibility(next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        {(["friends", "public"] as const).map((option) => (
          <button
            key={option}
            disabled={pending}
            onClick={() => choose(option)}
            className={`flex-1 rounded-[--radius-chip] border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
              visibility === option
                ? "border-amber bg-amber text-page"
                : "border-border bg-elevated text-text-secondary"
            }`}
          >
            {option === "friends" ? "Friends only" : "Public"}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
