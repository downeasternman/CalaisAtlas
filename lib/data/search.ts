import { loadPlaces, getPlacesLoadStatus } from "./places";
import { loadParcelSearchIndex, getParcelSearchLoadStatus } from "./parcel-search";
import { searchPlaces } from "@/lib/search/rank";
import { searchParcels } from "@/lib/search/parcel-rank";
import type { UnifiedSearchResult } from "@/lib/types/search";

export type { UnifiedSearchResult };

export async function unifiedSearch(
  query: string,
  options?: { limitPerType?: number },
): Promise<{ places: UnifiedSearchResult[]; parcels: UnifiedSearchResult[] }> {
  const limit = options?.limitPerType ?? 5;

  const [placesStatus, parcelStatus] = await Promise.all([
    getPlacesLoadStatus(),
    getParcelSearchLoadStatus(),
  ]);

  if (placesStatus.state === "missing" && parcelStatus.state === "missing") {
    throw new Error("SEARCH_INDEX_MISSING");
  }

  const places =
    placesStatus.state === "ok"
      ? (
          await searchPlaces(await loadPlaces(), query, {
            municipalityId: "calais",
            limit,
          })
        ).map((place) => ({
          kind: "place" as const,
          id: place.id,
          name: place.name,
          placeType: place.placeType,
          municipalityId: place.municipalityId,
          score: place.score,
          centroid: place.centroid,
          bbox: place.bbox,
        }))
      : [];

  const parcels =
    parcelStatus.state === "ok"
      ? (await searchParcels(await loadParcelSearchIndex(), query, { limit })).map(
          (parcel) => ({
            kind: "parcel" as const,
            id: parcel.id,
            label: parcel.label,
            subtitle: parcel.subtitle,
            mapLot: parcel.mapLot,
            ownerName: parcel.ownerName,
            situsAddress: parcel.situsAddress,
            score: parcel.score,
          }),
        )
      : [];

  return { places, parcels };
}

export async function getSearchAvailability(): Promise<{
  places: ReturnType<typeof getPlacesLoadStatus> extends Promise<infer T> ? T : never;
  parcels: ReturnType<typeof getParcelSearchLoadStatus> extends Promise<infer T> ? T : never;
}> {
  const [places, parcels] = await Promise.all([
    getPlacesLoadStatus(),
    getParcelSearchLoadStatus(),
  ]);
  return { places, parcels };
}
