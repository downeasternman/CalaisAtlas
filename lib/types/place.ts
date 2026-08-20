export type PlaceType = "municipality" | "water" | "populated_place" | "landmark";

export interface Place {
  id: string;
  name: string;
  nameNormalized: string;
  placeType: PlaceType;
  municipalityId: string | null;
  rank: number;
  sourceId: string | null;
}

export interface PlaceSearchResult extends Place {
  score: number;
}
