import { NextResponse } from "next/server";
import { listMunicipalities } from "@/lib/data/municipalities";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const municipalities = await listMunicipalities();
    return NextResponse.json(municipalities);
  } catch (err) {
    console.error("GET /api/municipalities", err);
    return NextResponse.json(
      { error: "Municipality data unavailable. Run pnpm etl:places." },
      { status: 503 },
    );
  }
}
