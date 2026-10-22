"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findProfileByUsername } from "@/lib/friends/actions";

export default function FriendSearchBox() {
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = query.trim().toLowerCase();
    if (!clean) return;
    startTransition(async () => {
      const result = await findProfileByUsername(clean);
      if (result) {
        router.push(`/u/${result.username}`);
      } else {
        setNotFound(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotFound(false);
          }}
          placeholder="Find a friend by username"
          className="flex-1 rounded-chip border border-border bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 min-w-11 shrink-0 rounded-chip bg-amber px-4 py-2.5 text-sm font-bold text-page disabled:opacity-50"
        >
          Go
        </button>
      </div>
      {notFound && <p className="text-xs text-text-secondary">No ManaPal with that username.</p>}
    </form>
  );
}
