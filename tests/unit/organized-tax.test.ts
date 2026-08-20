import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCommitmentText } from "@/lib/tax/commitment-parser";
import {
  buildOrganizedTaxLookups,
  joinOrganizedTaxToGeometry,
  organizedParcelId,
  parentMapJoinKeys,
} from "@/lib/tax/organized-join";
import { sanitizeOwnerName } from "@/lib/tax/owner-normalize";
import { isValidOwnerName } from "@/lib/tax/owner-validate";
import { hasTreeGrowthEnrollment } from "@/lib/tax/tree-growth";
import { normalizeMapBkLot, organizedMapJoinKey, mapLotJoinCandidates } from "@/lib/tax/map-lot-normalize";

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8");

const lubecSnippet = fixture("lubec-commitment-snippet.txt");
const lubec015 = fixture("lubec-block-015-039.txt");
const lubec002 = fixture("lubec-block-002-006.txt");
const lubec026 = fixture("lubec-block-026-024.txt");
const lubecHomestead = fixture("lubec-block-homestead-trap.txt");
const lubecSubtotal = fixture("lubec-block-subtotal-trap.txt");
const lubecMoneySuffix = fixture("lubec-block-money-suffix.txt");
const lubecStreetTrap = fixture("lubec-block-street-header-trap.txt");
const eastportCapen = fixture("eastport-block-capen.txt");
const cutlerAbrams = fixture("cutler-block-abrams.txt");
const cherryfieldRu = fixture("cherryfield-block-ru-lots.txt");
const newportTreeGrowth = fixture("newport-block-tree-growth.txt");

describe("normalizeMapBkLot", () => {
  it("preserves padded map-lot segments", () => {
    expect(normalizeMapBkLot("004-067")).toBe("004-067");
    expect(normalizeMapBkLot("016-046")).toBe("016-046");
    expect(normalizeMapBkLot("002-006-000")).toBe("002-006");
  });

  it("pads short Cutler-style map-lot segments for joins", () => {
    expect(mapLotJoinCandidates("06-15-0")).toContain("006-015-000");
  });

  it("normalizes Cherryfield R/U map-lots to GeoLibrary form", () => {
    expect(normalizeMapBkLot("R01-003-002")).toBe("0R1-003-002");
    expect(normalizeMapBkLot("U05-007")).toBe("0U5-007");
    expect(normalizeMapBkLot("U16-017")).toBe("U16-017");
    expect(mapLotJoinCandidates("R01-003-002")).toContain("0R1-003");
  });

  it("joins Wesley letter-grid and short numeric map-lots", () => {
    expect(mapLotJoinCandidates("G-0210")).toContain("210");
    expect(mapLotJoinCandidates("06-054")).toContain("006-054-000");
    expect(mapLotJoinCandidates("08-021-A")).toContain("008-021-000");
  });
});

describe("parseCommitmentText", () => {
  it("extracts owner and assessment from MRS commitment snippet", () => {
    const rows = parseCommitmentText(lubecSnippet, "29260", 2025);
    const akerley = rows.find((r) => r.mapLot === "004-067");
    expect(akerley?.ownerName?.toUpperCase()).toContain("AKERLEY");
    expect(akerley?.assessedTotalValue).toBe("94500");
    expect(akerley?.accountNumber).toBe("213");
  });

  it("parses 015-039 with LOVE AT FIRST LIGHT LLC (not subtotal values)", () => {
    const rows = parseCommitmentText(lubec015, "29260", 2024);
    const row = rows.find((r) => r.mapLot === "015-039");
    expect(row?.ownerName).toMatch(/LOVE AT FIRST LIGHT LLC/i);
    expect(row?.ownerName).not.toBe("62,500");
    expect(row?.assessedLandValue).toBe("50300");
    expect(row?.assessedBuildingValue).toBe("103700");
    expect(row?.assessedTotalValue).toBe("154000");
    expect(row?.accountNumber).toBe("860");
  });

  it("parses 002-006 with FERRITER (not COUNTY RD or Ferris values)", () => {
    const rows = parseCommitmentText(lubec002, "29260", 2024);
    const row = rows.find((r) => r.mapLot === "002-006");
    expect(row?.ownerName?.toUpperCase()).toContain("FERRITER");
    expect(row?.ownerName).not.toMatch(/COUNTY|RD/i);
    expect(row?.assessedTotalValue).toBe("28400");
    expect(row?.accountNumber).toBe("79");
  });

  it("parses 026-024 Ferris inline tab values", () => {
    const rows = parseCommitmentText(lubec026, "29260", 2024);
    const row = rows.find((r) => r.mapLot === "026-024");
    expect(row?.ownerName?.toUpperCase()).toContain("FERRIS");
    expect(row?.assessedTotalValue).toBe("112100");
    expect(row?.accountNumber).toBe("1550");
  });

  it("rejects homestead and dollar owners", () => {
    const rows = parseCommitmentText(lubecHomestead, "29260", 2024);
    const row = rows.find((r) => r.mapLot === "005-001");
    expect(row?.ownerName?.toUpperCase()).toContain("SMITH");
    expect(isValidOwnerName("Homestead")).toBe(false);
    expect(isValidOwnerName("62,500")).toBe(false);
  });

  it("ignores page subtotal fragments before 015-039", () => {
    const rows = parseCommitmentText(lubecSubtotal, "29260", 2024);
    const row = rows.find((r) => r.mapLot === "015-039");
    expect(row?.ownerName).toMatch(/LOVE AT FIRST LIGHT LLC/i);
    expect(row?.ownerName).not.toBe("62,500");
  });

  it("strips trailing land value from owner header", () => {
    const rows = parseCommitmentText(lubecMoneySuffix, "29260", 2024);
    const row = rows.find((r) => r.mapLot === "028-030");
    expect(row?.ownerName).toBe("BOYCE, PETER C");
    expect(row?.ownerName).not.toMatch(/155,600/);
    expect(row?.assessedLandValue).toBe("155600");
  });

  it("does not use street lines as owners", () => {
    const rows = parseCommitmentText(lubecStreetTrap, "29260", 2024);
    const row = rows.find((r) => r.mapLot === "014-023");
    expect(row?.ownerName).toMatch(/193 COUNTY ROAD LLC/i);
    expect(row?.ownerName).not.toMatch(/BOSLEY AVENUE/i);
  });

  it("parses Eastport grid map-lot IDs", () => {
    const rows = parseCommitmentText(eastportCapen, "29210", 2023);
    const row = rows.find((r) => r.mapLot === "H7-0B4-10A");
    expect(row?.ownerName).toMatch(/CAPEN AVENUE, LLC/i);
    expect(row?.assessedTotalValue).toBe("105800");
  });

  it("parses Cutler map-lot-first account headers", () => {
    const rows = parseCommitmentText(cutlerAbrams, "29160", 2025);
    const abrams = rows.find((r) => r.mapLot === "06-15-0");
    expect(abrams?.ownerName?.toUpperCase()).toContain("ABRAMS");
    expect(abrams?.assessedTotalValue).toBe("177892");
    expect(abrams?.accountNumber).toBe("658");
  });

  it("parses Cherryfield R/U map-lot lines", () => {
    const rows = parseCommitmentText(cherryfieldRu, "29100", 2020);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const r01 = rows.find((r) => r.mapLot === "0R1-003-002");
    const u16 = rows.find((r) => r.mapLot === "U16-017");
    const u05 = rows.find((r) => r.mapLot === "0U5-007");
    expect(r01?.ownerName?.toUpperCase()).toContain("AFFENITA");
    expect(u16?.ownerName?.toUpperCase()).toContain("ALBEE");
    expect(u05?.ownerName?.toUpperCase()).toContain("FOSTER");
    expect(u16?.assessedTotalValue).toBe("98350");
    expect(u16?.assessedExemptionValue).toBe("23750");
    expect(u16?.attrsRaw.homesteadLabel).toBe(true);
    expect(u05?.assessedTotalValue).toBe("74200");
  });

  it("detects tree growth forest enrollment from soft/mixed/hard lines", () => {
    const rows = parseCommitmentText(newportTreeGrowth, "29180", 2025);
    const row = rows.find((r) => r.mapLot === "018-022-001");
    expect(row?.ownerName?.toUpperCase()).toContain("ARROWSMITH");
    expect(row?.hasTreeGrowth).toBe(true);
    expect(hasTreeGrowthEnrollment(row?.attrsRaw.forestEnrollment as never)).toBe(true);
  });

  it("strips trailing zero land/building columns from Roque Bluffs headers", () => {
    const rows = parseCommitmentText(fixture("roque-bluffs-block-zero-cols.txt"), "29390", 2025);
    const ahern = rows.find((r) => r.mapLot === "10-138");
    expect(ahern?.ownerName).toBe("AHERN, BRIAN");
    expect(ahern?.ownerName).not.toMatch(/0 0/);
    expect(ahern?.assessedTotalValue).toBe("74200");
    const llc = rows.find((r) => r.mapLot === "06-016");
    expect(llc?.ownerName).toBe("324 GREAT COVE ROAD LLC");
    expect(llc?.assessedTotalValue).toBe("494100");
    const ackerman = rows.find((r) => r.mapLot === "003-062");
    expect(ackerman?.ownerName).toBe("ACKERMAN, ELISABETH");
    expect(ackerman?.ownerName).not.toMatch(/0 0/);
  });

  it("does not use NO. CAMINO address fragments as Roque Bluffs owners", () => {
    const rows = parseCommitmentText(fixture("roque-bluffs-block-street-trap.txt"), "29390", 2025);
    const row = rows.find((r) => r.mapLot === "08-023");
    expect(row?.ownerName?.toUpperCase()).toContain("ACETO");
    expect(row?.ownerName).not.toMatch(/CAMINO/i);
    expect(row?.assessedTotalValue).toBe("849400");
  });
});

describe("sanitizeOwnerName", () => {
  it("removes tab-suffixed money from owner strings", () => {
    const result = sanitizeOwnerName("ARCS, ROBERT \t43,100");
    expect(result.name).toBe("ARCS, ROBERT");
    expect(result.extractedLand).toBe("43100");
  });

  it("strips trailing zero columns from owner strings", () => {
    expect(sanitizeOwnerName("AHERN, BRIAN 0 0").name).toBe("AHERN, BRIAN");
    const withAssessment = sanitizeOwnerName("ACKERMAN, ELISABETH 0 0 16,300");
    expect(withAssessment.name).toBe("ACKERMAN, ELISABETH");
    expect(withAssessment.extractedLand).toBe("16300");
  });

  it("rejects address-fragment owners", () => {
    expect(sanitizeOwnerName("NO. CAMINO").name).toBeNull();
  });
});

describe("joinOrganizedTaxToGeometry", () => {
  it("joins tax to geometry by geocode map-lot key", () => {
    const mapJoinKey = organizedMapJoinKey("29260", "004-067");
    const taxRows = parseCommitmentText(lubecSnippet, "29260", 2025).map((r, i) => ({
      ...r,
      id: `tax-${i}`,
    }));
    const lookups = buildOrganizedTaxLookups(taxRows);
    const parcelId = organizedParcelId("lubec", "ME29260001", "004-067");
    const joined = joinOrganizedTaxToGeometry(
      [
        {
          id: parcelId,
          municipalityId: "lubec",
          municipalityName: "Lubec",
          geocode: "29260",
          mapBkLot: "004-067",
          mapJoinKey,
          stateId: "ME29260001",
          propLoc: "58 Englishman Bay Road",
        },
      ],
      lookups,
    );

    expect(joined[0]?.ownerName?.toUpperCase()).toContain("AKERLEY");
    expect(joined[0]?.joinMethod).toBe("map_lot");
  });

  it("falls back to parent map-lot key with owner only", () => {
    const parentKey = organizedMapJoinKey("29260", "004-011")!;
    const taxRows = [
      {
        id: "tax-1",
        accountNumber: "100",
        mapJoinKey: parentKey,
        mapLot: "004-011",
        ownerName: "PARENT OWNER LLC",
        mailAddress: null,
        assessedLandValue: null,
        assessedBuildingValue: null,
        assessedTotalValue: null,
        assessedExemptionValue: null,
        hasTreeGrowth: false,
        taxYear: 2024,
        parseConfidence: 0.3,
        attrsRaw: {},
      },
    ];
    const lookups = buildOrganizedTaxLookups(taxRows);
    const childKey = organizedMapJoinKey("29260", "004-011-00A")!;
    const joined = joinOrganizedTaxToGeometry(
      [
        {
          id: "org-lubec-child",
          municipalityId: "lubec",
          municipalityName: "Lubec",
          geocode: "29260",
          mapBkLot: "004-011-00A",
          mapJoinKey: childKey,
          stateId: null,
          propLoc: null,
        },
      ],
      lookups,
    );

    expect(joined[0]?.joinMethod).toBe("map_lot_parent");
    expect(joined[0]?.ownerName).toBe("PARENT OWNER LLC");
    expect(joined[0]?.assessedTotalValue).toBeNull();
    expect(parentMapJoinKeys("29260", "004-011-00A")).toContain(parentKey.toUpperCase());
  });
});
