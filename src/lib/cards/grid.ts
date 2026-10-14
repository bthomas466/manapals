// Shared card-grid sizing (spec #33). Tailwind v4 default breakpoints.
// `prefix` is the Tailwind variant ("" below 640px).
export const CARD_GRID_LADDER = [
  { minWidth: 0, prefix: "", columns: 3 },
  { minWidth: 640, prefix: "sm", columns: 4 },
  { minWidth: 768, prefix: "md", columns: 5 },
  { minWidth: 1024, prefix: "lg", columns: 6 },
  { minWidth: 1280, prefix: "xl", columns: 8 },
  { minWidth: 1536, prefix: "2xl", columns: 10 },
] as const;

// Must stay one complete string literal: Tailwind finds class names by scanning
// source text, so building this from CARD_GRID_LADDER would drop the classes.
export const CARD_GRID_CLASS =
  "grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10";

export function cardGridColumns(viewportWidth: number): number {
  let columns: number = CARD_GRID_LADDER[0].columns;
  for (const step of CARD_GRID_LADDER) {
    if (viewportWidth >= step.minWidth) columns = step.columns;
  }
  return columns;
}

export function cardTileWidth(
  viewportWidth: number,
  { padding = 32, gap = 10 }: { padding?: number; gap?: number } = {}
): number {
  const columns = cardGridColumns(viewportWidth);
  return (viewportWidth - padding - gap * (columns - 1)) / columns;
}
