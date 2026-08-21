/**
 * Copy committed runtime fixtures into data/processed for local dev / CI.
 */
import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../etl/paths";

const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures", "runtime");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");
const TILES_FIXTURE_DIR = path.join(ROOT, "tests", "fixtures", "tiles");
const TILES_DIR = path.join(ROOT, "public", "tiles");

const RUNTIME_FILES = [
  "parcels.json",
  "places.json",
  "parcel-search.json",
  "municipalities.json",
] as const;

const TILE_FILES = ["basemap.pmtiles", "boundaries.pmtiles", "parcels.pmtiles"] as const;

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfPresent(src: string, dest: string): Promise<boolean> {
  if (!(await exists(src))) return false;
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
  return true;
}

async function shouldSkipParcelDataCopy(dest: string, src: string): Promise<boolean> {
  if (process.env.BOOTSTRAP_FORCE === "1") return false;
  if (!(await exists(dest))) return false;
  try {
    const [destRaw, srcRaw] = await Promise.all([readFile(dest, "utf8"), readFile(src, "utf8")]);
    const destCount = JSON.parse(destRaw).length;
    const srcCount = JSON.parse(srcRaw).length;
    return destCount > srcCount;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(FIXTURE_DIR))) {
    console.error(`Missing fixture directory: ${FIXTURE_DIR}`);
    console.error("Run: pnpm fixtures:generate (requires local ETL output)");
    process.exit(1);
  }

  await mkdir(PROCESSED_DIR, { recursive: true });
  await mkdir(TILES_DIR, { recursive: true });

  let copied = 0;
  for (const file of RUNTIME_FILES) {
    const src = path.join(FIXTURE_DIR, file);
    const dest = path.join(PROCESSED_DIR, file);
    if (
      (file === "parcels.json" || file === "parcel-search.json") &&
      (await shouldSkipParcelDataCopy(dest, src))
    ) {
      console.log(`  skipped ${file} (existing dataset is larger than fixture)`);
      continue;
    }
    if (await copyIfPresent(src, dest)) {
      console.log(`  copied ${file}`);
      copied += 1;
    }
  }

  const releaseSrc = path.join(FIXTURE_DIR, "release.json");
  const releaseDest = path.join(ROOT, "data", "manifest", "release.json");
  if (await copyIfPresent(releaseSrc, releaseDest)) {
    console.log("  copied release.json → data/manifest/");
    copied += 1;
  }

  for (const file of TILE_FILES) {
    const src = path.join(TILES_FIXTURE_DIR, file);
    const dest = path.join(TILES_DIR, file);
    if (await copyIfPresent(src, dest)) {
      console.log(`  copied tiles/${file}`);
      copied += 1;
    }
  }

  if (copied === 0) {
    console.error("No fixture files copied.");
    process.exit(1);
  }

  console.log(`Bootstrap complete (${copied} files).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
