"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/friends/actions";

export default function ProfileEditForm({
  initialDisplayName,
  initialUsername,
}: {
  initialDisplayName: string;
  initialUsername: string;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm text-text-muted">@{initialUsername}</p>
        <button onClick={() => setEditing(true)} className="text-xs font-semibold text-amber">
          Edit
        </button>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("display_name", displayName);
    formData.set("username", username);
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 pt-1">
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Display name"
        className="w-full rounded-[--radius-chip] border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
      />
      <div className="flex items-center gap-1 rounded-[--radius-chip] border border-border bg-elevated px-3 py-2">
        <span className="text-sm text-text-muted">@</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="username"
          className="flex-1 bg-transparent text-sm text-text-primary outline-none"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-[--radius-btn] bg-amber py-2 text-sm font-bold text-page disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-1 rounded-[--radius-btn] border border-border bg-elevated py-2 text-sm font-semibold text-text-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
