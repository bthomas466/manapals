"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeWishlistItem } from "@/lib/wishlist/actions";

export default function WishlistRemoveButton({ id, cardName }: { id: number; cardName: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    startTransition(async () => {
      await removeWishlistItem(id);
      router.refresh();
    });
  }

  return (
    <button
      disabled={pending}
      onClick={remove}
      aria-label={`Remove ${cardName} from wishlist`}
      className="group flex h-11 w-11 items-end justify-end disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className="rounded-full bg-page/80 px-1.5 py-0.5 text-[10px] font-bold text-text-primary motion-safe:transition-transform motion-safe:duration-100 motion-safe:group-active:scale-90"
      >
        ✕
      </span>
    </button>
  );
}
