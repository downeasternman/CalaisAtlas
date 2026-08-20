import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCommitmentText } from "@/lib/tax/commitment-parser";
import { isLikelySitusOrMailHeader, isValidOwnerName } from "@/lib/tax/owner-validate";
import { isAssessmentConsistent } from "@/lib/tax/owner-resolve";

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8");

const cornHill = fixture("machiasport-block-corn-hill.txt");
const saltIsland = fixture("machiasport-block-salt-island.txt");
const louiseDrive = fixture("machiasport-block-louise-drive.txt");

describe("parseCommitmentText map-lot layout (Machiasport)", () => {
  it("uses mail-line owner instead of CORN HILL situs header", () => {
    const rows = parseCommitmentText(cornHill, "29280", 2025, { layout: "map-lot" });
    const row = rows.find((r) => r.mapLot === "001-001-001");
    expect(row?.ownerName).toMatch(/MILLER/i);
    expect(row?.ownerName).not.toBe("CORN HILL");
    expect(row?.attrsRaw.situsLabel).toBe("CORN HILL");
    expect(row?.attrsRaw.ownerSource).toBe("mail-line");
  });

  it("resolves institutional owner from salt island block", () => {
    const rows = parseCommitmentText(saltIsland, "29280", 2025, { layout: "map-lot" });
    const row = rows.find((r) => r.mapLot === "007-071");
    expect(row?.ownerName).toMatch(/INLAND FISHERIES/i);
    expect(row?.attrsRaw.situsLabel).toBe("STATE HOUSE STATION");
  });

  it("resolves SMITH from louise drive header block", () => {
    const rows = parseCommitmentText(louiseDrive, "29280", 2025, { layout: "map-lot" });
    const row = rows.find((r) => r.mapLot === "021-049");
    expect(row?.ownerName).toBe("SMITH, ROBERT A");
    expect(row?.attrsRaw.situsLabel).toMatch(/LOUISE DRIVE/i);
  });
});

describe("owner validation hardening", () => {
  it("rejects situs and mailing headers", () => {
    expect(isLikelySitusOrMailHeader("CORN HILL")).toBe(true);
    expect(isLikelySitusOrMailHeader("LOUISE DRIVE, APT 18")).toBe(true);
    expect(isValidOwnerName("LOUISE DRIVE, APT 18")).toBe(false);
    expect(isValidOwnerName("ROSS, PATTY ANN")).toBe(true);
    expect(isValidOwnerName("PORT ROAD LLC")).toBe(true);
  });
});

describe("isAssessmentConsistent", () => {
  it("flags building greater than total", () => {
    expect(isAssessmentConsistent("22950", "123350", "19000")).toBe(false);
    expect(isAssessmentConsistent("22950", "12335", "19000")).toBe(true);
  });
});
