import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPropertyCardOwnerBackup,
  PROPERTY_CARD_SOURCE_ID,
} from "@/lib/tax/property-card-backup";
import { parsePropertyCardText } from "@/lib/tax/property-card-parser";

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8");

describe("parsePropertyCardText", () => {
  it("parses Calais card 1410 STATE OF MAINE / 003-001-011", () => {
    const row = parsePropertyCardText(fixture("calais-property-card-1410.txt"), {
      sourceFile: "#1410.pdf",
    });
    expect(row?.mapLot).toBe("003-001-011");
    expect(row?.accountNumber).toBe("1410");
    expect(row?.ownerName?.toUpperCase()).toContain("STATE OF MAINE");
    expect(row?.asOfDate).toBe("2023-09-12");
  });

  it("parses Calais card 0001 MARRS owner", () => {
    const row = parsePropertyCardText(fixture("calais-property-card-0001.txt"), {
      sourceFile: "#0001.pdf",
    });
    expect(row?.mapLot).toBe("002-005-011-001");
    expect(row?.accountNumber).toBe("1");
    expect(row?.ownerName?.toUpperCase()).toContain("MARRS");
    expect(row?.asOfDate).toBe("2023-09-06");
  });

  it("returns null when owner lines are missing", () => {
    const text = `Sale Data
Map Lot\t003-001-099\tAccount\t999\tLocation\tCard\t1\tOf\t1\t9/01/2023
AUGUSTA ME 04333
`;
    expect(parsePropertyCardText(text)).toBeNull();
  });
});

describe("applyPropertyCardOwnerBackup", () => {
  const card1410 = parsePropertyCardText(fixture("calais-property-card-1410.txt"), {
    sourceFile: "#1410.pdf",
  })!;

  it("fills owner only on ownerless exact map-lot match", () => {
    const { parcels, filled } = applyPropertyCardOwnerBackup(
      [
        {
          id: "a",
          mapLot: "003-001-011",
          ownerName: null,
          accountNumber: null,
          joinMethod: "unjoined",
          attrsRaw: null,
        },
      ],
      [card1410],
    );
    expect(filled).toBe(1);
    expect(parcels[0]?.ownerName?.toUpperCase()).toContain("STATE OF MAINE");
    expect(parcels[0]?.joinMethod).toBe("property_card");
    expect(parcels[0]?.taxSourceId).toBe(PROPERTY_CARD_SOURCE_ID);
    expect(parcels[0]?.accountNumber).toBe("1410");
    expect(parcels[0]?.attrsRaw?.ownerBackup).toBe("property_card_2023");
  });

  it("does not overwrite an existing owner", () => {
    const { parcels, filled } = applyPropertyCardOwnerBackup(
      [
        {
          id: "b",
          mapLot: "003-001-011",
          ownerName: "STAPLES, RUSSELL",
          joinMethod: "map_lot",
        },
      ],
      [card1410],
    );
    expect(filled).toBe(0);
    expect(parcels[0]?.ownerName).toBe("STAPLES, RUSSELL");
    expect(parcels[0]?.joinMethod).toBe("map_lot");
  });

  it("skips map lots with conflicting card owners", () => {
    const { parcels, filled, skippedCollisions } = applyPropertyCardOwnerBackup(
      [
        {
          id: "c",
          mapLot: "003-001-011",
          ownerName: null,
          joinMethod: "unjoined",
        },
      ],
      [
        card1410,
        {
          ...card1410,
          ownerName: "OTHER OWNER LLC",
          accountNumber: "9999",
        },
      ],
    );
    expect(skippedCollisions).toBe(1);
    expect(filled).toBe(0);
    expect(parcels[0]?.ownerName).toBeNull();
  });
});
