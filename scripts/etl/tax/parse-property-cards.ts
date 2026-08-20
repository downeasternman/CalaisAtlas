/**
 * Parse Calais 2023 property card PDFs into a map-lot owner index.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { parsePropertyCardText } from "@/lib/tax/property-card-parser";
import { ensureDirs, RAW_DIR, writeJson } from "../paths";
import { TAX_PROCESSED_DIR } from "./paths";

const DEFAULT_ZIP = path.join(RAW_DIR, "property-cards", "2023-property-cards.zip");
const OUT_JSON = path.join(TAX_PROCESSED_DIR, "organized", "calais-property-cards.json");

async function extractZip(zipPath: string, destDir: string): Promise<string[]> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  const script = `
import zipfile, sys
from pathlib import Path
z=zipfile.ZipFile(sys.argv[1])
dest=Path(sys.argv[2])
dest.mkdir(parents=True, exist_ok=True)
names=[]
for info in z.infolist():
  if info.is_dir():
    continue
  raw=info.filename
  base=Path(raw).name
  safe=base.lstrip('#').replace('/', '_')
  out=dest/safe
  out.write_bytes(z.read(info))
  names.append(str(out))
print('\\n'.join(names))
`;
  const pyPath = path.join(destDir, "_extract.py");
  await writeFile(pyPath, script, "utf8");
  const { stdout } = await execFileAsync("python", [pyPath, zipPath, destDir], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

async function parsePdf(filePath: string) {
  const buf = await readFile(filePath);
  const parser = new PDFParse({ data: buf });
  try {
    const parsed = await parser.getText();
    return parsed.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const zipPath = process.env.PROPERTY_CARDS_ZIP || DEFAULT_ZIP;
  console.log(`  reading ${zipPath}`);

  const tmp = await mkdtemp(path.join(os.tmpdir(), "calais-cards-"));
  try {
    const files = await extractZip(zipPath, tmp);
    console.log(`  extracted ${files.length} PDFs`);

    const rows = [];
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]!;
      if (!/\.pdf$/i.test(filePath)) continue;
      try {
        const text = await parsePdf(filePath);
        const row = parsePropertyCardText(text, {
          sourceFile: path.basename(filePath),
        });
        if (row) rows.push(row);
        else failed += 1;
      } catch {
        failed += 1;
      }
      if ((i + 1) % 200 === 0) {
        console.log(`  parsed ${i + 1}/${files.length}…`);
      }
    }

    await ensureDirs(path.dirname(OUT_JSON));
    await writeJson(OUT_JSON, {
      sourceZip: zipPath,
      asOfFallback: "2023-09-01",
      parsedAt: new Date().toISOString(),
      records: rows,
      stats: {
        pdfs: files.filter((f) => /\.pdf$/i.test(f)).length,
        records: rows.length,
        parseFailedOrEmpty: failed,
      },
    });

    console.log(`  ${rows.length} property-card rows written`);
    console.log(`  failed/empty: ${failed}`);
    console.log(`  wrote ${OUT_JSON}`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
