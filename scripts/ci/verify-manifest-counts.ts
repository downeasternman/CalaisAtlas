import { readFileSync } from "node:fs";
import path from "node:path";

function main() {
  const coverage = JSON.parse(
    readFileSync(path.join(process.cwd(), "data/manifest/coverage.json"), "utf8"),
  ) as { municipalities?: { calais?: { parcelCount?: number; taxParseRate?: number } } };

  let release: { parcelCount?: number; withAssessment?: number } | null = null;
  try {
    release = JSON.parse(
      readFileSync(path.join(process.cwd(), "data/manifest/release.json"), "utf8"),
    );
  } catch {
    console.warn("release.json missing — skipping release parity check");
    return;
  }

  const calais = coverage.municipalities?.calais;
  if (!calais || !release) return;

  if (release.parcelCount != null && calais.parcelCount != null) {
    const delta = Math.abs(release.parcelCount - calais.parcelCount);
    if (delta > 0) {
      console.error(
        `coverage parcelCount (${calais.parcelCount}) != release (${release.parcelCount})`,
      );
      process.exit(1);
    }
  }
}

main();
