import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getParcelsLoadStatus } from "@/lib/data/parcels";
import { getPlacesLoadStatus } from "@/lib/data/places";
import { getParcelSearchLoadStatus } from "@/lib/data/parcel-search";
import { getSearchAvailability } from "@/lib/data/search";

export const dynamic = "force-dynamic";

type ReleaseManifest = {
  releaseId?: string;
  generatedAt?: string;
  parcelCount?: number;
  withOwner?: number;
  withAssessment?: number;
  ranked?: number;
  cardBackups?: number;
  searchIndexCount?: number;
  sourceDates?: Record<string, string | null>;
};

async function loadReleaseManifest(): Promise<ReleaseManifest | null> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "manifest", "release.json"),
      "utf8",
    );
    return JSON.parse(raw) as ReleaseManifest;
  } catch {
    return null;
  }
}

async function tilesPresent(): Promise<boolean> {
  try {
    await readFile(path.join(process.cwd(), "public", "tiles", "parcels.pmtiles"));
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [parcels, places, parcelSearch, release, tiles] = await Promise.all([
    getParcelsLoadStatus(),
    getPlacesLoadStatus(),
    getParcelSearchLoadStatus(),
    loadReleaseManifest(),
    tilesPresent(),
  ]);

  const search = await getSearchAvailability();

  return NextResponse.json({
    appVersion: process.env.npm_package_version ?? "0.1.0",
    releaseId: release?.releaseId ?? null,
    generatedAt: release?.generatedAt ?? null,
    dataState: {
      parcels,
      places,
      parcelSearch,
      search,
    },
    coverage: release
      ? {
          parcelCount: release.parcelCount ?? parcels.count,
          withOwner: release.withOwner ?? null,
          withAssessment: release.withAssessment ?? null,
          ranked: release.ranked ?? null,
          cardBackups: release.cardBackups ?? null,
          searchIndexCount: release.searchIndexCount ?? parcelSearch.count,
          sourceDates: release.sourceDates ?? {},
        }
      : {
          parcelCount: parcels.count,
          withOwner: null,
          withAssessment: null,
          ranked: null,
          cardBackups: null,
          searchIndexCount: parcelSearch.count,
          sourceDates: {},
        },
    tilesPresent: tiles,
  });
}
