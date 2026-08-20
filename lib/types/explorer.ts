export type MapFlyTarget = {
  key: string;
  bounds?: [[number, number], [number, number]];
  center?: [number, number];
  zoom?: number;
};

export type PlaceSearchResult = {
  id: string;
  name: string;
  placeType: string;
  municipalityId: string | null;
  score: number;
  centroid: [number, number];
  bbox: [number, number, number, number] | null;
};

export type MunicipalityOption = {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  coverage: {
    hasOwnership: boolean;
    hasTaxAssessment: boolean;
    notes: string | null;
  };
};
