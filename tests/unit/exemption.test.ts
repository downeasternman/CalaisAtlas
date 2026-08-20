import { describe, expect, it } from "vitest";
import { detectHomesteadLabel, hasTaxExemption, normalizeExemptionValue } from "@/lib/tax/exemption";

describe("hasTaxExemption", () => {
  it("returns true for positive exemption dollars", () => {
    expect(hasTaxExemption("25000")).toBe(true);
    expect(hasTaxExemption("0")).toBe(false);
    expect(hasTaxExemption(null)).toBe(false);
  });

  it("returns true when homestead label is present in attrs", () => {
    expect(hasTaxExemption(null, { homesteadLabel: true })).toBe(true);
  });
});

describe("normalizeExemptionValue", () => {
  it("normalizes comma-separated exemption amounts", () => {
    expect(normalizeExemptionValue("23,750")).toBe("23750");
    expect(normalizeExemptionValue("0")).toBe(null);
  });
});

describe("detectHomesteadLabel", () => {
  it("detects homestead exempt text in lot lines", () => {
    expect(detectHomesteadLabel(["1.00 01 Homestead Exempt"])).toBe(true);
    expect(detectHomesteadLabel(["10 Homestead"])).toBe(false);
  });
});
