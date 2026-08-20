import { describe, expect, it } from "vitest";
import type { ParcelFeature } from "@/lib/analytics/features";
import { jaroWinkler, tokenSortJaroWinkler } from "@/lib/analytics/jaro-winkler";
import {
  analyticalNormalizeOwner,
  entityTypeOf,
  isAgencyVariant,
} from "@/lib/analytics/owner-normalize";
import { buildOwnershipLayer } from "@/lib/analytics/ownership";
import type { ParcelSnapshot } from "@/lib/analytics/types";

function snapshot(
  partial: Pick<ParcelSnapshot, "parcelId"> & Partial<ParcelSnapshot>,
): ParcelSnapshot {
  return {
    id: `${partial.parcelId}|2025|2026-07-26`,
    runId: "run",
    taxYear: 2025,
    geometryAsOf: "2026-07-26",
    territoryType: "ut",
    municipalityId: "trescott-twp",
    taxMunicipalityId: null,
    tpl: "WA001011",
    mapLot: "01-1",
    propertyId: null,
    accountNumber: null,
    ownerNameRaw: null,
    mailAddressRaw: null,
    assessedLandValueSource: null,
    assessedLandValueNumeric: null,
    assessedBuildingValueSource: null,
    assessedBuildingValueNumeric: null,
    assessedTotalValueSource: null,
    assessedTotalValueNumeric: null,
    assessedExemptionValueSource: null,
    assessedExemptionValueNumeric: null,
    assessedPersonalPropertyValueSource: null,
    assessedPersonalPropertyValueNumeric: null,
    taxAmountSource: null,
    taxAmountNumeric: null,
    percentOwnershipSource: null,
    gisAcreageSource: "10",
    gisAcreageNumeric: 10,
    taxAcreageSource: null,
    taxAcreageNumeric: null,
    acreageDiscrepancy: null,
    joinMethod: "map_lot",
    joinConfidence: 1,
    hasAssessment: true,
    taxRecordId: null,
    taxSourceId: "mrs-ut-valuation-2025",
    geometrySourceId: "mrs-ut-parcels",
    attrsRaw: null,
    ...partial,
  };
}

function feature(
  partial: Partial<ParcelFeature> & Pick<ParcelFeature, "parcelId">,
): ParcelFeature {
  return {
    id: `${partial.parcelId}|features`,
    snapshotId: `${partial.parcelId}|2025|2026-07-26`,
    runId: "run",
    taxYear: 2025,
    geometryAsOf: "2026-07-26",
    gisAcreage: 10,
    taxAcreage: 10,
    land: 1000,
    building: 0,
    taxable: 1000,
    exemption: null,
    landPlusBuilding: 1000,
    taxableMinusLandBuilding: 0,
    valuePerGisAcre: 100,
    landPerGisAcre: 100,
    buildingPerGisAcre: 0,
    buildingLandRatio: 0,
    vacantFlag: true,
    unjoinedFlag: false,
    tplFamily: "wa_map",
    multiLotGroupId: partial.parcelId,
    lotCountInGroup: 1,
    valuationAllocation: "single_lot",
    ...partial,
  };
}

describe("analytical owner normalize", () => {
  it("expands L.L.C. and ETAL onto the same identity key as LLC / ET AL", () => {
    expect(analyticalNormalizeOwner("Typhoon L.L.C.")).toBe("TYPHOON LLC");
    expect(analyticalNormalizeOwner("TYPHOON LLC")).toBe("TYPHOON LLC");
    expect(analyticalNormalizeOwner("SMITH JOHN ETAL")).toBe("SMITH JOHN ET AL");
  });

  it("keeps MAINE STATE OF and MAINE STATE OF (IF&W) distinct", () => {
    const a = analyticalNormalizeOwner("MAINE STATE OF");
    const b = analyticalNormalizeOwner("MAINE STATE OF (IF&W)");
    expect(a).toBe("MAINE STATE OF");
    expect(b).toBe("MAINE STATE OF IF&W");
    expect(a).not.toBe(b);
    expect(isAgencyVariant(a!, b!)).toBe(true);
  });

  it("tags conservation before generic trust", () => {
    expect(entityTypeOf("MAINE COAST HERITAGE TRUST")).toBe("conservation");
    expect(entityTypeOf("SMITH FAMILY TRUST")).toBe("trust");
    expect(entityTypeOf("UNITED STATES OF AMERICA")).toBe("federal");
  });
});

describe("jaro-winkler", () => {
  it("is 1 for identical strings and high for a single transposition", () => {
    expect(jaroWinkler("MARTHA", "MARTHA")).toBe(1);
    expect(jaroWinkler("MARTHA", "MARHTA")).toBeGreaterThan(0.96);
  });
});

describe("buildOwnershipLayer", () => {
  it("treats L.L.C. and LLC as the same entity, never token-sort identity", () => {
    const layer = buildOwnershipLayer({
      snapshots: [
        snapshot({ parcelId: "p1", ownerNameRaw: "FOO L.L.C.", gisAcreageNumeric: 5 }),
        snapshot({ parcelId: "p2", ownerNameRaw: "FOO LLC", gisAcreageNumeric: 7 }),
      ],
      features: [feature({ parcelId: "p1" }), feature({ parcelId: "p2" })],
      neighbors: [],
    });
    expect(layer.entities).toHaveLength(1);
    expect(layer.entities[0]?.nameNormalized).toBe("FOO LLC");
    expect(layer.entities[0]?.parcelCount).toBe(2);
    expect(layer.entities[0]?.gisAcres).toBe(12);
  });

  it("does not auto-merge JOHN SMITH and JOHN SMYTH", () => {
    const layer = buildOwnershipLayer({
      snapshots: [
        snapshot({
          parcelId: "p1",
          ownerNameRaw: "JOHN SMITH",
          municipalityId: "edmunds-twp",
        }),
        snapshot({
          parcelId: "p2",
          ownerNameRaw: "JOHN SMYTH",
          municipalityId: "edmunds-twp",
        }),
      ],
      features: [feature({ parcelId: "p1" }), feature({ parcelId: "p2" })],
      neighbors: [],
    });
    expect(layer.entities).toHaveLength(2);
    const similar = layer.graph.edges.filter((e) => e.type === "similar_name");
    expect(tokenSortJaroWinkler("JOHN SMITH", "JOHN SMYTH")).toBeGreaterThan(0.92);
    expect(similar).toHaveLength(1);
    expect(similar[0]?.evidence?.status).toBe("similar_name");
    expect(similar[0]?.evidence?.note).toMatch(/not same_entity/);
  });

  it("does not emit similar_name across townships without mail or adjacency", () => {
    const layer = buildOwnershipLayer({
      snapshots: [
        snapshot({
          parcelId: "p1",
          ownerNameRaw: "JOHN SMITH",
          municipalityId: "edmunds-twp",
        }),
        snapshot({
          parcelId: "p2",
          ownerNameRaw: "JOHN SMYTH",
          municipalityId: "trescott-twp",
        }),
      ],
      features: [feature({ parcelId: "p1" }), feature({ parcelId: "p2" })],
      neighbors: [],
    });
    expect(layer.graph.edges.filter((e) => e.type === "similar_name")).toHaveLength(0);
  });

  it("emits possible_related for IF&W agency variants without merging", () => {
    const layer = buildOwnershipLayer({
      snapshots: [
        snapshot({ parcelId: "p1", ownerNameRaw: "MAINE STATE OF" }),
        snapshot({ parcelId: "p2", ownerNameRaw: "MAINE STATE OF (IF&W)" }),
      ],
      features: [feature({ parcelId: "p1" }), feature({ parcelId: "p2" })],
      neighbors: [],
    });
    expect(layer.entities.map((e) => e.nameNormalized).sort()).toEqual([
      "MAINE STATE OF",
      "MAINE STATE OF IF&W",
    ]);
    expect(layer.graph.edges.some((e) => e.type === "possible_related")).toBe(true);
    expect(layer.graph.edges.some((e) => e.type === "similar_name")).toBe(false);
  });

  it("builds contiguous acres from adjacent same-owner parcels", () => {
    const layer = buildOwnershipLayer({
      snapshots: [
        snapshot({ parcelId: "a", ownerNameRaw: "TYPHOON LLC", gisAcreageNumeric: 3 }),
        snapshot({ parcelId: "b", ownerNameRaw: "TYPHOON LLC", gisAcreageNumeric: 4 }),
        snapshot({ parcelId: "c", ownerNameRaw: "TYPHOON LLC", gisAcreageNumeric: 1 }),
      ],
      features: [feature({ parcelId: "a" }), feature({ parcelId: "b" }), feature({ parcelId: "c" })],
      neighbors: [
        { parcelId: "a", neighborId: "b", kind: "touch" },
        { parcelId: "b", neighborId: "a", kind: "touch" },
      ],
    });
    const typhoon = layer.entities.find((e) => e.nameNormalized === "TYPHOON LLC");
    expect(typhoon?.institutionalBaseline).toBe(true);
    expect(typhoon?.contiguousComponentCount).toBe(2);
    expect(typhoon?.maxContiguousGisAcres).toBe(7);
    expect(layer.clusters).toHaveLength(2);
  });
});
