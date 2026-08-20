export interface Municipality {
  id: string;
  name: string;
  geoid: string | null;
  isOrganized: boolean;
  sourceId: string | null;
}

export interface MunicipalityWithCoverage extends Municipality {
  coverage: {
    hasParcelGeometry: boolean;
    hasOwnership: boolean;
    hasTaxAssessment: boolean;
    parcelCount: number;
    taxParseRate: number | null;
    notes: string | null;
  };
}
