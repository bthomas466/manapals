import { describe, expect, it } from "vitest";
import { chunk } from "@/lib/chunk";

describe("chunk", () => {
  it("returns no chunks for an empty list", () => {
    expect(chunk([], 3)).toEqual([]);
  });
  it("splits an exact multiple evenly", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
  it("keeps the remainder in a short last chunk", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("throws on a size below 1", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});
