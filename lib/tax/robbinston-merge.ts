/**
 * Merge Robbinston owner index with date-ranked transfer overrides.
 */
import type { ParsedCommitmentRow } from "./commitment-parser";
import type { RobbinstonIndexRow } from "./robbinston-index-parser";
import {
  rankTransfersByDate,
  type RobbinstonTransferRow,
} from "./robbinston-transfers-parser";

export interface RobbinstonMergeAudit {
  indexRows: number;
  transferRows: number;
  transferWinners: number;
  transferOverrides: number;
  transferAlreadyMatchesIndex: number;
  finalRows: number;
}

export interface RobbinstonMergedRecord extends ParsedCommitmentRow {
  ownershipSource: "index" | "transfer";
  transferDate: string | null;
  transferSourceLabel: string | null;
}

function namesRoughlyMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 24);
  const na = norm(a);
  const nb = norm(b);
  return na.includes(nb.slice(0, 12)) || nb.includes(na.slice(0, 12));
}

export function mergeRobbinstonOwnership(
  indexRows: RobbinstonIndexRow[],
  transfers: RobbinstonTransferRow[],
  taxYear: number | null,
): { records: RobbinstonMergedRecord[]; audit: RobbinstonMergeAudit } {
  const winners = rankTransfersByDate(transfers);
  const byKey = new Map<string, RobbinstonMergedRecord>();

  let transferOverrides = 0;
  let transferAlreadyMatchesIndex = 0;

  for (const row of indexRows) {
    byKey.set(row.mapJoinKey, {
      accountNumber: "",
      mapJoinKey: row.mapJoinKey,
      mapLot: row.mapLot,
      ownerName: row.ownerName,
      mailAddress: null,
      assessedLandValue: null,
      assessedBuildingValue: null,
      assessedTotalValue: null,
      assessedExemptionValue: null,
      hasTreeGrowth: false,
      taxYear,
      parseConfidence: 0.3,
      attrsRaw: {
        ownershipSource: "index",
        map: row.map,
        lot: row.lot,
      },
      ownershipSource: "index",
      transferDate: null,
      transferSourceLabel: null,
    });
  }

  for (const [key, xfer] of winners) {
    const existing = byKey.get(key);
    if (existing) {
      if (namesRoughlyMatch(existing.ownerName ?? "", xfer.ownerName)) {
        transferAlreadyMatchesIndex += 1;
        existing.attrsRaw = {
          ...existing.attrsRaw,
          transferConfirmed: true,
          transferDate: xfer.transferDate,
          transferSourceLabel: xfer.sourceLabel,
        };
      } else {
        transferOverrides += 1;
        const priorOwner = existing.ownerName;
        existing.ownerName = xfer.ownerName;
        existing.ownershipSource = "transfer";
        existing.transferDate = xfer.transferDate;
        existing.transferSourceLabel = xfer.sourceLabel;
        existing.attrsRaw = {
          ...existing.attrsRaw,
          ownershipSource: "transfer",
          priorIndexOwner: priorOwner,
          transferDate: xfer.transferDate,
          transferSourceLabel: xfer.sourceLabel,
          grantorName: xfer.grantorName,
        };
      }
    } else {
      transferOverrides += 1;
      byKey.set(key, {
        accountNumber: "",
        mapJoinKey: xfer.mapJoinKey,
        mapLot: xfer.mapLot,
        ownerName: xfer.ownerName,
        mailAddress: null,
        assessedLandValue: null,
        assessedBuildingValue: null,
        assessedTotalValue: null,
        assessedExemptionValue: null,
        hasTreeGrowth: false,
        taxYear,
        parseConfidence: 0.3,
        attrsRaw: {
          ownershipSource: "transfer",
          map: xfer.map,
          lot: xfer.lot,
          transferDate: xfer.transferDate,
          transferSourceLabel: xfer.sourceLabel,
          grantorName: xfer.grantorName,
        },
        ownershipSource: "transfer",
        transferDate: xfer.transferDate,
        transferSourceLabel: xfer.sourceLabel,
      });
    }
  }

  const records = [...byKey.values()];
  return {
    records,
    audit: {
      indexRows: indexRows.length,
      transferRows: transfers.length,
      transferWinners: winners.size,
      transferOverrides,
      transferAlreadyMatchesIndex,
      finalRows: records.length,
    },
  };
}
