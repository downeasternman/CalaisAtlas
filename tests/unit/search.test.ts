import { describe, it, expect } from "vitest";
import { normalizePlaceName } from "@/lib/geo/normalize";
import { searchPlaces, type SearchablePlace } from "@/lib/search/rank";

const samplePlaces: SearchablePlace[] = [
  {
    id: "muni-machias",
    name: "Machias",
    nameNormalized: "machias",
    placeType: "municipality",
    municipalityId: "machias",
    rank: 100,
    centroid: [-67.46, 44.71],
    bbox: [-67.5, 44.65, -67.4, 44.75],
  },
  {
    id: "muni-calais",
    name: "Calais",
    nameNormalized: "calais",
    placeType: "municipality",
    municipalityId: "calais",
    rank: 100,
    centroid: [-67.28, 45.19],
    bbox: [-67.35, 45.1, -67.2, 45.25],
  },
  {
    id: "osm-1",
    name: "Machiasport",
    nameNormalized: "machiasport",
    placeType: "populated_place",
    municipalityId: null,
    rank: 50,
    centroid: [-67.4, 44.68],
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
    const results = searchPlaces(samplePlaces, "Machias");
    expect(results[0]?.name).toBe("Machias");
    expect(results[0]?.placeType).toBe("municipality");
  });

  it("returns prefix matches", () => {
    const results = searchPlaces(samplePlaces, "Cal");
    expect(results.some((r) => r.name === "Calais")).toBe(true);
  });

  it("requires at least 2 characters", () => {
    expect(searchPlaces(samplePlaces, "M")).toHaveLength(0);
  });

  it("scopes search to selected municipality when filter active", () => {
    const scoped = searchPlaces(samplePlaces, "machias", {
      municipalityId: "calais",
    });
    expect(scoped).toHaveLength(0);

    const inTown = searchPlaces(samplePlaces, "calais", {
      municipalityId: "calais",
    });
    expect(inTown.some((r) => r.name === "Calais")).toBe(true);
  });
});
