import { describe, it, expect } from "vitest";
import { bboxToFitBounds } from "@/lib/geo/bbox";
import { CALAIS_BBOX } from "@/lib/geo/calais";

describe("bboxToFitBounds", () => {
  it("converts a bbox to MapLibre fitBounds format", () => {
    const result = bboxToFitBounds(CALAIS_BBOX);
    expect(result).toEqual([
      [CALAIS_BBOX[0], CALAIS_BBOX[1]],
      [CALAIS_BBOX[2], CALAIS_BBOX[3]],
    ]);
  });
});

describe("CALAIS_BBOX", () => {
  it("has four numeric coordinates", () => {
    expect(CALAIS_BBOX).toHaveLength(4);
    expect(CALAIS_BBOX.every((n) => typeof n === "number")).toBe(true);
  });
});
