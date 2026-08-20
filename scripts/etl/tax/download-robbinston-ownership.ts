/**
 * Download Robbinston owner index HTML + both transfer PDFs.
 */
import { createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ensureDirs } from "../paths";
import { organizedRawDir } from "./paths";

const INDEX_URL = "https://townofrobbinston.org/wordpress/?page_id=180";
const TRANSFERS_2024_URL =
  "https://townofrobbinston.org/wordpress/wp-content/uploads/2024/08/Transfers.pdf";
const TRANSFERS_2425_URL =
  "https://townofrobbinston.org/wordpress/wp-content/uploads/2025/09/24-25-Transfers.pdf";

async function downloadBinary(url: string, dest: string) {
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${url}`);
  if (!res.body) throw new Error(`No response body for ${url}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  console.log(`  wrote ${dest}`);
}

async function downloadText(url: string, dest: string) {
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${url}`);
  const text = await res.text();
  await writeFile(dest, text, "utf8");
  console.log(`  wrote ${dest}`);
}

async function main() {
  const dir = organizedRawDir("robbinston");
  await ensureDirs(dir);
  await downloadText(INDEX_URL, `${dir}/owner-index.html`);
  await downloadBinary(TRANSFERS_2024_URL, `${dir}/transfers-2024-08.pdf`);
  await downloadBinary(TRANSFERS_2425_URL, `${dir}/transfers-24-25.pdf`);
  console.log("Done (Robbinston ownership sources).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
