"use client";

import { useState } from "react";
import { parseManaboxCsv, type NormalizedRow } from "@/lib/csv/manabox";

export type ImportStep =
  | { kind: "pick" }
  | { kind: "error"; messages: string[] }
  | { kind: "confirm"; rows: NormalizedRow[] }
  | { kind: "importing" }
  | { kind: "done"; imported: number; unmatched: { name: string; setCode: string }[] };

/** Parse -> confirm -> POST state machine shared by the modal and the onboarding wizard. */
export function useCollectionImport({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [step, setStep] = useState<ImportStep>({ kind: "pick" });

  async function chooseFile(file: File) {
    const { rows, errors } = await parseManaboxCsv(file);
    if (rows.length === 0) {
      setStep({ kind: "error", messages: errors.length > 0 ? errors : ["No usable rows found in this file."] });
      return;
    }
    setStep({ kind: "confirm", rows });
  }

  async function confirm(rows: NormalizedRow[]) {
    setStep({ kind: "importing" });
    try {
      const response = await fetch("/api/collection/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStep({ kind: "error", messages: [data.error ?? "Import failed."] });
        return;
      }
      setStep({ kind: "done", imported: data.imported, unmatched: data.unmatched ?? [] });
      onSuccess?.();
    } catch {
      setStep({ kind: "error", messages: ["Couldn't reach the server. Check your connection and try again."] });
    }
  }

  function reset() {
    setStep({ kind: "pick" });
  }

  return { step, chooseFile, confirm, reset };
}
