import { describe, expect, it } from "vitest";
import {
  classifyParcelCoverageTier,
  classifyParcelProgram,
  classifyParcelSymbology,
  resolveParcelFillColor,
} from "@/lib/map/parcel-coverage";

describe("classifyParcelCoverageTier", () => {
  it("classifies full, owner-only, and boundary tiers", () => {
    expect(
      classifyParcelCoverageTier("SMITH, JOHN", "154000"),
    ).toBe(2);
    expect(classifyParcelCoverageTier("SMITH, JOHN", null)).toBe(1);
    expect(classifyParcelCoverageTier(null, null)).toBe(0);
  });
});

describe("classifyParcelProgram", () => {
  it("prioritizes tree growth over exemption", () => {
    expect(classifyParcelProgram(true, true)).toBe(2);
    expect(classifyParcelProgram(false, true)).toBe(1);
    expect(classifyParcelProgram(false, false)).toBe(0);
  });
});

describe("classifyParcelSymbology", () => {
  it("marks low confidence when join score is below threshold", () => {
    const symbology = classifyParcelSymbology({
      ownerName: "SMITH, JOHN",
      assessedTotalValue: "154000",
      joinConfidence: 0.5,
    });
    expect(symbology.coverageTier).toBe(2);
    expect(symbology.joinLow).toBe(1);
  });

  it("uses tree growth program from attrs when flagged", () => {
    const symbology = classifyParcelSymbology({
      ownerName: "TIMBERLANDS LLC",
      assessedTotalValue: "61800",
      attrsRaw: {
        forestEnrollment: {
          softAcres: 26,
          mixedAcres: 106,
          hardAcres: 52,
          softValue: 2782,
          mixedValue: 16324,
          hardValue: 9932,
        },
      },
      joinConfidence: 0.9,
    });
    expect(symbology.program).toBe(2);
    expect(symbology.joinLow).toBe(0);
  });
});

describe("resolveParcelFillColor", () => {
  it("returns muted full color for low-confidence full parcels", () => {
    expect(resolveParcelFillColor(0, 2, 1)).toBe("#a68b2a");
    expect(resolveParcelFillColor(2, 2, 0)).toBe("#4d6b4a");
  });
});
