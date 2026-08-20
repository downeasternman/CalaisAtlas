/**
 * Download organized-town commitment PDF for one municipality.
 */
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { getOrganizedTown } from "@/lib/tax/organized-municipalities";
import { ensureDirs } from "../paths";
import { requireTownArg } from "./cli";
import { organizedCommitmentPdf, organizedRawDir } from "./paths";

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
  const townId = requireTownArg();
  const town = await getOrganizedTown(townId);
  if (!town) {
    throw new Error(`Unknown organized town: ${townId}`);
  }
  const url = town.sources.commitmentPdfUrl;
  if (!url) {
    throw new Error(`No commitmentPdfUrl configured for ${townId}`);
  }

  await ensureDirs(organizedRawDir(townId));
  await downloadFile(url, organizedCommitmentPdf(townId));
  console.log(`Done (${town.name}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
