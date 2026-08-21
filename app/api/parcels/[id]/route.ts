import { NextResponse } from "next/server";
import { getParcelById, getParcelsLoadStatus } from "@/lib/data/parcels";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const status = await getParcelsLoadStatus();
  if (status.state === "missing") {
    return NextResponse.json(
      {
        error: "Parcel data unavailable",
        hint: "Run pnpm dev:bootstrap or the Calais ETL pipeline.",
      },
      { status: 503 },
    );
  }
  if (status.state === "error") {
    return NextResponse.json(
      { error: "Parcel data failed to load", detail: status.errorMessage },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const parcel = await getParcelById(decodeURIComponent(id));
  if (!parcel) {
    return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
  }
  return NextResponse.json(parcel);
}
