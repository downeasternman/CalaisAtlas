import { slugify } from "@/lib/geo/slug";
import type { MapIndexRow } from "./map-index-parser";
import { mailMunicipalityHintFromAddress } from "./mail-municipality";
import type { ParsedUtTaxRow } from "./ut-parser";

export type JoinMethod =
  | "map_lot"
  | "map_lot_parent"
  | "property_id"
  | "plat_crosswalk"
  | "unjoined";

export interface MapSheetEntry {
  mapCode: string;
  divisionName: string;
  geometryMunicipalityIds: string[];
  taxMunicipalityIds: string[];
  notes: string | null;
}

export interface CrosswalkValidation {
  taxRecordCount: number;
  indexRowCount: number;
  taxWithPropertyId: number;
  taxMatchedInIndex: number;
  taxOrphanPropertyIds: string[];
  matchRate: number;
}

export function validateTaxAgainstIndex(
  taxRows: Array<ParsedUtTaxRow & { id: string }>,
  indexByPropertyId: Map<string, MapIndexRow[]>,
): CrosswalkValidation {
  const orphans: string[] = [];
  let matched = 0;
  let withPid = 0;

  for (const row of taxRows) {
    if (!row.propertyId) continue;
    withPid++;
    const indexRows = indexByPropertyId.get(row.propertyId.replace(/P$/i, "").toUpperCase());
    if (!indexRows?.length) {
      orphans.push(row.propertyId);
      continue;
    }
    const indexKeys = new Set(
      indexRows.map((r) => r.mapJoinKey?.toUpperCase()).filter(Boolean),
    );
    if (indexKeys.has(row.mapJoinKey.toUpperCase())) matched++;
    else if (indexRows.some((r) => r.propertyId === row.propertyId)) matched++;
  }

  return {
    taxRecordCount: taxRows.length,
    indexRowCount: indexByPropertyId.size,
    taxWithPropertyId: withPid,
    taxMatchedInIndex: matched,
    taxOrphanPropertyIds: [...new Set(orphans)].slice(0, 20),
    matchRate: withPid > 0 ? matched / withPid : 0,
  };
}

export function resolveTaxMunicipalityId(
  tax: ParsedUtTaxRow | null,
  mapSheets: Record<string, MapSheetEntry>,
): string | null {
  if (!tax) return null;

  const fromMail = mailMunicipalityHintFromAddress(tax.mailAddress);
  if (fromMail) return fromMail;

  const sheet = mapSheets[tax.mapCode];
  if (sheet?.taxMunicipalityIds[0]) return sheet.taxMunicipalityIds[0];

  if (tax.divisionName) {
    return slugify(tax.divisionName.replace(/\s+Township$/i, " Twp"));
  }

  return null;
}

export function divisionToMunicipalityId(divisionName: string | null): string | null {
  if (!divisionName) return null;
  const n = divisionName.trim();
  if (/township$/i.test(n)) return slugify(n.replace(/\s+Township$/i, " Twp"));
  if (/division$/i.test(n)) return slugify(n);
  if (/plantation$/i.test(n)) return slugify(n.replace(/\s+Plantation$/i, " Plt"));
  return slugify(n);
}
