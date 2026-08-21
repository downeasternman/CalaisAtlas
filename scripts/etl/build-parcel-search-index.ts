/**
 * Build parcel-search.json from parcels.json for unified property search.
 */
import path from "node:path";
import { buildParcelSearchIndex } from "@/lib/search/parcel-rank";
import type { Parcel } from "@/lib/types/parcel";
import { ensureDirs, readJson, writeJson, PROCESSED_DIR } from "./paths";

async function main() {
  await ensureDirs(PROCESSED_DIR);
  const parcelsPath = path.join(PROCESSED_DIR, "parcels.json");
  const parcels = await readJson<Parcel[]>(parcelsPath);
  const index = buildParcelSearchIndex(parcels);
  const outPath = path.join(PROCESSED_DIR, "parcel-search.json");
  await writeJson(outPath, index);
  console.log(`  indexed ${index.length}/${parcels.length} searchable parcels`);
  console.log(`  wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
