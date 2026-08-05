"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeWishlistItem } from "@/lib/wishlist/actions";

export default function WishlistRemoveButton({ id }: { id: number }) {
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
      className="rounded-full bg-page/80 px-1.5 py-0.5 text-[10px] font-bold text-text-primary disabled:opacity-50"
    >
      ✕
    </button>
  );
}
