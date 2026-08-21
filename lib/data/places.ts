import { readProcessedJson } from "./reader";
import type { DatasetStatus, DataLoadState } from "./load-state";
import { searchPlaces, type SearchablePlace } from "@/lib/search/rank";

let placesCache: SearchablePlace[] | null = null;
let loadState: DataLoadState = "missing";
let loadError: string | null = null;

export async function loadPlaces(): Promise<SearchablePlace[]> {
  if (placesCache) return placesCache;
  try {
    placesCache = await readProcessedJson<SearchablePlace[]>("places.json");
    loadState = "ok";
    loadError = null;
  } catch (err) {
    loadState =
      err instanceof Error && "code" in err && err.code === "ENOENT" ? "missing" : "error";
    loadError = err instanceof Error ? err.message : "Unknown error";
    placesCache = [];
  }
  return placesCache;
}

export async function getPlacesLoadStatus(): Promise<DatasetStatus> {
  await loadPlaces();
  return {
    state: loadState,
    count: placesCache?.length ?? 0,
    errorMessage: loadError,
  };
}

export async function searchPlacesIndex(
  query: string,
  options?: { municipalityId?: string | null; limit?: number },
) {
  const status = await getPlacesLoadStatus();
  if (status.state !== "ok") {
    throw new Error("PLACES_INDEX_MISSING");
  }
  const places = await loadPlaces();
  return searchPlaces(places, query, options);
}

export function clearPlacesCache() {
  placesCache = null;
  loadState = "missing";
  loadError = null;
}
