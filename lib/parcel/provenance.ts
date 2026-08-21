import type { ParcelWithSources } from "@/lib/types/parcel";
import { scoreToLevel } from "@/lib/tax/confidence";

export type ParcelWarning = {
  code: string;
  message: string;
  severity: "info" | "warn";
};

export function getParcelWarnings(parcel: ParcelWithSources): ParcelWarning[] {
  const warnings: ParcelWarning[] = [];

  if (parcel.joinMethod === "property_card") {
    warnings.push({
      code: "owner_property_card",
      message: "Owner from 2023 property card — verify with City Assessor.",
      severity: "warn",
    });
  }

  if (parcel.joinMethod === "map_lot_parent") {
    warnings.push({
      code: "parent_join",
      message: "Tax record matched via parent map/lot — assessment may belong to a parent parcel.",
      severity: "warn",
    });
  }

  const confidenceLevel = scoreToLevel(parcel.joinConfidence ?? null);
  if (confidenceLevel === "low") {
    warnings.push({
      code: "low_confidence",
      message: "Low-confidence tax join — verify with official records.",
      severity: "warn",
    });
  }

  if (parcel.ownerName && !parcel.assessedTotalValue) {
    warnings.push({
      code: "owner_without_assessment",
      message: "Owner is known, but assessed values were not joined from the commitment book.",
      severity: "info",
    });
  }

  if (parcel.acreageDiscrepancy) {
    warnings.push({
      code: "acreage_discrepancy",
      message: "GIS acreage and tax-book acreage disagree.",
      severity: "info",
    });
  }

  if (!parcel.ownerName) {
    warnings.push({
      code: "missing_owner",
      message: "Owner not available in current public records.",
      severity: "info",
    });
  }

  if (parcel.likelyPublicOwner && !parcel.bookFullyExempt && !parcel.fullyExempt) {
    warnings.push({
      code: "likely_public_owner",
      message: "Owner appears to be a public or institutional entity; map color uses assessment cohort, not exemption fill.",
      severity: "info",
    });
  }

  return warnings;
}
