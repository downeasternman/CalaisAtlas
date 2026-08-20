/**
 * Write Calais joined parcels into parcels.json + coverage.
 */
import path from "node:path";
import { ensureDirs, readJson, writeJson } from "../paths";
import { ORGANIZED_PARCELS_JOINED_JSON, PARCELS_JSON } from "./paths";

type ParcelRecord = Record<string, unknown>;

type CoverageManifest = {
  version: number;
  description: string;
  updatedAt: string;
  municipalities: Record<
    string,
    {
      name: string;
      hasParcelGeometry: boolean;
      hasOwnership: boolean;
      hasTaxAssessment: boolean;
      parcelCount: number;
      taxParseRate: number | null;
      notes: string | null;
    }
  >;
};

async function readJoinedOrEmpty(filePath: string): Promise<ParcelRecord[]> {
  try {
    return await readJson<ParcelRecord[]>(filePath);
  } catch {
    return [];
  }
}

async function main() {
  await ensureDirs(path.dirname(PARCELS_JSON));

  const organizedParcels = await readJoinedOrEmpty(ORGANIZED_PARCELS_JOINED_JSON);
  const calaisParcels = organizedParcels.filter(
    (p) => String(p.municipalityId ?? "") === "calais",
  );
  const merged = calaisParcels;

  await writeJson(PARCELS_JSON, merged);
  console.log(`  wrote ${merged.length} Calais parcels`);
  console.log(`  wrote ${PARCELS_JSON}`);

  const coveragePath = path.join(process.cwd(), "data", "manifest", "coverage.json");
  const coverage = await readJson<CoverageManifest>(coveragePath);

  const byMuni = new Map<string, ParcelRecord[]>();
  for (const parcel of merged) {
    const muniId = String(parcel.municipalityId ?? "");
    if (!muniId) continue;
    const list = byMuni.get(muniId) ?? [];
    list.push(parcel);
    byMuni.set(muniId, list);
  }

  for (const [muniId, muniParcels] of byMuni) {
    const entry = coverage.municipalities[muniId];
    if (!entry) continue;

    const withTax = muniParcels.filter((p) => p.assessedTotalValue != null);
    const withOwner = muniParcels.filter((p) => p.ownerName != null && p.ownerName !== "");
    const territoryType = String(muniParcels[0]?.territoryType ?? "");

    entry.hasParcelGeometry = muniParcels.length > 0;
    entry.hasOwnership = withOwner.length > 0;
    entry.hasTaxAssessment = withTax.length > 0;
    entry.parcelCount = muniParcels.length;
    entry.taxParseRate =
      muniParcels.length > 0 ? withTax.length / muniParcels.length : null;

    if (territoryType === "organized") {
      if (withTax.length > 0) {
        entry.notes = `Calais parcels; tax from 2025-26 RE commitment book (${withTax.length}/${muniParcels.length} joined).`;
      } else if (withOwner.length > 0) {
        entry.notes = `Calais parcels; owner-only joins (${withOwner.length}/${muniParcels.length}); assessments not published.`;
      } else {
        entry.notes = "Calais parcel geometry available; tax join pending.";
      }
      continue;
    }

    const wapCount = muniParcels.filter((p) =>
      String(p.tpl ?? "")
        .toUpperCase()
        .startsWith("WAP"),
    ).length;
    if (muniId === "baring-plt") {
      const taxLinked = merged.filter(
        (p) => p.taxMunicipalityId === "baring-plt" && p.assessedTotalValue != null,
      );
      entry.notes =
        wapCount > 0
          ? `Baring GIS uses WAP plat numbering (${wapCount} parcels); valuation book uses WA011/WA029 map sheets. ${taxLinked.length} tax-linked parcels with Baring mail address (see Day Block / Edmunds geometry).`
          : entry.notes;
    } else {
      entry.notes =
        withTax.length > 0
          ? `UT parcels from MRS; tax from 2025 valuation book (${withTax.length}/${muniParcels.length} joined)`
          : "UT parcel geometry available; tax join pending";
    }
  }

  coverage.updatedAt = new Date().toISOString();
  await writeJson(coveragePath, coverage);
  console.log(`  updated ${coveragePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
