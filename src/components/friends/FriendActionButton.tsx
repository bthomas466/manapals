"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendFriendRequest, respondToFriendRequest, removeFriendship } from "@/lib/friends/actions";

type Status = "none" | "outgoing" | "incoming" | "friends";
type ActionResult = { error?: string };

export default function FriendActionButton({
  status,
  targetUserId,
  friendshipId,
}: {
  status: Status;
  targetUserId: string;
  friendshipId: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (status === "friends" && friendshipId) {
    return (
      <Wrapper error={error}>
        <button
          disabled={pending}
          onClick={() => run(() => removeFriendship(friendshipId))}
          className="rounded-[--radius-btn] border border-border bg-elevated px-4 py-2 text-sm font-semibold text-text-secondary disabled:opacity-50"
        >
          Friends ✓ · Remove
        </button>
      </Wrapper>
    );
  }

  if (status === "outgoing" && friendshipId) {
    return (
      <Wrapper error={error}>
        <button
          disabled={pending}
          onClick={() => run(() => removeFriendship(friendshipId))}
          className="rounded-[--radius-btn] border border-border bg-elevated px-4 py-2 text-sm font-semibold text-text-secondary disabled:opacity-50"
        >
          Request Sent · Cancel
        </button>
      </Wrapper>
    );
  }

  if (status === "incoming" && friendshipId) {
    return (
      <Wrapper error={error}>
        <div className="flex gap-2">
          <button
            disabled={pending}
            onClick={() => run(() => respondToFriendRequest(friendshipId, true))}
            className="rounded-[--radius-btn] bg-amber px-4 py-2 text-sm font-bold text-page disabled:opacity-50"
          >
            Accept Request
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => respondToFriendRequest(friendshipId, false))}
            className="rounded-[--radius-btn] border border-border bg-elevated px-4 py-2 text-sm font-semibold text-text-secondary disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper error={error}>
      <button
        disabled={pending}
        onClick={() => run(() => sendFriendRequest(targetUserId))}
        className="rounded-[--radius-btn] bg-amber px-5 py-2.5 text-sm font-bold text-page disabled:opacity-50"
      >
        Add Friend
      </button>
    </Wrapper>
  );
}

function Wrapper({ error, children }: { error: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
