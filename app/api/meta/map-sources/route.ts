import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sourcesPath = path.join(process.cwd(), "data", "manifest", "sources.json");
    const raw = await readFile(sourcesPath, "utf8");
    const data = JSON.parse(raw) as {
      sources: Array<{ id: string; asOfDate?: string; name?: string }>;
    };
    const boundary = data.sources.find((s) => s.id === "me-geolibrary-boundaries");
    const osm = data.sources.find((s) => s.id === "osm-maine-extract");
    const asOfDate = boundary?.asOfDate ?? osm?.asOfDate ?? null;

    return NextResponse.json({
      asOfDate,
      sources: data.sources.filter((s) => s.id === "me-geolibrary-boundaries" || s.id === "osm-maine-extract"),
    });
  } catch {
    return NextResponse.json({ asOfDate: null, sources: [] });
  }
}
