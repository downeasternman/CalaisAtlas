import { readProcessedJson } from "./reader";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface MunicipalityRecord {
  id: string;
  name: string;
  geocode: string | null;
  isOrganized: boolean;
  bbox: [number, number, number, number];
  centroid: [number, number];
}

export interface MunicipalityWithCoverage extends MunicipalityRecord {
  coverage: {
    hasParcelGeometry: boolean;
    hasOwnership: boolean;
    hasTaxAssessment: boolean;
    parcelCount: number;
    notes: string | null;
  };
}

type CoverageManifest = {
  municipalities: Record<
    string,
    {
      name: string;
      hasParcelGeometry: boolean;
      hasOwnership: boolean;
      hasTaxAssessment: boolean;
      parcelCount: number;
      notes: string | null;
    }
  >;
};

export async function listMunicipalities(): Promise<MunicipalityWithCoverage[]> {
  const municipalities = await readProcessedJson<MunicipalityRecord[]>("municipalities.json");

  let coverage: CoverageManifest["municipalities"] = {};
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "manifest", "coverage.json"),
      "utf8",
    );
    const manifest = JSON.parse(raw) as CoverageManifest;
    coverage = manifest.municipalities ?? {};
  } catch {
    // coverage optional
  }

  return municipalities
    .map((m) => {
      const cov = coverage[m.id];
      return {
        ...m,
        coverage: {
          hasParcelGeometry: cov?.hasParcelGeometry ?? false,
          hasOwnership: cov?.hasOwnership ?? false,
          hasTaxAssessment: cov?.hasTaxAssessment ?? false,
          parcelCount: cov?.parcelCount ?? 0,
          notes: cov?.notes ?? null,
        },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getMunicipalityById(
  id: string,
): Promise<MunicipalityWithCoverage | null> {
  const all = await listMunicipalities();
  return all.find((m) => m.id === id) ?? null;
}
