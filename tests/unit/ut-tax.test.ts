import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTaxLookups, joinUtTaxToGeometry } from "@/lib/tax/join";
import { parseMapLotIndexText } from "@/lib/tax/map-index-parser";
import { mapJoinKey } from "@/lib/tax/plan-lot";
import { hasAcreageDiscrepancy } from "@/lib/tax/acreage-compare";
import { parseUtValuationText } from "@/lib/tax/ut-parser";

const valuationSnippet = readFileSync(
  path.join(process.cwd(), "tests", "fixtures", "ut-valuation-snippet.txt"),
  "utf8",
);
const indexSnippet = readFileSync(
  path.join(process.cwd(), "tests", "fixtures", "ut-map-index-snippet.txt"),
  "utf8",
);

const mapSheets = {
  WA011: {
    mapCode: "WA011",
    divisionName: "Day Block Township",
    geometryMunicipalityIds: ["day-block-twp"],
    taxMunicipalityIds: ["day-block-twp", "baring-plt"],
    notes: null,
  },
};

describe("parseUtValuationText", () => {
  it("extracts MRS property blocks with MAP WA keys and assessed values", () => {
    const rows = parseUtValuationText(valuationSnippet, 2025);
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const t26 = rows.find((r) => r.mapJoinKey === mapJoinKey("WA003", "01", "5"));
    expect(t26?.ownerName).toContain("SPRAGUE");
    expect(t26?.assessedTotalValue).toBe("106320.00");
    expect(t26?.assessedExemptionValue).toBeNull();
    expect(t26?.propertyId).toBeTruthy();
    expect(t26?.accountNumber).toBe("1202-6384");
    expect(t26?.percentOwnership).toBe("100.00");
    expect(t26?.acreage).toBe("1.10");
    expect(t26?.taxAmount).toBe("702.78");
    expect(t26?.assessedPersonalPropertyValue).toBe("0.00");
    expect(t26?.attrsRaw.valuationAllocation).toBe("single_lot");
  });

  it("copies full assessment onto each lot in a multi-lot block", () => {
    const rows = parseUtValuationText(valuationSnippet, 2025);
    const cousins = rows.filter((r) => r.propertyId === "298270006");
    expect(cousins).toHaveLength(2);
    expect(cousins.every((r) => r.assessedTotalValue === "26630.00")).toBe(true);
    expect(cousins.every((r) => r.attrsRaw.valuationAllocation === "copied_full_assessment")).toBe(
      true,
    );
    expect(cousins[0]?.attrsRaw.lotCountInGroup).toBe(2);
  });

  it("parses total exemptions from UT valuation blocks", () => {
    const withExemption = valuationSnippet.replace(
      "Total Exemptions\t0.00",
      "Total Exemptions\t12,500.00",
    );
    const rows = parseUtValuationText(withExemption, 2025);
    const t26 = rows.find((r) => r.mapJoinKey === mapJoinKey("WA003", "01", "5"));
    expect(t26?.assessedExemptionValue).toBe("12500.00");
  });
});

describe("parseMapLotIndexText", () => {
  it("parses map/lot index rows with property IDs", () => {
    const rows = parseMapLotIndexText(indexSnippet);
    const cousins = rows.find((r) => r.propertyId === "298270006");
    expect(cousins?.mapJoinKey).toBe(mapJoinKey("WA011", "01", "10.1"));
    expect(cousins?.divisionName).toBe("Day Block Township");
  });
});

describe("hasAcreageDiscrepancy", () => {
  it("flags GIS vs tax-book acres beyond 0.5 ac or 10%", () => {
    expect(hasAcreageDiscrepancy("10.9", "12.50")).toBe(true);
    expect(hasAcreageDiscrepancy("1.10", "1.10")).toBe(false);
    expect(hasAcreageDiscrepancy("1.0072341", "1.10")).toBe(false);
    expect(hasAcreageDiscrepancy("10", null)).toBe(false);
  });
});

describe("joinUtTaxToGeometry", () => {
  it("joins Cousins tax to Day Block WA011 geometry", () => {
    const taxRows = parseUtValuationText(valuationSnippet, 2025).map((r, i) => ({
      ...r,
      id: `tax-${i}`,
    }));
    const lookups = buildTaxLookups(taxRows);
    const joined = joinUtTaxToGeometry(
      [
        {
          id: "ut-wa0110110-1",
          municipalityId: "day-block-twp",
          municipalityName: "Day Block Twp",
          planLot: "01-10.1",
          tpl: "WA0110110.1",
          mapJoinKey: mapJoinKey("WA011", "01", "10.1"),
          tplFamily: "wa_map",
          acreage: "10.9",
          geocode: "29827",
        },
      ],
      lookups,
      mapSheets,
    );

    const cousins = taxRows.find((r) => r.propertyId === "298270006");
    if (cousins) {
      const match = joined.find((j) => j.taxRecordId === cousins.id);
      expect(match?.ownerName).toContain("COUSINS");
      expect(match?.taxMunicipalityId).toBe("baring-plt");
      expect(match?.gisAcreage).toBe("10.9");
      expect(match?.taxAcreage).toBe("12.50");
      expect(match?.acreage).toBe("10.9");
      expect(match?.acreageDiscrepancy).toBe(true);
      expect(match?.accountNumber).toBe("1198-2174");
    }
  });
});
