"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendFriendRequest, respondToFriendRequest, removeFriendship } from "@/lib/friends/actions";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FieldError from "@/components/ui/FieldError";

type Status = "none" | "outgoing" | "incoming" | "friends";
type ActionResult = { error?: string };

export default function FriendActionButton({
  status,
  targetUserId,
  friendshipId,
  displayName,
}: {
  status: Status;
  targetUserId: string;
  friendshipId: number | null;
  displayName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const router = useRouter();
  const removeBtnRef = useRef<HTMLButtonElement>(null);

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (status === "friends" && friendshipId) {
    function confirmRemove() {
      setConfirmError(null);
      startTransition(async () => {
        const result = await removeFriendship(friendshipId!);
        if (result.error) {
          setConfirmError(result.error);
          return;
        }
        setConfirmOpen(false);
        router.refresh();
      });
    }

    return (
      <Wrapper error={error}>
        <div className="flex flex-wrap justify-center gap-2">
          <span className="inline-flex min-h-11 items-center rounded-chip border border-border bg-elevated px-3 text-sm font-semibold text-text-secondary">
            Friends ✓
          </span>
          <button
            ref={removeBtnRef}
            type="button"
            onClick={() => {
              setConfirmError(null);
              setConfirmOpen(true);
            }}
            className="min-h-11 rounded-btn border border-border bg-elevated px-4 text-sm font-semibold text-text-secondary"
          >
            Remove friend
          </button>
        </div>
        {confirmOpen && (
          <ConfirmDialog
            title={`Remove ${displayName} as a friend?`}
            confirmLabel="Remove"
            pendingLabel="Removing…"
            pending={pending}
            error={confirmError}
            onConfirm={confirmRemove}
            onCancel={() => setConfirmOpen(false)}
            returnFocusRef={removeBtnRef}
          >
            You&apos;ll stop seeing each other&apos;s collections, wishlists and trade matches. You can
            send a new request later.
          </ConfirmDialog>
        )}
      </Wrapper>
    );
  }

  if (status === "outgoing" && friendshipId) {
    return (
      <Wrapper error={error}>
        <button
          disabled={pending}
          onClick={() => run(() => removeFriendship(friendshipId))}
          className="min-h-11 rounded-btn border border-border bg-elevated px-4 py-2 text-sm font-semibold text-text-secondary disabled:opacity-50"
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
            className="min-h-11 rounded-btn bg-amber px-4 py-2 text-sm font-bold text-page disabled:opacity-50"
          >
            Accept Request
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => respondToFriendRequest(friendshipId, false))}
            className="min-h-11 min-w-11 rounded-btn border border-border bg-elevated px-4 py-2 text-sm font-semibold text-text-secondary disabled:opacity-50"
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
        className="min-h-11 rounded-btn bg-amber px-5 py-2.5 text-sm font-bold text-page disabled:opacity-50"
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
      <FieldError message={error} />
    </div>
  );
}
