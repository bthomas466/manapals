// 20 rows of the 3-column grid.
export const RENDER_BATCH_SIZE = 60;

export function batchWindow(
  totalMatches: number,
  batchesShown: number,
  size: number = RENDER_BATCH_SIZE
): { visibleCount: number; hasMore: boolean } {
  const capacity = batchesShown * size;
  return { visibleCount: Math.min(totalMatches, capacity), hasMore: totalMatches > capacity };
}
