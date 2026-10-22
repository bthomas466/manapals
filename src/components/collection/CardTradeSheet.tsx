"use client";

import { useEffect, useState, useTransition } from "react";
import { needsFirstAvailableWarning, type TradeStatus } from "@/lib/trades/flags";
import type { CollectionItem } from "./CollectionGrid";
import FirstAvailableConfirm from "./FirstAvailableConfirm";

const OPTIONS: { label: string; value: TradeStatus | null }[] = [
  { label: "Available to trade", value: "available" },
  { label: "Unmarked", value: null },
  { label: "Not for trade", value: "not_for_trade" },
];

const FINISH_LABEL = { nonfoil: "Nonfoil", foil: "Foil", etched: "Etched" } as const;

export default function CardTradeSheet({
  item,
  allItems,
  onSave,
  onClose,
}: {
  // Already reflects optimistic overrides from the parent.
  item: CollectionItem;
  allItems: CollectionItem[];
  // Runs inside a transition; resolves false when the save failed (parent reverts).
  onSave: (itemId: number, status: TradeStatus | null) => Promise<boolean>;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pendingConfirm) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pendingConfirm]);

  const current = item.trade_status ?? null;

  function save(next: TradeStatus | null) {
    setError(null);
    startTransition(async () => {
      let ok = false;
      try {
        ok = await onSave(item.id, next);
      } catch {
        ok = false;
      }
      if (!ok) setError("Couldn't update trade status");
    });
  }

  function choose(next: TradeStatus | null) {
    if (isPending || next === current) return;
    if (needsFirstAvailableWarning(allItems, next)) {
      setPendingConfirm(true);
      return;
    }
    save(next);
  }

  const card = item.card;
  if (!card) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-page/70">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Trade status for ${card.name}`}
        className="w-full max-w-md rounded-t-[--radius-card] bg-surface border-t border-border p-5 pb-8 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-text-primary">{card.name}</h2>
            <p className="text-sm text-text-secondary">
              {FINISH_LABEL[item.finish]} · {item.binder_name || "No binder"} · Qty {item.quantity}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 min-h-11 px-2 text-sm font-semibold text-text-secondary"
          >
            Close
          </button>
        </div>

        <div role="radiogroup" aria-label="Trade status" className="space-y-2">
          {OPTIONS.map(({ label, value }) => {
            const checked = current === value;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={isPending}
                onClick={() => choose(value)}
                className={`w-full min-h-11 rounded-[--radius-btn] border px-4 text-left text-sm font-semibold disabled:opacity-60 ${
                  checked
                    ? "border-amber bg-amber/15 text-text-primary"
                    : "border-border bg-elevated text-text-secondary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-amber">
            {error}
          </p>
        )}
      </div>

      {pendingConfirm && (
        <FirstAvailableConfirm
          onCancel={() => setPendingConfirm(false)}
          onConfirm={() => {
            setPendingConfirm(false);
            save("available");
          }}
        />
      )}
    </div>
  );
}
