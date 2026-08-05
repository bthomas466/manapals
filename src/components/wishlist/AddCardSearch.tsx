"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addWishlistItem } from "@/lib/wishlist/actions";
import { getImageUris, type ScryfallCard } from "@/lib/scryfall/client";

export default function AddCardSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [loadingPrintings, setLoadingPrintings] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  function reset() {
    setQuery("");
    setNames([]);
    setSelectedName(null);
    setPrintings([]);
    setError(null);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setSelectedName(null);
    setPrintings([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setNames([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/cards/search?mode=autocomplete&q=${encodeURIComponent(value)}`);
      const data = await res.json();
      setNames(data.names ?? []);
    }, 300);
  }

  async function pickName(name: string) {
    setSelectedName(name);
    setNames([]);
    setQuery(name);
    setLoadingPrintings(true);
    const res = await fetch(`/api/cards/search?mode=printings&name=${encodeURIComponent(name)}`);
    const data = await res.json();
    setPrintings(data.printings ?? []);
    setLoadingPrintings(false);
  }

  function add(card: ScryfallCard, matchMode: "specific" | "any_printing") {
    setError(null);
    startTransition(async () => {
      const result = await addWishlistItem(card, matchMode);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-[--radius-chip] bg-amber px-3 py-2 text-xs font-bold text-page"
      >
        + Add Card
      </button>
    );
  }

  const canAnyPrinting = printings.length > 0 && Boolean(printings[0].oracle_id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm rounded-[--radius-card] bg-page border border-border p-4 space-y-3 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="font-bold text-text-primary">Add to wishlist</p>
          <button
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="text-sm text-text-muted"
          >
            Close
          </button>
        </div>

        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Card name..."
          className="w-full rounded-[--radius-chip] border border-border bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted"
        />

        {names.length > 0 && (
          <ul className="divide-y divide-border rounded-[--radius-chip] border border-border overflow-hidden">
            {names.map((name) => (
              <li key={name}>
                <button
                  onClick={() => pickName(name)}
                  className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-elevated"
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {loadingPrintings && <p className="text-sm text-text-muted">Loading printings...</p>}

        {selectedName && !loadingPrintings && printings.length > 0 && (
          <div className="space-y-2">
            {canAnyPrinting && (
              <button
                disabled={pending}
                onClick={() => add(printings[0], "any_printing")}
                className="w-full rounded-[--radius-chip] border border-amber bg-amber/10 px-3 py-2 text-left text-sm font-semibold text-text-primary disabled:opacity-50"
              >
                Any printing of {selectedName}
              </button>
            )}
            <ul className="max-h-64 space-y-1.5 overflow-y-auto">
              {printings.map((card) => {
                const image = getImageUris(card)?.small;
                return (
                  <li key={card.id}>
                    <button
                      disabled={pending}
                      onClick={() => add(card, "specific")}
                      className="flex w-full items-center gap-2 rounded-[--radius-chip] border border-border bg-elevated px-3 py-2 text-left disabled:opacity-50"
                    >
                      {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="h-11 w-8 rounded-sm object-cover" />
                      )}
                      <span className="text-xs text-text-secondary">
                        {card.set_name} · #{card.collector_number}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
