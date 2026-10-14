import { describe, expect, it } from "vitest";
import { MANABOX_EXPORT_STEPS, MANABOX_EXPORT_TIP } from "@/lib/onboarding/manaboxInstructions";

const stepText = MANABOX_EXPORT_STEPS.map((segments) => segments.map((s) => s.text).join(""));

describe("Manabox export instructions", () => {
  it("AC-17/AC-26: has at least 3 steps, each non-empty", () => {
    expect(MANABOX_EXPORT_STEPS.length).toBeGreaterThanOrEqual(3);
    for (const text of stepText) expect(text.trim().length).toBeGreaterThan(0);
  });

  it("AC-17: the steps mention Manabox, Export and CSV", () => {
    const all = stepText.join(" ");
    expect(all).toContain("Manabox");
    expect(all).toContain("Export");
    expect(all).toContain("CSV");
  });

  it("has a tip line", () => {
    expect(MANABOX_EXPORT_TIP.length).toBeGreaterThan(0);
  });
});
