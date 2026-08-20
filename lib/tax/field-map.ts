/**
 * Maps parsed tax record field names to parcel schema columns.
 * Parser-specific keys are normalized here before DB insert.
 */
export const TAX_FIELD_MAP: Record<string, string> = {
  owner: "ownerName",
  owner_name: "ownerName",
  ownerName: "ownerName",
  map_lot: "mapLot",
  mapLot: "mapLot",
  situs: "situsAddress",
  situs_address: "situsAddress",
  situsAddress: "situsAddress",
  mail_address: "mailAddress",
  mailAddress: "mailAddress",
  assessed_land: "assessedLandValue",
  assessedLandValue: "assessedLandValue",
  assessed_building: "assessedBuildingValue",
  assessedBuildingValue: "assessedBuildingValue",
  assessed_total: "assessedTotalValue",
  assessedTotalValue: "assessedTotalValue",
  tax_year: "taxYear",
  taxYear: "taxYear",
  acreage: "acreage",
  land_use: "landUse",
  landUse: "landUse",
};

export function mapTaxField(rawKey: string): string | null {
  return TAX_FIELD_MAP[rawKey] ?? null;
}
