import { describe, expect, it } from "vitest";
import { numericFromSource } from "@/lib/analytics/money";
import { buildUtSnapshots } from "@/lib/analytics/snapshots";
import { parcelSnapshotId } from "@/lib/analytics/types";

describe("numericFromSource", () => {
  it("parses source money without inventing values", () => {
    expect(numericFromSource("160350.00")).toBe(160350);
    expect(numericFromSource("1,259.91")).toBe(1259.91);
    expect(numericFromSource(null)).toBeNull();
    expect(numericFromSource("")).toBeNull();
  });
});

describe("buildUtSnapshots", () => {
  const parcels = [
    {
      id: "ut-wa0110110-1",
      municipalityId: "day-block-twp",
      taxMunicipalityId: "baring-plt",
      tpl: "WA0110110.1",
      mapLot: "01-10.1",
      propertyId: "298270006",
      accountNumber: "1198-2174",
      ownerName: "COUSINS ROBERT & RICHARD MINGO",
      mailAddress: "29 LUPINE LN BARING PLT ME",
      assessedLandValue: "26630.00",
      assessedBuildingValue: "0.00",
      assessedTotalValue: "26630.00",
      assessedExemptionValue: null,
      assessedPersonalPropertyValue: "0.00",
      taxAmount: "176.02",
      percentOwnership: "100.00",
      gisAcreage: "10.9",
      taxAcreage: "12.50",
      acreageDiscrepancy: true,
      joinMethod: "property_id",
      joinConfidence: 0.9,
      taxYear: 2025,
      taxSourceId: "mrs-ut-valuation-2025",
      geometrySourceId: "mrs-ut-parcels",
      attrsRaw: { valuationAllocation: "copied_full_assessment" },
    },
    {
      id: "ut-wap-unjoined",
      municipalityId: "baring-plt",
      taxMunicipalityId: null,
      tpl: "WAP0101001",
      mapLot: "01-001",
      propertyId: null,
      accountNumber: null,
      ownerName: null,
      mailAddress: null,
      assessedLandValue: null,
      assessedBuildingValue: null,
      assessedTotalValue: null,
      assessedExemptionValue: null,
      assessedPersonalPropertyValue: null,
      taxAmount: null,
      percentOwnership: null,
      gisAcreage: "2.5",
      taxAcreage: null,
      acreageDiscrepancy: false,
      joinMethod: "unjoined",
      joinConfidence: null,
      taxYear: null,
      taxSourceId: null,
      geometrySourceId: "mrs-ut-parcels",
      attrsRaw: null,
    },
  ];

  const taxRecords = [
    {
      id: "tax-joined",
      mapJoinKey: "WA011|01-10.1",
      mapLot: "01-10.1",
      propertyId: "298270006",
      accountNumber: "1198-2174",
      ownerName: "COUSINS ROBERT & RICHARD MINGO",
      mailAddress: "29 LUPINE LN BARING PLT ME",
      assessedLandValue: "26630.00",
      assessedBuildingValue: "0.00",
      assessedTotalValue: "26630.00",
      assessedExemptionValue: null,
      assessedPersonalPropertyValue: "0.00",
      taxAmount: "176.02",
      percentOwnership: "100.00",
      taxAcreage: "12.50",
      taxYear: 2025,
      geomParcelId: "ut-wa0110110-1",
      attrsRaw: { mapLine: "MAP WA011 PLAN 01 LOT 10.1 10.3" },
    },
    {
      id: "tax-orphan",
      mapJoinKey: "WA001|01-12",
      mapLot: "01-12",
      propertyId: "298180020",
      accountNumber: "1200-0001",
      ownerName: "30-30 CLUB, A MAINE CORP",
      mailAddress: "PO BOX 738",
      assessedLandValue: "0.00",
      assessedBuildingValue: "28450.00",
      assessedTotalValue: "28450.00",
      assessedExemptionValue: null,
      assessedPersonalPropertyValue: "0.00",
      taxAmount: "188.00",
      percentOwnership: "100.00",
      taxAcreage: "0.50",
      taxYear: 2025,
      geomParcelId: null,
      attrsRaw: { mapLine: "MAP WA001 PLAN 01 LOT 12" },
    },
  ];

  const built = buildUtSnapshots({
    runId: "ut-snap-2025-2026-07-26",
    taxYear: 2025,
    geometryAsOf: "2026-07-26",
    valuationAsOf: "2025-01-01",
    geometrySourceId: "mrs-ut-parcels",
    taxSourceId: "mrs-ut-valuation-2025",
    ingestBatchId: "ut-batch-test",
    createdAt: "2026-08-15T00:00:00.000Z",
    parcels,
    taxRecords,
  });

  it("uses parcel + tax year + geometry as-of as the parcel grain", () => {
    expect(built.parcelSnapshots).toHaveLength(2);
    expect(built.parcelSnapshots[0]?.id).toBe(
      parcelSnapshotId("ut-wa0110110-1", 2025, "2026-07-26"),
    );
    expect(built.parcelSnapshots[1]?.taxYear).toBe(2025);
    expect(built.parcelSnapshots[1]?.hasAssessment).toBe(false);
  });

  it("preserves original owner and money strings alongside numerics", () => {
    const cousins = built.parcelSnapshots[0];
    expect(cousins?.ownerNameRaw).toBe("COUSINS ROBERT & RICHARD MINGO");
    expect(cousins?.assessedTotalValueSource).toBe("26630.00");
    expect(cousins?.assessedTotalValueNumeric).toBe(26630);
    expect(cousins?.assessedBuildingValueSource).toBe("0.00");
    expect(cousins?.assessedBuildingValueNumeric).toBe(0);
  });

  it("keeps unjoined tax records in the tax snapshot table", () => {
    expect(built.taxRecordSnapshots).toHaveLength(2);
    const orphan = built.taxRecordSnapshots.find((r) => r.taxRecordId === "tax-orphan");
    expect(orphan?.joinedToGeometry).toBe(false);
    expect(orphan?.parcelId).toBeNull();
    expect(orphan?.ownerNameRaw).toBe("30-30 CLUB, A MAINE CORP");
    expect(built.run.stats.taxRecordsUnjoined).toBe(1);
    expect(built.run.stats.taxRecordsJoined).toBe(1);
  });
});
