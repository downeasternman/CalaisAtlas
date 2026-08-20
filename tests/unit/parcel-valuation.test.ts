import { describe, expect, it } from "vitest";
import {
  NO_VALUE_PCT,
  computeCalaisValuePercentiles,
} from "@/lib/map/parcel-valuation";

describe("computeCalaisValuePercentiles", () => {
  it("excludes null and invalid totals from the comparison set", () => {
    const ranks = computeCalaisValuePercentiles([
      { id: "a", assessedTotalValue: "1000" },
      { id: "b", assessedTotalValue: null },
      { id: "c", assessedTotalValue: "50" },
      { id: "d", assessedTotalValue: "9000" },
    ]);
    expect(ranks.get("b")).toBe(NO_VALUE_PCT);
    expect(ranks.get("c")).toBe(NO_VALUE_PCT);
    expect(ranks.get("a")).toBe(0);
    expect(ranks.get("d")).toBe(100);
  });

  it("assigns 50 when only one parcel has a valid assessment", () => {
    const ranks = computeCalaisValuePercentiles([
      { id: "solo", assessedTotalValue: "250000" },
      { id: "none", assessedTotalValue: null },
    ]);
    expect(ranks.get("solo")).toBe(50);
    expect(ranks.get("none")).toBe(NO_VALUE_PCT);
  });

  it("shares average rank on ties", () => {
    const ranks = computeCalaisValuePercentiles([
      { id: "low", assessedTotalValue: "1000" },
      { id: "mid-a", assessedTotalValue: "5000" },
      { id: "mid-b", assessedTotalValue: "5000" },
      { id: "high", assessedTotalValue: "9000" },
    ]);
    expect(ranks.get("low")).toBe(0);
    expect(ranks.get("high")).toBe(100);
    expect(ranks.get("mid-a")).toBe(ranks.get("mid-b"));
    expect(ranks.get("mid-a")).toBe(50);
  });
});
