import { normalizePlaceName } from "@/lib/geo/normalize";
import type { Parcel } from "@/lib/types/parcel";

export interface SearchableParcel {
  id: string;
  label: string;
  subtitle: string;
  ownerNameNormalized: string | null;
  situsNormalized: string | null;
  mapLotNormalized: string | null;
  accountNormalized: string | null;
  municipalityId: string;
  mapLot: string | null;
  ownerName: string | null;
  situsAddress: string | null;
  accountNumber: string | null;
  rank: number;
}

export interface RankedParcel extends SearchableParcel {
  score: number;
}

function normalizeField(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizePlaceName(value);
  return normalized || null;
}

function normalizeMapLot(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, "").toUpperCase();
}

function normalizeAccount(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, "").toUpperCase();
}

export function buildParcelSearchIndex(parcels: Parcel[]): SearchableParcel[] {
  const index: SearchableParcel[] = [];

  for (const parcel of parcels) {
    const ownerNorm = normalizeField(parcel.ownerNameNormalized ?? parcel.ownerName);
    const situsNorm = normalizeField(parcel.situsAddress);
    const mapLotNorm = normalizeMapLot(parcel.mapLot);
    const accountNorm = normalizeAccount(parcel.accountNumber);

    if (!ownerNorm && !situsNorm && !mapLotNorm && !accountNorm) continue;

    const label =
      parcel.situsAddress?.trim() ||
      parcel.ownerName?.trim() ||
      parcel.mapLot?.trim() ||
      parcel.id;

    const subtitleParts = [
      parcel.mapLot,
      parcel.ownerName && parcel.ownerName !== label ? parcel.ownerName : null,
      parcel.accountNumber,
    ].filter(Boolean);

    index.push({
      id: parcel.id,
      label,
      subtitle: subtitleParts.join(" · "),
      ownerNameNormalized: ownerNorm,
      situsNormalized: situsNorm,
      mapLotNormalized: mapLotNorm,
      accountNormalized: accountNorm,
      municipalityId: parcel.municipalityId ?? "calais",
      mapLot: parcel.mapLot,
      ownerName: parcel.ownerName,
      situsAddress: parcel.situsAddress,
      accountNumber: parcel.accountNumber,
      rank: 0,
    });
  }

  return index;
}

export function scoreParcel(
  queryNormalized: string,
  queryMapLot: string | null,
  queryAccount: string | null,
  parcel: SearchableParcel,
): number {
  if (!queryNormalized) return 0;

  if (queryAccount && parcel.accountNormalized === queryAccount) {
    return 100 + parcel.rank;
  }

  if (queryMapLot && parcel.mapLotNormalized === queryMapLot) {
    return 95 + parcel.rank;
  }

  if (queryMapLot && parcel.mapLotNormalized?.startsWith(queryMapLot)) {
    return 85 + parcel.rank;
  }

  if (parcel.situsNormalized === queryNormalized) {
    return 75 + parcel.rank;
  }

  if (parcel.ownerNameNormalized === queryNormalized) {
    return 80 + parcel.rank;
  }

  if (parcel.situsNormalized?.includes(queryNormalized)) {
    return 55 + parcel.rank;
  }

  if (parcel.ownerNameNormalized?.includes(queryNormalized)) {
    return 60 + parcel.rank;
  }

  if (parcel.mapLotNormalized?.includes(queryMapLot ?? queryNormalized)) {
    return 50 + parcel.rank;
  }

  const tokens = queryNormalized.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    const haystacks = [parcel.ownerNameNormalized, parcel.situsNormalized].filter(Boolean);
    for (const haystack of haystacks) {
      if (tokens.every((token) => haystack!.includes(token))) {
        return 40 + parcel.rank;
      }
    }
  }

  return 0;
}

export function searchParcels(
  parcels: SearchableParcel[],
  query: string,
  options?: { limit?: number },
): RankedParcel[] {
  const q = normalizePlaceName(query);
  if (q.length < 2) return [];

  const mapLotQuery = normalizeMapLot(query);
  const accountQuery = normalizeAccount(query);
  const limit = options?.limit ?? 10;
  const results: RankedParcel[] = [];

  for (const parcel of parcels) {
    const score = scoreParcel(q, mapLotQuery, accountQuery, parcel);
    if (score > 0) {
      results.push({ ...parcel, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}
