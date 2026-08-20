/**
 * Register and download Maine Revenue Services UT PDFs for Washington County.
 */
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  TAX_RAW_UT_DIR,
  UT_MAP_LOT_INDEX_PDF,
  UT_MAP_LOT_INDEX_URL,
  UT_VALUATION_BOOK_URL,
  UT_VALUATION_PDF,
} from "./paths";
import { ensureDirs, todayIsoDate } from "../paths";

async function downloadFile(url: string, dest: string) {
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed ${res.status} for ${url}`);
  }
  if (!res.body) {
    throw new Error(`No response body for ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  console.log(`  wrote ${dest}`);
}

async function main() {
  await ensureDirs(TAX_RAW_UT_DIR);
  console.log("Downloading Washington County UT tax PDFs...");
  await downloadFile(UT_VALUATION_BOOK_URL, UT_VALUATION_PDF);
  await downloadFile(UT_MAP_LOT_INDEX_URL, UT_MAP_LOT_INDEX_PDF);
  console.log(`Done (${todayIsoDate()}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
