import { readProcessedJson } from "./reader";
import type { DatasetStatus, DataLoadState } from "./load-state";
import type { SearchableParcel } from "@/lib/search/parcel-rank";

let indexCache: SearchableParcel[] | null = null;
let loadState: DataLoadState = "missing";
let loadError: string | null = null;

export async function loadParcelSearchIndex(): Promise<SearchableParcel[]> {
  if (indexCache) return indexCache;
  if (loadState === "error") return [];
  try {
    indexCache = await readProcessedJson<SearchableParcel[]>("parcel-search.json");
    loadState = "ok";
    loadError = null;
  } catch (err) {
    loadState = err instanceof Error && "code" in err && err.code === "ENOENT" ? "missing" : "error";
    loadError = err instanceof Error ? err.message : "Unknown error";
    indexCache = [];
  }
  return indexCache;
}

export async function getParcelSearchLoadStatus(): Promise<DatasetStatus> {
  await loadParcelSearchIndex();
  return {
    state: loadState,
    count: indexCache?.length ?? 0,
    errorMessage: loadError,
  };
}

export function clearParcelSearchCache() {
  indexCache = null;
  loadState = "missing";
  loadError = null;
}
