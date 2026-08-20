import { describe, expect, it } from "vitest";
import { buildParcelFeature } from "@/lib/analytics/features";
import type { ParcelSnapshot } from "@/lib/analytics/types";

function snapshot(overrides: Partial<ParcelSnapshot>): ParcelSnapshot {
  return {
    id: "ut-a|2025|2026-07-26",
    runId: "ut-snap-2025-2026-07-26",
    parcelId: "ut-a",
    taxYear: 2025,
    geometryAsOf: "2026-07-26",
    territoryType: "ut",
    municipalityId: "day-block-twp",
    taxMunicipalityId: null,
    tpl: "WA0110110.1",
    mapLot: "01-10.1",
    propertyId: "298270006",
    accountNumber: "1198-2174",
    ownerNameRaw: "COUSINS ROBERT & RICHARD MINGO",
    mailAddressRaw: "29 LUPINE LN",
    assessedLandValueSource: "26630.00",
    assessedLandValueNumeric: 26630,
    assessedBuildingValueSource: "0.00",
    assessedBuildingValueNumeric: 0,
    assessedTotalValueSource: "26630.00",
    assessedTotalValueNumeric: 26630,
    assessedExemptionValueSource: null,
    assessedExemptionValueNumeric: null,
    assessedPersonalPropertyValueSource: "0.00",
    assessedPersonalPropertyValueNumeric: 0,
    taxAmountSource: "176.02",
    taxAmountNumeric: 176.02,
    percentOwnershipSource: "100.00",
    gisAcreageSource: "10.9",
    gisAcreageNumeric: 10.9,
    taxAcreageSource: "12.50",
    taxAcreageNumeric: 12.5,
    acreageDiscrepancy: true,
    joinMethod: "property_id",
    joinConfidence: 0.9,
    hasAssessment: true,
    taxRecordId: "tax-1",
    taxSourceId: "mrs-ut-valuation-2025",
    geometrySourceId: "mrs-ut-parcels",
    attrsRaw: {
      valuationAllocation: "single_lot",
      multiLotGroupId: "298270006",
      lotCountInGroup: 1,
    },
    ...overrides,
  };
}

describe("buildParcelFeature", () => {
  it("flags vacant land when building is 0 and tax is present", () => {
    const feature = buildParcelFeature(snapshot({}));
    expect(feature.vacantFlag).toBe(true);
    expect(feature.unjoinedFlag).toBe(false);
    expect(feature.landPlusBuilding).toBe(26630);
    expect(feature.taxableMinusLandBuilding).toBe(0);
    expect(feature.buildingLandRatio).toBe(0);
    expect(feature.valuePerGisAcre).toBeCloseTo(26630 / 10.9);
    expect(feature.tplFamily).toBe("wa_map");
  });

  it("nulls lot-level value per GIS acre for copied multi-lot assessments", () => {
    const feature = buildParcelFeature(
      snapshot({
        attrsRaw: {
          valuationAllocation: "copied_full_assessment",
          multiLotGroupId: "298270006",
          lotCountInGroup: 2,
        },
      }),
    );
    expect(feature.valuationAllocation).toBe("copied_full_assessment");
    expect(feature.taxable).toBe(26630);
    expect(feature.valuePerGisAcre).toBeNull();
    expect(feature.landPerGisAcre).toBeNull();
    expect(feature.buildingPerGisAcre).toBeNull();
    expect(feature.multiLotGroupId).toBe("298270006");
    expect(feature.lotCountInGroup).toBe(2);
  });

  it("leaves assessment features null on unjoined parcels", () => {
    const feature = buildParcelFeature(
      snapshot({
        tpl: "WAP0101001",
        joinMethod: "unjoined",
        hasAssessment: false,
        ownerNameRaw: null,
        assessedLandValueNumeric: null,
        assessedBuildingValueNumeric: null,
        assessedTotalValueNumeric: null,
        taxAcreageNumeric: null,
        taxRecordId: null,
        attrsRaw: null,
      }),
    );
    expect(feature.unjoinedFlag).toBe(true);
    expect(feature.vacantFlag).toBe(false);
    expect(feature.land).toBeNull();
    expect(feature.taxable).toBeNull();
    expect(feature.landPlusBuilding).toBeNull();
    expect(feature.taxableMinusLandBuilding).toBeNull();
    expect(feature.valuePerGisAcre).toBeNull();
    expect(feature.tplFamily).toBe("wap_plat");
  });

  it("nulls building/land ratio when land is 0", () => {
    const feature = buildParcelFeature(
      snapshot({
        assessedLandValueNumeric: 0,
        assessedBuildingValueNumeric: 28450,
        assessedTotalValueNumeric: 28450,
      }),
    );
    expect(feature.buildingLandRatio).toBeNull();
    expect(feature.landPlusBuilding).toBe(28450);
    expect(feature.vacantFlag).toBe(false);
  });

  it("nulls residual when any of land, building, or taxable is missing", () => {
    const feature = buildParcelFeature(
      snapshot({
        assessedLandValueNumeric: 1000,
        assessedBuildingValueNumeric: null,
        assessedTotalValueNumeric: 1000,
      }),
    );
    expect(feature.landPlusBuilding).toBeNull();
    expect(feature.taxableMinusLandBuilding).toBeNull();
  });
});
