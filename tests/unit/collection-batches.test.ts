import { describe, expect, it } from "vitest";
import { RENDER_BATCH_SIZE as B, batchWindow } from "@/lib/collection/batches";

describe("batchWindow", () => {
  it("AC-9: batch size is between 1 and 200", () => {
    expect(B).toBeGreaterThanOrEqual(1);
    expect(B).toBeLessThanOrEqual(200);
  });

  it("AC-14: 0 matches shows nothing and has no more", () => {
    expect(batchWindow(0, 1)).toEqual({ visibleCount: 0, hasMore: false });
  });

  it("AC-14: exactly B matches fit in one batch", () => {
    expect(batchWindow(B, 1)).toEqual({ visibleCount: B, hasMore: false });
  });

  it("AC-14: B+1 matches leave one more behind the first batch", () => {
    expect(batchWindow(B + 1, 1)).toEqual({ visibleCount: B, hasMore: true });
    expect(batchWindow(B + 1, 2)).toEqual({ visibleCount: B + 1, hasMore: false });
  });

  it("AC-14: 3B-1 matches take three batches", () => {
    expect(batchWindow(3 * B - 1, 2)).toEqual({ visibleCount: 2 * B, hasMore: true });
    expect(batchWindow(3 * B - 1, 3)).toEqual({ visibleCount: 3 * B - 1, hasMore: false });
  });
});
