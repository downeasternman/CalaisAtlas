/**
 * Audit map_lot_parent joins for sibling over-join patterns.
 */
import path from "node:path";
import { isSuffixParentMapLot } from "@/lib/tax/organized-join";
import type { Parcel } from "@/lib/types/parcel";
import { ensureDirs, readJson, writeJson, PROCESSED_DIR } from "../etl/paths";

async function main() {
  const parcels = await readJson<Parcel[]>(path.join(PROCESSED_DIR, "parcels.json"));
  const parentJoins = parcels.filter((p) => p.joinMethod === "map_lot_parent");

  const suspicious = parentJoins.filter((p) => {
    const parentLot = String(p.attrsRaw?.parentMapLot ?? "");
    if (!parentLot || !p.mapLot) return true;
    return !isSuffixParentMapLot(p.mapLot, parentLot);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    parentJoinCount: parentJoins.length,
    suspiciousCount: suspicious.length,
    suspicious: suspicious.slice(0, 100).map((p) => ({
      id: p.id,
      mapLot: p.mapLot,
      ownerName: p.ownerName,
      assessedTotalValue: p.assessedTotalValue,
    })),
  };

  const outPath = path.join(PROCESSED_DIR, "audit-parent-joins.json");
  await ensureDirs(PROCESSED_DIR);
  await writeJson(outPath, report);
  console.log(`  parent joins: ${report.parentJoinCount}, suspicious: ${report.suspiciousCount}`);
  console.log(`  wrote ${outPath}`);

  if (report.suspiciousCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
