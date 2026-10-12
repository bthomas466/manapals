import type { CollectionItem } from "@/components/collection/CollectionGrid";

export type TradeStatus = "available" | "not_for_trade";
export type TradeChip = "for_trade" | "not_for_trade";

export function isTradeStatus(value: unknown): value is TradeStatus {
  return value === "available" || value === "not_for_trade";
}

export type BinderSummary = {
  name: string;
  rows: number;
  cards: number;
  itemIds: number[];
};

type Flaggable = Pick<CollectionItem, "id" | "quantity" | "binder_name" | "trade_status">;

// Non-empty binders only, sorted by name.
export function summarizeBinders(items: Flaggable[]): BinderSummary[] {
  const map = new Map<string, BinderSummary>();
  for (const item of items) {
    if (item.binder_name.trim() === "") continue;
    const existing = map.get(item.binder_name);
    if (existing) {
      existing.rows += 1;
      existing.cards += item.quantity;
      existing.itemIds.push(item.id);
    } else {
      map.set(item.binder_name, {
        name: item.binder_name,
        rows: 1,
        cards: item.quantity,
        itemIds: [item.id],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterByTradeChip<T extends Pick<CollectionItem, "trade_status">>(
  items: T[],
  chip: TradeChip
): T[] {
  const wanted: TradeStatus = chip === "for_trade" ? "available" : "not_for_trade";
  return items.filter((item) => item.trade_status === wanted);
}

// Drives the UI warning only; the server doesn't enforce it.
export function needsFirstAvailableWarning(
  items: Pick<CollectionItem, "trade_status">[],
  next: TradeStatus | null
): boolean {
  return next === "available" && !items.some((i) => i.trade_status === "available");
}

export function applyStatusOverrides<T extends Pick<CollectionItem, "id" | "trade_status">>(
  items: T[],
  overrides: Map<number, TradeStatus | null>
): T[] {
  if (overrides.size === 0) return items;
  return items.map((item) =>
    overrides.has(item.id) ? { ...item, trade_status: overrides.get(item.id) ?? null } : item
  );
}
