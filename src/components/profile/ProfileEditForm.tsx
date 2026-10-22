"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/friends/actions";
import FieldError from "@/components/ui/FieldError";

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
        <p className="text-sm text-text-secondary">@{initialUsername}</p>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex min-h-11 min-w-11 items-center px-2 text-xs font-semibold text-amber"
        >
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
        className="w-full rounded-chip border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
      />
      <div className="focus-ring-within flex items-center gap-1 rounded-chip border border-border bg-elevated px-3 py-2">
        <span className="text-sm text-text-secondary">@</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="username"
          className="flex-1 bg-transparent text-sm text-text-primary"
        />
      </div>
      <FieldError message={error} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 flex-1 rounded-btn bg-amber py-2 text-sm font-bold text-page disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="min-h-11 flex-1 rounded-btn border border-border bg-elevated py-2 text-sm font-semibold text-text-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
