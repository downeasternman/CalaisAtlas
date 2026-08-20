import { normalizePlaceName } from "@/lib/geo/normalize";
import type { PlaceType } from "@/lib/types/place";

export interface SearchablePlace {
  id: string;
  name: string;
  nameNormalized: string;
  placeType: PlaceType;
  municipalityId: string | null;
  rank: number;
  centroid: [number, number];
  bbox: [number, number, number, number] | null;
}

export interface RankedPlace extends SearchablePlace {
  score: number;
}

/**
 * Score a place against a normalized query string.
 * Higher is better; 0 means no match.
 */
export function scorePlace(queryNormalized: string, place: SearchablePlace): number {
  if (!queryNormalized) return 0;

  const name = place.nameNormalized;
  if (name === queryNormalized) return 100 + place.rank;
  if (name.startsWith(queryNormalized)) return 80 + place.rank;
  if (name.includes(queryNormalized)) return 50 + place.rank;

  const tokens = queryNormalized.split(" ").filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => name.includes(t))) {
    return 40 + place.rank;
  }

  return 0;
}

export function searchPlaces(
  places: SearchablePlace[],
  query: string,
  options?: { municipalityId?: string | null; limit?: number },
): RankedPlace[] {
  const q = normalizePlaceName(query);
  if (q.length < 2) return [];

  const limit = options?.limit ?? 10;
  const municipalityId = options?.municipalityId;

  const results: RankedPlace[] = [];

  for (const place of places) {
    if (municipalityId) {
      if (place.municipalityId !== municipalityId) {
        continue;
      }
    }

    const score = scorePlace(q, place);
    if (score > 0) {
      results.push({ ...place, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}
