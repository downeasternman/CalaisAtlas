import { describe, expect, it } from "vitest";
import {
  hasTreeGrowthEnrollment,
  parseForestEnrollmentFromLines,
} from "@/lib/tax/tree-growth";

describe("parseForestEnrollmentFromLines", () => {
  it("parses soft, mixed, and hard acreage and values", () => {
    const enrollment = parseForestEnrollmentFromLines([
      "Acres 186.00",
      "Soft: 26.00 2,782",
      "Mixed: 106.00 16,324",
      "Hard: 52.00 9,932",
    ]);

    expect(enrollment.softAcres).toBe(26);
    expect(enrollment.softValue).toBe(2782);
    expect(enrollment.mixedAcres).toBe(106);
    expect(enrollment.hardAcres).toBe(52);
    expect(hasTreeGrowthEnrollment(enrollment)).toBe(true);
  });

  it("returns false when all forest lines are zero", () => {
    const enrollment = parseForestEnrollmentFromLines([
      "Soft: 0.00 0",
      "Mixed: 0.00 0",
      "Hard: 0.00 0",
    ]);
    expect(hasTreeGrowthEnrollment(enrollment)).toBe(false);
  });

  it("detects explicit tree growth text", () => {
    expect(hasTreeGrowthEnrollment(null, "Parcel enrolled in Tree Growth")).toBe(true);
  });
});
