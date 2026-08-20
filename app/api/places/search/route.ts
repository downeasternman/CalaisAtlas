import { NextRequest, NextResponse } from "next/server";
import { searchPlacesIndex } from "@/lib/data/places";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const municipalityId = request.nextUrl.searchParams.get("municipalityId");

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchPlacesIndex(q, {
      municipalityId: municipalityId || null,
      limit: 10,
    });
    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/places/search", err);
    return NextResponse.json(
      { error: "Place search unavailable. Run pnpm etl:places." },
      { status: 503 },
    );
  }
}
