export type UnifiedSearchResult =
  | {
      kind: "place";
      id: string;
      name: string;
      placeType: string;
      municipalityId: string | null;
      score: number;
      centroid: [number, number];
      bbox: [number, number, number, number] | null;
    }
  | {
      kind: "parcel";
      id: string;
      label: string;
      subtitle: string;
      mapLot: string | null;
      ownerName: string | null;
      situsAddress: string | null;
      score: number;
    };
