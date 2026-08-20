/**
 * Parse 2024 Washington County Map/Lot Index PDF into crosswalk JSON.
 */
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { buildIndexLookups, parseMapLotIndexText } from "@/lib/tax/map-index-parser";
import { ensureDirs, todayIsoDate, writeJson } from "../paths";
import { TAX_PROCESSED_DIR, UT_MAP_LOT_INDEX_JSON, UT_MAP_LOT_INDEX_PDF } from "./paths";

async function main() {
  await ensureDirs(TAX_PROCESSED_DIR);

  console.log("Parsing Map/Lot Index PDF...");
  const buffer = await readFile(UT_MAP_LOT_INDEX_PDF);
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  await parser.destroy();

  const rows = parseMapLotIndexText(textResult.text);
  const lookups = buildIndexLookups(rows);

  console.log(`  ${rows.length} index rows parsed`);
  console.log(`  ${lookups.byPropertyId.size} unique property IDs`);
  console.log(`  ${lookups.byMapJoinKey.size} unique map join keys`);

  await writeJson(UT_MAP_LOT_INDEX_JSON, {
    asOfDate: "2024-01-01",
    parsedAt: todayIsoDate(),
    sourceId: "mrs-ut-map-lot-index-2024",
    rowCount: rows.length,
    rows,
  });

  console.log(`  wrote ${UT_MAP_LOT_INDEX_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
