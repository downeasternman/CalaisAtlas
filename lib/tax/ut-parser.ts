import { normalizeExemptionValue } from "./exemption";
import { mapJoinKey } from "./plan-lot";
import { mailMunicipalityHintFromAddress } from "./mail-municipality";

export type ValuationAllocation = "single_lot" | "copied_full_assessment";

export interface ParsedUtTaxRow {
  mapJoinKey: string;
  mapCode: string;
  mapLot: string;
  municipalityName: string | null;
  divisionName: string | null;
  ownerName: string | null;
  mailAddress: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  assessedExemptionValue: string | null;
  assessedPersonalPropertyValue: string | null;
  taxAmount: string | null;
  percentOwnership: string | null;
  accountNumber: string | null;
  acreage: string | null;
  taxYear: number | null;
  propertyId: string | null;
  mailMunicipalityHint: string | null;
  parseConfidence: number;
  attrsRaw: Record<string, unknown>;
}

const PROPERTY_SPLIT_RE = /Property ID:\s*(\d+)/g;

function cleanMoney(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/,/g, "").trim() || null;
}

function extractOwner(block: string): { ownerName: string | null; mailAddress: string | null } {
  const match = block.match(/Tax\s+[\d,.]+\s*\n([\s\S]*?)\nWashington\s*\n/i);
  if (!match) return { ownerName: null, mailAddress: null };

  const lines = match[1]
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { ownerName: null, mailAddress: null };

  const ownerName = lines[0] ?? null;
  const mailAddress = lines.length > 1 ? lines.slice(1).join(", ") : null;
  return { ownerName, mailAddress };
}

function parseMapLots(
  mapCode: string,
  plan: string,
  lotPart: string,
): Array<{ mapJoinKey: string; mapLot: string }> {
  const lots = lotPart.trim().split(/\s+/).filter(Boolean);
  return lots.map((lot) => {
    const mapLot = `${plan.padStart(2, "0")}-${lot}`;
    return {
      mapJoinKey: mapJoinKey(mapCode, plan, lot),
      mapLot,
    };
  });
}

/**
 * Parse MRS 2025 taxpayer valuation PDF text (block format per property).
 */
export function parseUtValuationText(
  text: string,
  defaultTaxYear: number | null = null,
): ParsedUtTaxRow[] {
  const rows: ParsedUtTaxRow[] = [];
  const parts = text.split(PROPERTY_SPLIT_RE);

  // split leaves: [preamble, id1, block1, id2, block2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const propertyId = parts[i];
    const block = parts[i + 1] ?? "";
    if (!block.trim()) continue;

    const land = cleanMoney(block.match(/Land Value\s+([\d,]+(?:\.\d{2})?)/)?.[1]);
    const building = cleanMoney(block.match(/Building Value\s+([\d,]+(?:\.\d{2})?)/)?.[1]);
    const taxable = cleanMoney(block.match(/Taxable Value\s+([\d,]+(?:\.\d{2})?)/)?.[1]);
    const exemptions = cleanMoney(
      block.match(/Total Exemptions\s+([\d,]+(?:\.\d{2})?)/)?.[1],
    );
    const assessedExemptionValue = normalizeExemptionValue(exemptions);
    const acres = cleanMoney(block.match(/Acres\s+([\d,]+(?:\.\d{2})?)/)?.[1]);
    const personalProperty = cleanMoney(
      block.match(/Personal Property\s+([\d,]+(?:\.\d{2})?)/)?.[1],
    );
    const taxAmount = cleanMoney(
      block.match(/Taxable Value\s+[\d,]+(?:\.\d{2})?\s*\nTax\s+([\d,]+(?:\.\d{2})?)/i)?.[1],
    );
    const percentOwnership = cleanMoney(
      block.match(/Percent Ownership:\s*([\d,]+(?:\.\d+)?)\s*%/i)?.[1],
    );
    const accountNumber =
      block.match(/Account ID:\s*([\d]+-[\d]+)/i)?.[1]?.trim() ?? null;
    const divisionName =
      block.match(/\nWashington\s*\n([^\n]+)\nMAP/i)?.[1]?.trim() ?? null;

    const mapMatch = block.match(/MAP\s+(WA\d{3})\s+PLAN\s+(\d+)\s+LOT\s+([^\n]+)/i);
    if (!mapMatch) continue;

    const { ownerName, mailAddress } = extractOwner(block);
    const mapCode = mapMatch[1].toUpperCase();
    const plan = mapMatch[2];
    const lotEntries = parseMapLots(mapCode, plan, mapMatch[3]);
    const siblingMapLots = lotEntries.map((entry) => entry.mapLot);
    const lotCountInGroup = lotEntries.length;
    const valuationAllocation: ValuationAllocation =
      lotCountInGroup > 1 ? "copied_full_assessment" : "single_lot";

    let confidence = 0.75;
    if (land && building && taxable) confidence = 0.9;
    else if (taxable) confidence = 0.82;
    if (!ownerName) confidence -= 0.1;

    for (const lotEntry of lotEntries) {
      rows.push({
        mapJoinKey: lotEntry.mapJoinKey,
        mapCode,
        mapLot: lotEntry.mapLot,
        municipalityName: null,
        divisionName,
        ownerName,
        mailAddress,
        assessedLandValue: land,
        assessedBuildingValue: building,
        assessedTotalValue: taxable,
        assessedExemptionValue,
        assessedPersonalPropertyValue: personalProperty,
        taxAmount,
        percentOwnership,
        accountNumber,
        acreage: acres,
        taxYear: defaultTaxYear,
        propertyId,
        mailMunicipalityHint: mailMunicipalityHintFromAddress(mailAddress),
        parseConfidence: Math.max(0.4, confidence),
        attrsRaw: {
          propertyId,
          divisionName,
          mapLine: mapMatch[0],
          valuationAllocation,
          multiLotGroupId: propertyId,
          lotCountInGroup,
          siblingMapLots,
        },
      });
    }
  }

  return dedupeRows(rows);
}

function dedupeRows(rows: ParsedUtTaxRow[]): ParsedUtTaxRow[] {
  const seen = new Map<string, ParsedUtTaxRow>();
  for (const row of rows) {
    const key = `${row.propertyId ?? "unknown"}|${row.mapJoinKey}`;
    const existing = seen.get(key);
    if (!existing || row.parseConfidence > existing.parseConfidence) {
      seen.set(key, row);
    }
  }
  return [...seen.values()];
}
