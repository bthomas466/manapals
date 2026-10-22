"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToFriendRequest, removeFriendship } from "@/lib/friends/actions";
import FieldError from "@/components/ui/FieldError";

export function IncomingRequestActions({ friendshipId }: { friendshipId: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function respond(accept: boolean) {
    startTransition(async () => {
      const result = await respondToFriendRequest(friendshipId, accept);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => respond(true)}
          className="min-h-11 min-w-11 rounded-[--radius-chip] bg-amber px-3 py-1.5 text-xs font-bold text-page disabled:opacity-50"
        >
          Accept
        </button>
        <button
          disabled={pending}
          onClick={() => respond(false)}
          className="min-h-11 min-w-11 rounded-[--radius-chip] border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-text-secondary disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function OutgoingRequestActions({ friendshipId }: { friendshipId: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function cancel() {
    startTransition(async () => {
      const result = await removeFriendship(friendshipId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={pending}
        onClick={cancel}
        className="min-h-11 min-w-11 rounded-[--radius-chip] border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-text-secondary disabled:opacity-50"
      >
        Cancel
      </button>
      <FieldError message={error} />
    </div>
  );
}
