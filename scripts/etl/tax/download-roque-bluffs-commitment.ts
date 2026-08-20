/**
 * Download Roque Bluffs commitment PDF (2025 primary, 2024 fallback).
 */
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { PDFParse } from "pdf-parse";
import { ensureDirs, writeJson } from "../paths";
import { organizedCommitmentPdf, organizedRawDir, TAX_PROCESSED_DIR } from "./paths";

const PRIMARY_URL =
  "https://roquebluffsmaine.us/wp-content/uploads/2026/05/2025-Tax-Commitment-Book.pdf";
const FALLBACK_URL =
  "https://roquebluffsmaine.us/wp-content/uploads/2025/02/2024-Tax-Commitment.pdf";
const MIN_TEXT_CHARS = 1000;

async function downloadFile(url: string, dest: string) {
  console.log(`  downloading ${url}`);
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!res.ok) {
    throw new Error(`Download failed ${res.status} for ${url}`);
  }
  if (!res.body) {
    throw new Error(`No response body for ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  console.log(`  wrote ${dest}`);
}

async function pdfTextCharCount(pdfPath: string): Promise<number> {
  const buffer = await readFile(pdfPath);
  if (buffer.slice(0, 4).toString() !== "%PDF") {
    return 0;
  }
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return (parsed.text ?? "").length;
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const townId = "roque-bluffs";
  const dest = organizedCommitmentPdf(townId);
  await ensureDirs(organizedRawDir(townId));

  let yearUsed = 2025;
  let urlUsed = PRIMARY_URL;
  try {
    await downloadFile(PRIMARY_URL, dest);
    const chars = await pdfTextCharCount(dest);
    console.log(`  2025 text chars: ${chars}`);
    if (chars < MIN_TEXT_CHARS) {
      throw new Error(`2025 PDF text too short (${chars} chars)`);
    }
  } catch (err) {
    console.warn(`  2025 primary failed: ${err instanceof Error ? err.message : err}`);
    console.warn("  falling back to 2024 commitment PDF");
    await downloadFile(FALLBACK_URL, dest);
    const chars = await pdfTextCharCount(dest);
    console.log(`  2024 text chars: ${chars}`);
    if (chars < MIN_TEXT_CHARS) {
      throw new Error(`2024 fallback PDF text too short (${chars} chars)`);
    }
    yearUsed = 2024;
    urlUsed = FALLBACK_URL;
  }

  await ensureDirs(`${TAX_PROCESSED_DIR}/organized`);
  await writeJson(`${TAX_PROCESSED_DIR}/organized/roque-bluffs-commitment-meta.json`, {
    municipalityId: townId,
    yearUsed,
    urlUsed,
    downloadedAt: new Date().toISOString(),
  });
  console.log(`Done (Roque Bluffs commitment year ${yearUsed}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
