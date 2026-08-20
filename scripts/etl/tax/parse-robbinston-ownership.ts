/**
 * Parse Robbinston owner index + transfer PDFs into organized tax records.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { getOrganizedTown } from "@/lib/tax/organized-municipalities";
import { parseRobbinstonOwnerIndex } from "@/lib/tax/robbinston-index-parser";
import { mergeRobbinstonOwnership } from "@/lib/tax/robbinston-merge";
import { parseRobbinstonTransfersText } from "@/lib/tax/robbinston-transfers-parser";
import { ensureDirs, todayIsoDate, writeJson } from "../paths";
import {
  ORGANIZED_PARCELS_GEOJSON,
  organizedBatchesJson,
  organizedRawDir,
  organizedTaxRecordsJson,
  TAX_PROCESSED_DIR,
} from "./paths";
import { readJson } from "../paths";

async function pdfToText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();
  return parsed.text ?? "";
}

async function main() {
  const town = await getOrganizedTown("robbinston");
  if (!town) throw new Error("Unknown organized town: robbinston");

  const rawDir = organizedRawDir("robbinston");
  const indexHtml = await readFile(path.join(rawDir, "owner-index.html"), "utf8");
  const transfers2024 = await pdfToText(path.join(rawDir, "transfers-2024-08.pdf"));
  const transfers2425 = await pdfToText(path.join(rawDir, "transfers-24-25.pdf"));

  console.log(`  index HTML chars: ${indexHtml.length}`);
  console.log(`  transfers-2024-08 chars: ${transfers2024.length}`);
  console.log(`  transfers-24-25 chars: ${transfers2425.length}`);

  const index = parseRobbinstonOwnerIndex(indexHtml, town.geocode);
  const xfer2024 = parseRobbinstonTransfersText(
    transfers2024,
    town.geocode,
    "transfers-2024-08",
  );
  const xfer2425 = parseRobbinstonTransfersText(
    transfers2425,
    town.geocode,
    "transfers-24-25",
  );

  const allTransfers = [...xfer2024.rows, ...xfer2425.rows];
  const { records, audit } = mergeRobbinstonOwnership(
    index.rows,
    allTransfers,
    town.taxYear,
  );

  const batchId = `org-batch-robbinston-${todayIsoDate()}`;
  const sourceId = "org-robbinston-owner-index-2025";

  const taxRecords = records.map((row, indexNum) => ({
    id: `robbinston-tax-${indexNum + 1}`,
    batchId,
    municipalityId: "robbinston",
    municipalityName: town.name,
    externalKey: row.mapJoinKey,
    mapJoinKey: row.mapJoinKey,
    accountNumber: row.accountNumber || "",
    ownerName: row.ownerName,
    mapLot: row.mapLot,
    mailAddress: row.mailAddress,
    assessedLandValue: null,
    assessedBuildingValue: null,
    assessedTotalValue: null,
    taxYear: row.taxYear,
    parseConfidence: row.parseConfidence,
    attrsRaw: row.attrsRaw,
    geomParcelId: null,
  }));

  let geometryKeys = new Set<string>();
  try {
    const geojson = await readJson<GeoJSON.FeatureCollection>(ORGANIZED_PARCELS_GEOJSON);
    geometryKeys = new Set(
      geojson.features
        .filter((f) => String(f.properties?.municipalityId ?? "") === "robbinston")
        .map((f) => String(f.properties?.mapJoinKey ?? "").toUpperCase())
        .filter(Boolean),
    );
  } catch {
    geometryKeys = new Set();
  }

  const transferUnmatchedGeometry = allTransfers.filter(
    (t) => !geometryKeys.has(t.mapJoinKey.toUpperCase()),
  ).length;
  const indexUnmatchedGeometry = index.rows.filter(
    (r) => !geometryKeys.has(r.mapJoinKey.toUpperCase()),
  ).length;

  console.log("  audit:", {
    ...audit,
    indexDropped: index.dropped,
    transferDropped2024: xfer2024.dropped,
    transferDropped2425: xfer2425.dropped,
    transferRows2024: xfer2024.rows.length,
    transferRows2425: xfer2425.rows.length,
    transferUnmatchedGeometry,
    indexUnmatchedGeometry,
  });

  const latestTransferDate =
    allTransfers
      .map((t) => t.transferDate)
      .sort()
      .at(-1) ?? town.asOfDate;

  const batches = [
    {
      id: batchId,
      territoryType: "organized" as const,
      municipalityId: "robbinston",
      sourceId,
      parserId: "robbinston-owner-index-v1",
      asOfDate: latestTransferDate,
      filePaths: [
        path.join(rawDir, "owner-index.html"),
        path.join(rawDir, "transfers-2024-08.pdf"),
        path.join(rawDir, "transfers-24-25.pdf"),
      ],
      stats: {
        recordsParsed: taxRecords.length,
        recordsJoined: 0,
        recordsFailed: index.dropped + xfer2024.dropped + xfer2425.dropped,
        parseConfidenceAvg: 0.3,
        transferOverrides: audit.transferOverrides,
        transferAlreadyMatchesIndex: audit.transferAlreadyMatchesIndex,
      },
      createdAt: new Date().toISOString(),
    },
  ];

  await ensureDirs(TAX_PROCESSED_DIR, `${TAX_PROCESSED_DIR}/organized`);
  await writeJson(organizedTaxRecordsJson("robbinston"), taxRecords);
  await writeJson(organizedBatchesJson("robbinston"), batches);
  console.log(`  ${taxRecords.length} ownership rows for Robbinston`);
  console.log(`  wrote ${organizedTaxRecordsJson("robbinston")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
