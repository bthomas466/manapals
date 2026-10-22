"use client";

import { useRef, useState, useTransition } from "react";
import { useCollectionImport } from "@/components/collection/useCollectionImport";
import { completeOnboarding } from "@/lib/onboarding/actions";
import FieldError from "@/components/ui/FieldError";
import ManaboxInstructions from "./ManaboxInstructions";

const primaryBtn =
  "min-h-11 w-full rounded-btn bg-amber px-5 text-sm font-bold text-page disabled:opacity-50";
const secondaryBtn =
  "min-h-11 w-full rounded-btn border border-border bg-elevated px-5 text-sm font-semibold text-text-secondary";

export default function ImportStep({
  hasExistingCards,
  onBack,
}: {
  hasExistingCards: boolean;
  onBack: () => void;
}) {
  const { step, chooseFile, confirm, reset } = useCollectionImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function finish() {
    setFinishError(null);
    startTransition(async () => {
      try {
        const result = await completeOnboarding();
        if (result?.error) setFinishError(result.error);
      } catch (error) {
        // redirect() surfaces as a thrown control-flow error that Next must see.
        if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
        setFinishError("Couldn't finish setup. Try again.");
      }
    });
  }

  const showNav = step.kind === "pick" || step.kind === "error";

  return (
    <div className="space-y-4">
      {step.kind === "done" ? (
        <h1 className="text-xl font-bold text-text-primary">You&apos;re all set</h1>
      ) : (
        <>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-text-primary">Import your collection</h1>
          </div>
          <ManaboxInstructions />
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) chooseFile(file);
        }}
      />

      {step.kind === "pick" && (
        <button type="button" onClick={() => fileInputRef.current?.click()} className={primaryBtn}>
          Choose CSV file
        </button>
      )}

      {step.kind === "error" && (
        <div className="space-y-3">
          <div className="space-y-1 rounded-chip border border-border bg-elevated p-3">
            {step.messages.map((message, i) => (
              <p key={i} className="text-sm text-text-secondary">
                {message}
              </p>
            ))}
          </div>
          <button type="button" onClick={reset} className={secondaryBtn}>
            Try another file
          </button>
        </div>
      )}

      {step.kind === "confirm" && (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Found <span className="font-bold text-text-primary">{step.rows.length}</span> card
            {step.rows.length === 1 ? "" : "s"} in this file.
            {hasExistingCards && (
              <>
                {" "}Importing will{" "}
                <span className="font-semibold text-text-primary">replace your current collection</span>{" "}
                — this can&apos;t be undone.
              </>
            )}
          </p>
          <button type="button" onClick={() => confirm(step.rows)} className={primaryBtn}>
            {hasExistingCards ? "Replace collection" : "Import cards"}
          </button>
          <button type="button" onClick={reset} className={secondaryBtn}>
            Choose a different file
          </button>
        </div>
      )}

      {step.kind === "importing" && (
        <p className="py-4 text-center text-sm text-text-secondary">
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
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-chip border border-border bg-elevated p-3">
              <p className="text-xs font-semibold text-text-secondary">
                {`${step.unmatched.length} card${step.unmatched.length === 1 ? "" : "s"} couldn't be matched:`}
              </p>
              {step.unmatched.map((row, i) => (
                <p key={i} className="break-words text-xs text-text-secondary">
                  {row.name} ({row.setCode})
                </p>
              ))}
            </div>
          )}
          <button type="button" onClick={finish} disabled={pending} className={primaryBtn}>
            Go to my collection
          </button>
        </div>
      )}

      <FieldError message={finishError} />

      {showNav && (
        <div className="space-y-2">
          <button type="button" onClick={onBack} className={secondaryBtn}>
            Back
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={pending}
            className="min-h-11 w-full text-sm font-semibold text-text-secondary disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}
