import { NextRequest, NextResponse } from "next/server";
import { unifiedSearch } from "@/lib/data/search";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 80;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ places: [], parcels: [] });
  }

  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  try {
    const results = await unifiedSearch(q, { limitPerType: 5 });
    return NextResponse.json(results);
  } catch (err) {
    if (err instanceof Error && err.message === "SEARCH_INDEX_MISSING") {
      return NextResponse.json(
        {
          error: "Search unavailable. Run pnpm dev:bootstrap or the Calais ETL pipeline.",
        },
        { status: 503 },
      );
    }
    console.error("GET /api/search", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
