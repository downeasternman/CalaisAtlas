import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

export const ROOT = process.cwd();
export const RAW_DIR = path.join(ROOT, "data", "raw");
export const PROCESSED_DIR = path.join(ROOT, "data", "processed");
export const TILES_DIR = path.join(ROOT, "public", "tiles");
export const MANIFEST_DIR = path.join(ROOT, "data", "manifest");

export const METWP_URL =
  "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/ArcGIS/rest/services/METWP_dissolved/FeatureServer/0/query";
export const COUNTY_URL =
  "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/ArcGIS/rest/services/Maine_County_Boundary_Polygons/FeatureServer/1/query";

/** Approximate Calais bbox [west, south, east, north] — refined after boundary download. */
export const DEFAULT_CALAIS_BBOX: [number, number, number, number] = [
  -67.3056, 45.072, -67.1227, 45.1918,
];

/** @deprecated Use DEFAULT_CALAIS_BBOX. Kept so unmigrated scripts still compile. */
export const DEFAULT_COUNTY_BBOX = DEFAULT_CALAIS_BBOX;

export async function ensureDirs(...dirs: string[]) {
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

export async function fetchGeoJson(url: string): Promise<GeoJSON.FeatureCollection> {
  return fetchJson<GeoJSON.FeatureCollection>(url);
}

export async function writeJson(filePath: string, data: unknown) {
  await ensureDirs(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function padBbox(
  bbox: [number, number, number, number],
  pad = 0.015,
): [number, number, number, number] {
  return [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad];
}

export function bboxFromFeatureCollection(
  fc: GeoJSON.FeatureCollection,
): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (coords: number[] | number[][] | number[][][] | number[][][][]) => {
    if (typeof coords[0] === "number") {
      const [x, y] = coords as number[];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      return;
    }
    for (const c of coords as Array<number[] | number[][] | number[][][]>) {
      visit(c);
    }
  };

  for (const feature of fc.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === "GeometryCollection") continue;
    visit(feature.geometry.coordinates as never);
  }

  if (!Number.isFinite(minX)) {
    return DEFAULT_CALAIS_BBOX;
  }
  return [minX, minY, maxX, maxY];
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
