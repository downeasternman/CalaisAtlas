import { describe, it, expect } from "vitest";
import { normalizePlaceName } from "@/lib/geo/normalize";
import { searchPlaces, type SearchablePlace } from "@/lib/search/rank";

const samplePlaces: SearchablePlace[] = [
  {
    id: "muni-calais",
    name: "Calais",
    nameNormalized: "calais",
    placeType: "municipality",
    municipalityId: "calais",
    rank: 100,
    centroid: [-67.21, 45.13],
    bbox: [-67.3056, 45.072, -67.1227, 45.1918],
  },
  {
    id: "osm-milltown",
    name: "Milltown",
    nameNormalized: "milltown",
    placeType: "populated_place",
    municipalityId: "calais",
    rank: 50,
    centroid: [-67.22, 45.17],
    bbox: null,
  },
];

describe("normalizePlaceName", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizePlaceName("St. Stephen")).toBe("st stephen");
  });
});

describe("searchPlaces", () => {
  it("ranks exact municipality matches highest", () => {
    const results = searchPlaces(samplePlaces, "Calais");
    expect(results[0]?.name).toBe("Calais");
    expect(results[0]?.placeType).toBe("municipality");
  });

  it("returns prefix matches", () => {
    const results = searchPlaces(samplePlaces, "Cal");
    expect(results.some((r) => r.name === "Calais")).toBe(true);
  });

  it("requires at least 2 characters", () => {
    expect(searchPlaces(samplePlaces, "C")).toHaveLength(0);
  });

  it("finds Calais populated places without a town filter", () => {
    const results = searchPlaces(samplePlaces, "mill");
    expect(results.some((r) => r.name === "Milltown")).toBe(true);
  });
});
