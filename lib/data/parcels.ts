import { readFile } from "node:fs/promises";
import path from "node:path";
import { readProcessedJson } from "./reader";
import type { Parcel, ParcelWithSources } from "@/lib/types/parcel";
import type { Source } from "@/lib/types/source";

type SourcesManifest = {
  sources: Source[];
};

type TaxSourcesManifest = {
  ut: Array<{
    id: string;
    name: string;
    urls: string[];
    asOfDate?: string;
  }>;
  organized: Array<{
    id: string;
    name: string;
    urls: string[];
    asOfDate?: string;
  }>;
};

type MunicipalityRow = { id: string; name: string };

let parcelCache: Parcel[] | null = null;
let sourcesCache: Map<string, Source> | null = null;
let taxSourcesCache: Map<string, Source> | null = null;
let municipalityNames: Map<string, string> | null = null;

async function loadParcels(): Promise<Parcel[]> {
  if (parcelCache) return parcelCache;
  try {
    parcelCache = await readProcessedJson<Parcel[]>("parcels.json");
  } catch {
    parcelCache = [];
  }
  return parcelCache;
}

async function loadSources(): Promise<Map<string, Source>> {
  if (sourcesCache) return sourcesCache;
  const map = new Map<string, Source>();
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "manifest", "sources.json"),
      "utf8",
    );
    const manifest = JSON.parse(raw) as SourcesManifest;
    for (const s of manifest.sources) {
      map.set(s.id, s);
    }
  } catch {
    // optional
  }
  sourcesCache = map;
  return map;
}

async function loadTaxSources(): Promise<Map<string, Source>> {
  if (taxSourcesCache) return taxSourcesCache;
  const map = new Map<string, Source>();
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "manifest", "tax-sources.json"),
      "utf8",
    );
    const manifest = JSON.parse(raw) as TaxSourcesManifest;
    for (const entry of [...manifest.ut, ...(manifest.organized ?? [])]) {
      map.set(entry.id, {
        id: entry.id,
        name: entry.name,
        url: entry.urls[0] ?? null,
        asOfDate: entry.asOfDate ?? null,
        licenseNote: null,
        ingestedAt: null,
      });
    }
  } catch {
    // optional
  }
  taxSourcesCache = map;
  return map;
}

async function loadMunicipalityNames(): Promise<Map<string, string>> {
  if (municipalityNames) return municipalityNames;
  try {
    const rows = await readProcessedJson<MunicipalityRow[]>("municipalities.json");
    municipalityNames = new Map(rows.map((r) => [r.id, r.name]));
  } catch {
    municipalityNames = new Map();
  }
  return municipalityNames;
}

export async function getParcelById(id: string): Promise<ParcelWithSources | null> {
  const parcels = await loadParcels();
  const parcel = parcels.find((p) => p.id === id);
  if (!parcel) return null;

  const [sources, taxSources, muniNames] = await Promise.all([
    loadSources(),
    loadTaxSources(),
    loadMunicipalityNames(),
  ]);

  const taxSourceId = parcel.taxSourceId ?? parcel.sourceId;
  const geometrySourceId = parcel.geometrySourceId ?? "mrs-ut-parcels";

  return {
    ...parcel,
    municipalityName: parcel.municipalityId
      ? (muniNames.get(parcel.municipalityId) ?? null)
      : null,
    taxMunicipalityName: parcel.taxMunicipalityId
      ? (muniNames.get(parcel.taxMunicipalityId) ?? null)
      : null,
    taxSource: taxSourceId ? (taxSources.get(taxSourceId) ?? sources.get(taxSourceId) ?? null) : null,
    geometrySource:
      taxSources.get(geometrySourceId) ??
      sources.get(geometrySourceId) ?? {
        id: geometrySourceId,
        name: "Maine Revenue Services UT Parcels",
        url: "https://gis.maine.gov/mapservices/rest/services/mrs/Maine_Parcels_Unorganized_Territory/MapServer",
        asOfDate: null,
        licenseNote: null,
        ingestedAt: null,
      },
  };
}

export function clearParcelCache() {
  parcelCache = null;
  sourcesCache = null;
  taxSourcesCache = null;
  municipalityNames = null;
}
