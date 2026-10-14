"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import ManaboxInstructions from "@/components/onboarding/ManaboxInstructions";
import { useCollectionImport } from "./useCollectionImport";

export default function ImportCollectionModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { step, chooseFile, confirm, reset } = useCollectionImport({ onSuccess: () => router.refresh() });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60">
      <div className="w-full max-w-md rounded-t-[--radius-card] bg-surface border-t border-border p-5 pb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Import Collection</h2>
          <button
            onClick={onClose}
            className="text-text-muted text-sm font-semibold"
            aria-label="Close"
          >
            Cancel
          </button>
        </div>

        {step.kind === "pick" && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Export your collection from Manabox as a CSV, then upload it here.
            </p>
            <details className="rounded-[--radius-chip] border border-border bg-elevated p-3">
              <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                How to export from Manabox
              </summary>
              <div className="pt-3">
                <ManaboxInstructions />
              </div>
            </details>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) chooseFile(file);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-[--radius-btn] bg-amber px-5 py-3 text-sm font-bold text-page"
            >
              Choose CSV file
            </button>
          </div>
        )}

        {step.kind === "error" && (
          <div className="space-y-3">
            <div className="rounded-[--radius-chip] border border-border bg-elevated p-3 space-y-1">
              {step.messages.map((message, i) => (
                <p key={i} className="text-sm text-text-secondary">
                  {message}
                </p>
              ))}
            </div>
            <button
              onClick={() => reset()}
              className="w-full rounded-[--radius-btn] border border-border bg-elevated py-3 text-sm font-semibold text-text-secondary"
            >
              Try another file
            </button>
          </div>
        )}

        {step.kind === "confirm" && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Found <span className="font-bold text-text-primary">{step.rows.length}</span> card
              {step.rows.length === 1 ? "" : "s"} in this file. Importing will{" "}
              <span className="font-semibold text-text-primary">replace your current collection</span>{" "}
              — this can&apos;t be undone.
            </p>
            <button
              onClick={() => confirm(step.rows)}
              className="w-full rounded-[--radius-btn] bg-amber px-5 py-3 text-sm font-bold text-page"
            >
              Replace collection
            </button>
          </div>
        )}

        {step.kind === "importing" && (
          <p className="text-sm text-text-secondary py-4 text-center">
            Importing and fetching card data from Scryfall…
          </p>
        )}

        {step.kind === "done" && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Imported <span className="font-bold text-text-primary">{step.imported}</span> card
              {step.imported === 1 ? "" : "s"}.
            </p>
            {step.unmatched.length > 0 && (
              <div className="rounded-[--radius-chip] border border-border bg-elevated p-3 space-y-1 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-text-muted">
                  {`${step.unmatched.length} card${step.unmatched.length === 1 ? "" : "s"} couldn't be matched:`}
                </p>
                {step.unmatched.map((row, i) => (
                  <p key={i} className="text-xs text-text-secondary">
                    {row.name} ({row.setCode})
                  </p>
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-[--radius-btn] bg-amber px-5 py-3 text-sm font-bold text-page"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
