/**
 * Fill owner-less Calais parcels from 2023 property cards (exact map-lot only).
 */
import path from "node:path";
import {
  applyPropertyCardOwnerBackup,
  PROPERTY_CARD_SOURCE_ID,
} from "@/lib/tax/property-card-backup";
import type { ParsedPropertyCard } from "@/lib/tax/property-card-parser";
import { readJson, writeJson } from "../paths";
import { ORGANIZED_PARCELS_JOINED_JSON, TAX_PROCESSED_DIR } from "./paths";

const CARDS_JSON = path.join(TAX_PROCESSED_DIR, "organized", "calais-property-cards.json");

type CardsFile = {
  records: ParsedPropertyCard[];
  asOfFallback?: string;
};

async function main() {
  const cardsFile = await readJson<CardsFile>(CARDS_JSON);
  const joined = await readJson<Record<string, unknown>[]>(ORGANIZED_PARCELS_JOINED_JSON);

  const beforeOwners = joined.filter((p) => p.ownerName).length;
  const result = applyPropertyCardOwnerBackup(
    joined.map((p) => ({
      ...p,
      id: String(p.id ?? ""),
      mapLot: p.mapLot == null ? null : String(p.mapLot),
      ownerName: p.ownerName == null ? null : String(p.ownerName),
      ownerNameNormalized:
        p.ownerNameNormalized == null ? null : String(p.ownerNameNormalized),
      accountNumber: p.accountNumber == null ? null : String(p.accountNumber),
      joinMethod: p.joinMethod == null ? null : String(p.joinMethod),
      joinConfidence:
        typeof p.joinConfidence === "number" ? p.joinConfidence : null,
      taxSourceId: p.taxSourceId == null ? null : String(p.taxSourceId),
      attrsRaw:
        p.attrsRaw && typeof p.attrsRaw === "object"
          ? (p.attrsRaw as Record<string, unknown>)
          : null,
    })),
    cardsFile.records ?? [],
  );

  await writeJson(ORGANIZED_PARCELS_JOINED_JSON, result.parcels);

  const afterOwners = result.parcels.filter((p) => p.ownerName).length;
  console.log(`  source: ${PROPERTY_CARD_SOURCE_ID}`);
  console.log(`  card records: ${cardsFile.records?.length ?? 0}`);
  console.log(`  eligible (no owner + mapLot): ${result.eligible}`);
  console.log(`  filled from cards: ${result.filled}`);
  console.log(`  skipped collision lots: ${result.skippedCollisions}`);
  console.log(`  owners before/after: ${beforeOwners} → ${afterOwners}`);
  console.log(`  wrote ${ORGANIZED_PARCELS_JOINED_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
