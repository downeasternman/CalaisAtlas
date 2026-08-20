import { readFile } from "node:fs/promises";
import path from "node:path";

export type OrganizedTownStatus =
  | "pending"
  | "sources_verified"
  | "downloaded"
  | "parsed"
  | "joined"
  | "failed"
  | "excluded";

export type CommitmentLayout = "by-name" | "map-lot";

export interface OrganizedTownSources {
  assessorPageUrl: string | null;
  commitmentPdfUrl: string | null;
  taxMapsUrl: string | null;
  mapLotIndexUrl: string | null;
}

export interface OrganizedTownEntry {
  id: string;
  name: string;
  geocode: string;
  wave: string;
  tier: number;
  status: OrganizedTownStatus;
  geometryParcelCount: number | null;
  sources: OrganizedTownSources;
  taxYear: number | null;
  asOfDate: string | null;
  commitmentLayout?: CommitmentLayout;
  notes: string | null;
}

export interface OrganizedTownsManifest {
  version: number;
  updatedAt: string;
  towns: OrganizedTownEntry[];
  excluded: Array<{ id: string; reason: string }>;
}

let cache: OrganizedTownsManifest | null = null;

export async function loadOrganizedTownsManifest(): Promise<OrganizedTownsManifest> {
  if (cache) return cache;
  const raw = await readFile(
    path.join(process.cwd(), "data", "manifest", "organized-towns.json"),
    "utf8",
  );
  cache = JSON.parse(raw) as OrganizedTownsManifest;
  return cache;
}

export async function getOrganizedTown(id: string): Promise<OrganizedTownEntry | null> {
  const manifest = await loadOrganizedTownsManifest();
  return manifest.towns.find((t) => t.id === id) ?? null;
}

export function isOrganizedMunicipalityId(id: string): boolean {
  return !["talmadge", "pleasant-point", "washington-county-island"].includes(id);
}
