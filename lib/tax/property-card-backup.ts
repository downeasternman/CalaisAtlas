/**
 * Apply 2023 property-card owners onto parcels that still lack a valid owner.
 * Exact map-lot match only; never overwrites; skips ambiguous lots.
 */
import type { JoinMethod } from "./crosswalk";
import { hasValidOwner } from "./owner-validate";
import type { ParsedPropertyCard } from "./property-card-parser";

export const PROPERTY_CARD_SOURCE_ID = "org-calais-property-cards-2023";
export const PROPERTY_CARD_JOIN_CONFIDENCE = 0.35;

export interface PropertyCardBackupTarget {
  id: string;
  mapLot: string | null;
  ownerName: string | null;
  ownerNameNormalized?: string | null;
  accountNumber?: string | null;
  joinMethod?: string | null;
  joinConfidence?: number | null;
  taxSourceId?: string | null;
  attrsRaw?: Record<string, unknown> | null;
}

export function buildPropertyCardLotIndex(
  cards: ParsedPropertyCard[],
): {
  byLot: Map<string, ParsedPropertyCard>;
  collisions: string[];
} {
  const grouped = new Map<string, ParsedPropertyCard[]>();
  for (const card of cards) {
    if (!card.mapLot || !card.ownerName) continue;
    const list = grouped.get(card.mapLot) ?? [];
    list.push(card);
    grouped.set(card.mapLot, list);
  }

  const byLot = new Map<string, ParsedPropertyCard>();
  const collisions: string[] = [];
  for (const [lot, list] of grouped) {
    const owners = new Set(list.map((c) => c.ownerName!.toUpperCase()));
    if (owners.size > 1) {
      collisions.push(lot);
      continue;
    }
    byLot.set(lot, list[0]!);
  }
  return { byLot, collisions };
}

export function applyPropertyCardOwnerBackup<T extends PropertyCardBackupTarget>(
  parcels: T[],
  cards: ParsedPropertyCard[],
): { parcels: T[]; filled: number; skippedCollisions: number; eligible: number } {
  const { byLot, collisions } = buildPropertyCardLotIndex(cards);
  const collisionSet = new Set(collisions);
  let filled = 0;
  let eligible = 0;

  const next = parcels.map((parcel) => {
    if (hasValidOwner(parcel)) return parcel;
    const lot = parcel.mapLot;
    if (!lot) return parcel;
    eligible += 1;
    if (collisionSet.has(lot)) return parcel;
    const card = byLot.get(lot);
    if (!card?.ownerName) return parcel;

    filled += 1;
    const attrsRaw = {
      ...(parcel.attrsRaw && typeof parcel.attrsRaw === "object" ? parcel.attrsRaw : {}),
      ownerBackup: "property_card_2023",
      propertyCardAsOf: card.asOfDate,
      propertyCardAccount: card.accountNumber,
      propertyCardMapLotRaw: card.mapLotRaw,
    };

    return {
      ...parcel,
      ownerName: card.ownerName,
      ownerNameNormalized: card.ownerName.toLowerCase(),
      accountNumber: parcel.accountNumber ?? card.accountNumber,
      joinMethod: "property_card" as JoinMethod,
      joinConfidence: PROPERTY_CARD_JOIN_CONFIDENCE,
      taxSourceId: PROPERTY_CARD_SOURCE_ID,
      attrsRaw,
    };
  });

  return {
    parcels: next,
    filled,
    skippedCollisions: collisions.length,
    eligible,
  };
}
