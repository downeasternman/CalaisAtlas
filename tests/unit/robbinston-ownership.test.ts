import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRobbinstonOwnerIndex } from "@/lib/tax/robbinston-index-parser";
import { mergeRobbinstonOwnership } from "@/lib/tax/robbinston-merge";
import {
  buildRobbinstonMapLot,
  robbinstonMapLotCandidates,
  splitRobbinstonLotComponents,
} from "@/lib/tax/robbinston-map-lot";
import {
  parseRobbinstonTransfersText,
  rankTransfersByDate,
} from "@/lib/tax/robbinston-transfers-parser";

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8");

describe("robbinston map-lot normalize", () => {
  it("pads numeric map/lot pairs", () => {
    expect(buildRobbinstonMapLot("10", "77")).toBe("010-077");
    expect(robbinstonMapLotCandidates("10", "77")).toContain("010-077-000");
  });

  it("handles lettered lots and maps", () => {
    expect(buildRobbinstonMapLot("10", "67A")).toBe("010-067-00A");
    expect(buildRobbinstonMapLot("5A", "1")).toBe("05A-001");
  });

  it("handles hierarchical and compound lots", () => {
    expect(buildRobbinstonMapLot("1", "5-9")).toBe("001-005-009");
    expect(splitRobbinstonLotComponents("1+3")).toEqual(["1", "3"]);
    expect(splitRobbinstonLotComponents("57-58")).toEqual(["57", "58"]);
    expect(splitRobbinstonLotComponents("5-1")).toEqual(["5-1"]);
  });
});

describe("robbinston index + transfers", () => {
  it("parses owner index markdown table", () => {
    const { rows } = parseRobbinstonOwnerIndex(
      fixture("robbinston-index-snippet.md"),
      "29380",
    );
    const bartlett = rows.find((r) => r.mapLot === "010-077");
    expect(bartlett?.ownerName).toMatch(/BARTLETT/i);
    expect(rows.some((r) => r.mapLot === "001-001" || r.mapLot === "001-003")).toBe(
      true,
    );
  });

  it("parses 24-25 RETTD and older transfer text", () => {
    const newer = parseRobbinstonTransfersText(
      fixture("robbinston-transfer-2425-bartlett.txt"),
      "29380",
      "transfers-24-25",
    );
    expect(newer.rows[0]?.ownerName).toMatch(/BARTLETT/i);
    expect(newer.rows[0]?.mapLot).toBe("010-077");
    expect(newer.rows[0]?.transferDate).toBe("2024-12-08");

    const older = parseRobbinstonTransfersText(
      fixture("robbinston-transfer-2024-carr.txt"),
      "29380",
      "transfers-2024-08",
    );
    expect(older.rows[0]?.ownerName).toMatch(/CARR/i);
    expect(older.rows[0]?.mapLot).toBe("010-002");
  });

  it("prefers newer transfer and overrides stale index owner", () => {
    const { rows: indexRows } = parseRobbinstonOwnerIndex(
      fixture("robbinston-index-snippet.md"),
      "29380",
    );
    const older = parseRobbinstonTransfersText(
      fixture("robbinston-transfer-2024-carr.txt"),
      "29380",
      "transfers-2024-08",
    ).rows;
    const newer = parseRobbinstonTransfersText(
      fixture("robbinston-transfer-override-murphy.txt"),
      "29380",
      "transfers-24-25",
    ).rows;
    const olderDup = {
      ...newer[0]!,
      ownerName: "OLD GRANTEE LLC",
      transferDate: "2023-01-01",
      sourceLabel: "transfers-2024-08",
    };
    const ranked = rankTransfersByDate([...older, ...newer, olderDup]);
    expect(ranked.get(newer[0]!.mapJoinKey)?.ownerName).toMatch(/MURPHY/i);

    const { records, audit } = mergeRobbinstonOwnership(
      indexRows,
      [...older, ...newer],
      2025,
    );
    const overridden = records.find((r) => r.mapLot === "009-099-002");
    expect(overridden?.ownerName).toMatch(/MURPHY/i);
    expect(overridden?.assessedTotalValue).toBeNull();
    expect(audit.transferOverrides).toBeGreaterThan(0);
  });
});
