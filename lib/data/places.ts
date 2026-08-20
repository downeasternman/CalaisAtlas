import { readProcessedJson } from "./reader";
import { searchPlaces, type SearchablePlace } from "@/lib/search/rank";

export async function loadPlaces(): Promise<SearchablePlace[]> {
  return readProcessedJson<SearchablePlace[]>("places.json");
}

export async function searchPlacesIndex(
  query: string,
  options?: { municipalityId?: string | null; limit?: number },
) {
  const places = await loadPlaces();
  return searchPlaces(places, query, options);
}
