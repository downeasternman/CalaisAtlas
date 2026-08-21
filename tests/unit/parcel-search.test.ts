import { describe, expect, it } from "vitest";
import { searchParcels, type SearchableParcel } from "@/lib/search/parcel-rank";

const fixtures: SearchableParcel[] = [
  {
    id: "p1",
    label: "123 Main St",
    subtitle: "003-001-001 · DOE, JOHN · 1001",
    ownerNameNormalized: "doe john",
    situsNormalized: "123 main st",
    mapLotNormalized: "003-001-001",
    accountNormalized: "1001",
    municipalityId: "calais",
    mapLot: "003-001-001",
    ownerName: "DOE, JOHN",
    situsAddress: "123 Main St",
    accountNumber: "1001",
    rank: 0,
  },
  {
    id: "p2",
    label: "STATE OF MAINE",
    subtitle: "005-005-021",
    ownerNameNormalized: "state of maine",
    situsNormalized: null,
    mapLotNormalized: "005-005-021",
    accountNormalized: null,
    municipalityId: "calais",
    mapLot: "005-005-021",
    ownerName: "STATE OF MAINE",
    situsAddress: null,
    accountNumber: null,
    rank: 0,
  },
];

describe("searchParcels", () => {
  it("matches exact account first", () => {
    const results = searchParcels(fixtures, "1001");
    expect(results[0]?.id).toBe("p1");
  });

  it("matches map lot", () => {
    const results = searchParcels(fixtures, "005-005-021");
    expect(results[0]?.id).toBe("p2");
  });

  it("matches owner substring", () => {
    const results = searchParcels(fixtures, "state of maine");
    expect(results[0]?.id).toBe("p2");
  });

  it("matches address substring", () => {
    const results = searchParcels(fixtures, "main st");
    expect(results[0]?.id).toBe("p1");
  });
});
