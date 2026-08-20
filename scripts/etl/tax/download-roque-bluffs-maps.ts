/**
 * Download Roque Bluffs tax map index + sheets; write inventory catalog.
 */
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { PDFParse } from "pdf-parse";
import { ensureDirs, writeJson } from "../paths";
import { organizedRawDir, TAX_PROCESSED_DIR } from "./paths";

const SOURCE_PAGE = "https://roquebluffsmaine.us/assessors/";
const AS_OF_DATE = "2025-01-01";

const MAP_FILES: Array<{ id: string; filename: string; url: string }> = [
  {
    id: "index",
    filename: "tax-map-index.pdf",
    url: "https://roquebluffsmaine.us/wp-content/uploads/2025/01/Tax-Map-Index.pdf",
  },
  ...Array.from({ length: 11 }, (_, i) => {
    const n = i + 1;
    return {
      id: `map-${String(n).padStart(2, "0")}`,
      filename: `tax-map-${String(n).padStart(2, "0")}.pdf`,
      url: `https://roquebluffsmaine.us/wp-content/uploads/2025/01/Tax-Map-${n}.pdf`,
    };
  }),
];

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
}

async function inspectPdf(pdfPath: string): Promise<{
  byteSize: number;
  textCharCount: number;
  pageCount: number | null;
  textExtractable: boolean;
  parseStatus: "image_or_non_tabular" | "text_present";
}> {
  const buffer = await readFile(pdfPath);
  let textCharCount = 0;
  let pageCount: number | null = null;
  try {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    textCharCount = (parsed.text ?? "").trim().length;
    pageCount = parsed.pages?.length ?? null;
  } catch {
    textCharCount = 0;
  }
  const textExtractable = textCharCount >= 100;
  return {
    byteSize: buffer.length,
    textCharCount,
    pageCount,
    textExtractable,
    parseStatus: textExtractable ? "text_present" : "image_or_non_tabular",
  };
}

async function main() {
  const townId = "roque-bluffs";
  const mapsDir = path.join(organizedRawDir(townId), "maps");
  await ensureDirs(mapsDir);

  const files = [];
  for (const map of MAP_FILES) {
    const dest = path.join(mapsDir, map.filename);
    await downloadFile(map.url, dest);
    const info = await inspectPdf(dest);
    console.log(
      `  ${map.filename}: ${info.byteSize} bytes, ${info.textCharCount} chars, ${info.parseStatus}`,
    );
    files.push({
      id: map.id,
      filename: map.filename,
      url: map.url,
      path: dest,
      ...info,
    });
  }

  const catalog = {
    municipalityId: townId,
    sourcePage: SOURCE_PAGE,
    asOfDate: AS_OF_DATE,
    downloadedAt: new Date().toISOString(),
    notes:
      "Visual tax maps/index inventory only. Ownership joins use the commitment book, not these maps.",
    fileCount: files.length,
    files,
  };

  const outPath = path.join(TAX_PROCESSED_DIR, "organized", "roque-bluffs-map-catalog.json");
  await ensureDirs(path.dirname(outPath));
  await writeJson(outPath, catalog);
  console.log(`  wrote ${outPath} (${files.length} files)`);
  console.log("Done (Roque Bluffs tax maps).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
