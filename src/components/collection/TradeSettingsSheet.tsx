"use client";

import { useEffect, useMemo, useState } from "react";
import { needsFirstAvailableWarning, summarizeBinders, type TradeStatus } from "@/lib/trades/flags";
import type { CollectionItem } from "./CollectionGrid";
import FirstAvailableConfirm from "./FirstAvailableConfirm";

const ACTIONS: { label: string; value: TradeStatus | null }[] = [
  { label: "Available", value: "available" },
  { label: "Not for trade", value: "not_for_trade" },
  { label: "Clear", value: null },
];

type Pending = { binder: string; rows: number; status: TradeStatus | null };

export default function TradeSettingsSheet({
  items,
  onBulkSave,
  onClose,
}: {
  items: CollectionItem[];
  // Resolves true when the whole binder was updated (parent shows the toast).
  onBulkSave: (binderName: string, itemIds: number[], status: TradeStatus | null) => Promise<boolean>;
  onClose: () => void;
}) {
  const binders = useMemo(() => summarizeBinders(items), [items]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Pending | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirm) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirm]);

  async function run(name: string, ids: number[], status: TradeStatus | null) {
    setBusy(name);
    try {
      await onBulkSave(name, ids, status);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-page/70">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trade settings"
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-[--radius-card] bg-surface border-t border-border p-5 pb-8 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Trade settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-2 text-sm font-semibold text-text-secondary"
          >
            Close
          </button>
        </div>

        {binders.length === 0 ? (
          <p className="text-sm text-text-secondary">No Manabox binders found in your import</p>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              Mark every card in a binder at once. This only changes cards you have now.
            </p>
            <ul className="space-y-3">
              {binders.map((binder) => (
                <li
                  key={binder.name}
                  role="group"
                  aria-label={binder.name}
                  className="rounded-[--radius-card] border border-border bg-elevated p-3 space-y-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-text-primary truncate">{binder.name}</p>
                    <p className="shrink-0 text-xs text-text-secondary">
                      {binder.rows} {binder.rows === 1 ? "entry" : "entries"} · {binder.cards}{" "}
                      {binder.cards === 1 ? "card" : "cards"}
                    </p>
                  </div>
                  <div className="flex gap-2" aria-busy={busy === binder.name}>
                    {ACTIONS.map(({ label, value }) => (
                      <button
                        key={label}
                        type="button"
                        disabled={busy !== null}
                        onClick={() => {
                          if (needsFirstAvailableWarning(items, value)) {
                            setConfirm({ binder: binder.name, rows: binder.rows, status: value });
                          } else {
                            void run(binder.name, binder.itemIds, value);
                          }
                        }}
                        className="flex-1 min-h-11 rounded-[--radius-btn] border border-border bg-surface px-2 text-xs font-semibold text-text-secondary disabled:opacity-50"
                      >
                        {busy === binder.name ? "Saving…" : label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {confirm && (
        <FirstAvailableConfirm
          detail={`${confirm.binder}: ${confirm.rows} ${confirm.rows === 1 ? "entry" : "entries"} will be marked Available.`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const target = binders.find((b) => b.name === confirm.binder);
            setConfirm(null);
            if (target) void run(target.name, target.itemIds, confirm.status);
          }}
        />
      )}
    </div>
  );
}
