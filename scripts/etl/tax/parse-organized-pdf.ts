/**
 * Parse organized-town commitment PDF for one municipality.
 */
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { parseCommitmentText } from "@/lib/tax/commitment-parser";
import { getOrganizedTown } from "@/lib/tax/organized-municipalities";
import { ensureDirs, todayIsoDate, writeJson } from "../paths";
import { requireTownArg } from "./cli";
import {
  organizedBatchesJson,
  organizedCommitmentPdf,
  organizedTaxRecordsJson,
  TAX_PROCESSED_DIR,
} from "./paths";

async function main() {
  const townId = requireTownArg();
  const town = await getOrganizedTown(townId);
  if (!town) {
    throw new Error(`Unknown organized town: ${townId}`);
  }

  const pdfPath = organizedCommitmentPdf(townId);
  const buffer = await readFile(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();

  const text = parsed.text ?? "";
  console.log(`  extracted ${text.length} characters from ${parsed.pages?.length ?? "?"} pages`);

  const rows = parseCommitmentText(text, town.geocode, town.taxYear, {
    layout: town.commitmentLayout ?? "by-name",
  });
  const batchId = `org-batch-${townId}-${todayIsoDate()}`;
  const sourceId = `org-${townId}-commitment-${town.taxYear ?? "unknown"}`;

  const taxRecords = rows.map((row, index) => ({
    id: `${townId}-tax-${index + 1}`,
    batchId,
    municipalityId: townId,
    municipalityName: town.name,
    externalKey: row.mapJoinKey,
    mapJoinKey: row.mapJoinKey,
    accountNumber: row.accountNumber,
    ownerName: row.ownerName,
    mapLot: row.mapLot,
    mailAddress: row.mailAddress,
    assessedLandValue: row.assessedLandValue,
    assessedBuildingValue: row.assessedBuildingValue,
    assessedTotalValue: row.assessedTotalValue,
    assessedExemptionValue: row.assessedExemptionValue,
    taxAmount: row.taxAmount,
    taxAcreage: row.taxAcreage,
    hasTreeGrowth: row.hasTreeGrowth,
    taxYear: row.taxYear,
    parseConfidence: row.parseConfidence,
    attrsRaw: row.attrsRaw,
    geomParcelId: null,
  }));

  const byAccount = new Map<string, string[]>();
  for (const record of taxRecords) {
    const account = record.accountNumber ?? "";
    if (!account) continue;
    const lots = byAccount.get(account) ?? [];
    lots.push(record.mapLot ?? "");
    byAccount.set(account, lots);
  }
  let multiLotAccounts = 0;
  let multiSheetAccounts = 0;
  let millCheckFailures = 0;
  for (const lots of byAccount.values()) {
    if (lots.length > 1) {
      multiLotAccounts += 1;
      const sheets = new Set(lots.map((lot) => lot.split("-")[0] ?? lot));
      if (sheets.size > 1) multiSheetAccounts += 1;
    }
  }
  for (const record of taxRecords) {
    const check = (record.attrsRaw as { taxMillCheck?: { ok?: boolean } } | null)
      ?.taxMillCheck;
    if (check && check.ok === false) millCheckFailures += 1;
  }

  const batches = [
    {
      id: batchId,
      territoryType: "organized" as const,
      municipalityId: townId,
      sourceId,
      parserId: "mrs-commitment-book-v3",
      asOfDate: town.asOfDate,
      filePaths: [pdfPath],
      stats: {
        recordsParsed: taxRecords.length,
        recordsJoined: 0,
        recordsFailed: 0,
        parseConfidenceAvg:
          taxRecords.length > 0
            ? taxRecords.reduce((sum, r) => sum + (r.parseConfidence ?? 0), 0) /
              taxRecords.length
            : null,
        multiLotAccounts,
        multiSheetAccounts,
        millCheckFailures,
      },
      createdAt: new Date().toISOString(),
    },
  ];

  await ensureDirs(TAX_PROCESSED_DIR, `${TAX_PROCESSED_DIR}/organized`);
  await writeJson(organizedTaxRecordsJson(townId), taxRecords);
  await writeJson(organizedBatchesJson(townId), batches);

  console.log(`  ${taxRecords.length} tax rows parsed for ${town.name}`);
  console.log(
    `  multi-lot accounts: ${multiLotAccounts} (multi-sheet: ${multiSheetAccounts}); mill-check failures: ${millCheckFailures}`,
  );
  console.log(`  wrote ${organizedTaxRecordsJson(townId)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
