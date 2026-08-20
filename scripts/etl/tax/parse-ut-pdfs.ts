/**
 * Parse Washington County UT valuation PDF into tax_records JSON.
 */
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { parseUtValuationText } from "@/lib/tax/ut-parser";
import { ensureDirs, todayIsoDate, writeJson } from "../paths";
import {
  TAX_PROCESSED_DIR,
  UT_BATCHES_JSON,
  UT_TAX_RECORDS_JSON,
  UT_VALUATION_PDF,
} from "./paths";

async function main() {
  await ensureDirs(TAX_PROCESSED_DIR);

  console.log("Parsing UT valuation PDF...");
  const buffer = await readFile(UT_VALUATION_PDF);
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  await parser.destroy();
  const text = textResult.text;
  console.log(`  extracted ${text.length} characters from ${textResult.pages.length} pages`);

  const taxYear = 2025;
  const parsedRows = parseUtValuationText(text, taxYear);
  console.log(`  ${parsedRows.length} tax rows parsed`);

  const batchId = `ut-batch-${todayIsoDate()}`;
  const records = parsedRows.map((row) => ({
    id: randomUUID(),
    batchId,
    municipalityId: row.mailMunicipalityHint,
    municipalityName: row.divisionName,
    externalKey: row.mapJoinKey,
    mapJoinKey: row.mapJoinKey,
    propertyId: row.propertyId,
    mailMunicipalityHint: row.mailMunicipalityHint,
    ownerName: row.ownerName,
    mapLot: row.mapLot,
    situsAddress: null,
    mailAddress: row.mailAddress,
    assessedLandValue: row.assessedLandValue,
    assessedBuildingValue: row.assessedBuildingValue,
    assessedTotalValue: row.assessedTotalValue,
    assessedExemptionValue: row.assessedExemptionValue,
    assessedPersonalPropertyValue: row.assessedPersonalPropertyValue,
    taxAmount: row.taxAmount,
    percentOwnership: row.percentOwnership,
    accountNumber: row.accountNumber,
    taxAcreage: row.acreage,
    taxYear: row.taxYear,
    attrsRaw: row.attrsRaw,
    parseConfidence: row.parseConfidence,
    geomParcelId: null,
  }));

  const batch = {
    id: batchId,
    territoryType: "ut" as const,
    municipalityId: null,
    sourceId: "mrs-ut-valuation-2025",
    parserId: "mrs-washington-valuation-2025",
    asOfDate: "2025-01-01",
    filePaths: [UT_VALUATION_PDF],
    stats: {
      recordsParsed: records.length,
      recordsJoined: 0,
      recordsFailed: 0,
      parseConfidenceAvg:
        records.length > 0
          ? records.reduce((s, r) => s + (r.parseConfidence ?? 0), 0) / records.length
          : null,
    },
    createdAt: new Date().toISOString(),
  };

  await writeJson(UT_TAX_RECORDS_JSON, records);
  await writeJson(UT_BATCHES_JSON, [batch]);

  console.log(`  wrote ${UT_TAX_RECORDS_JSON}`);
  console.log(`  wrote ${UT_BATCHES_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
