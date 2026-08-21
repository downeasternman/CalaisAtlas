/**
 * Write Calais joined parcels into parcels.json + coverage.
 */
import path from "node:path";
import { polygonCentroid } from "@/lib/analytics/centroid";
import { formatGisAcreage, gisAcresFromGeometry } from "@/lib/geo/gis-acreage";
import {
  COHORT_NONE,
  NO_VALUE_PCT,
  computeCalaisValuePerAcrePercentiles,
} from "@/lib/map/parcel-valuation";
import { hasAcreageDiscrepancy } from "@/lib/tax/acreage-compare";
import { ensureDirs, readJson, writeJson } from "../paths";
import {
  ORGANIZED_PARCELS_GEOJSON,
  ORGANIZED_PARCELS_JOINED_JSON,
  PARCELS_JSON,
} from "./paths";

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

async function loadGisAcresByParcelId(): Promise<Map<string, string>> {
  const acresById = new Map<string, string>();
  const geojson = await readJson<GeoJSON.FeatureCollection>(ORGANIZED_PARCELS_GEOJSON);
  for (const feature of geojson.features) {
    const id = String(feature.properties?.id ?? "");
    if (!id) continue;
    const acres = gisAcresFromGeometry(feature.geometry);
    const formatted = formatGisAcreage(acres);
    if (formatted) acresById.set(id, formatted);
  }
  return acresById;
}

function geometryCentroid(geometry: GeoJSON.Geometry | null): [number, number] | null {
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    const c = polygonCentroid(geometry);
    return c ? [c.lon, c.lat] : null;
  }
  if (geometry.type === "MultiPolygon") {
    const first = geometry.coordinates[0];
    if (!first) return null;
    const c = polygonCentroid({ type: "Polygon", coordinates: first });
    return c ? [c.lon, c.lat] : null;
  }
  return null;
}

function geometryBbox(geometry: GeoJSON.Geometry | null): [number, number, number, number] | null {
  if (!geometry) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (coords: number[]) => {
    const x = coords[0]!;
    const y = coords[1]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  const walk = (geom: GeoJSON.Geometry) => {
    if (geom.type === "Polygon") {
      for (const ring of geom.coordinates) {
        for (const coord of ring) visit(coord);
      }
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        for (const ring of poly) {
          for (const coord of ring) visit(coord);
        }
      }
    }
  };

  walk(geometry);
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

async function loadGeometryMetaByParcelId(): Promise<
  Map<string, { centroid: [number, number] | null; bbox: [number, number, number, number] | null }>
> {
  const meta = new Map<
    string,
    { centroid: [number, number] | null; bbox: [number, number, number, number] | null }
  >();
  const geojson = await readJson<GeoJSON.FeatureCollection>(ORGANIZED_PARCELS_GEOJSON);
  for (const feature of geojson.features) {
    const id = String(feature.properties?.id ?? "");
    if (!id) continue;
    meta.set(id, {
      centroid: geometryCentroid(feature.geometry),
      bbox: geometryBbox(feature.geometry),
    });
  }
  return meta;
}

async function main() {
  await ensureDirs(path.dirname(PARCELS_JSON));

  const organizedParcels = await readJoinedOrEmpty(ORGANIZED_PARCELS_JOINED_JSON);
  const calaisParcels = organizedParcels.filter(
    (p) => String(p.municipalityId ?? "") === "calais",
  );
  const gisAcresById = await loadGisAcresByParcelId();
  const geometryMetaById = await loadGeometryMetaByParcelId();

  const withAcres = calaisParcels.map((p) => {
    const id = String(p.id ?? "");
    const gisAcreage = gisAcresById.get(id) ?? null;
    const taxAcreage =
      p.taxAcreage == null || p.taxAcreage === "" ? null : String(p.taxAcreage);
    const geomMeta = geometryMetaById.get(id);
    return {
      ...p,
      gisAcreage,
      acreage: gisAcreage,
      taxAcreage,
      acreageDiscrepancy: hasAcreageDiscrepancy(gisAcreage, taxAcreage),
      centroid: geomMeta?.centroid ?? null,
      bbox: geomMeta?.bbox ?? null,
    };
  });
  console.log(
    `  GIS acres: ${gisAcresById.size}/${calaisParcels.length} parcels with positive area`,
  );

  const ranks = computeCalaisValuePerAcrePercentiles(
    withAcres.map((p) => ({
      id: String(p.id ?? ""),
      ownerName: p.ownerName == null ? null : String(p.ownerName),
      assessedTotalValue:
        p.assessedTotalValue == null ? null : String(p.assessedTotalValue),
      assessedLandValue:
        p.assessedLandValue == null ? null : String(p.assessedLandValue),
      assessedBuildingValue:
        p.assessedBuildingValue == null ? null : String(p.assessedBuildingValue),
      assessedExemptionValue:
        p.assessedExemptionValue == null ? null : String(p.assessedExemptionValue),
      gisAcreage: p.gisAcreage == null ? null : String(p.gisAcreage),
      attrsRaw:
        p.attrsRaw && typeof p.attrsRaw === "object"
          ? (p.attrsRaw as Record<string, unknown>)
          : null,
    })),
  );

  const merged = withAcres.map((p) => {
    const id = String(p.id ?? "");
    const attrs = ranks.get(id);
    return {
      ...p,
      valuePct: attrs?.valuePct ?? NO_VALUE_PCT,
      valuePerAcre: attrs?.valuePerAcre ?? null,
      cohort: attrs?.cohort ?? COHORT_NONE,
      bookFullyExempt: attrs?.bookFullyExempt ?? false,
      likelyPublicOwner: attrs?.likelyPublicOwner ?? false,
      fullyExempt: attrs?.bookFullyExempt ?? false,
      homestead: attrs?.homestead ?? false,
    };
  });

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
    if (wapCount > 0) {
      entry.notes = `Includes ${wapCount} WAP-plat parcels; tax joins use WA map keys where available.`;
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
