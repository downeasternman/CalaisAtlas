"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MapFlyTarget, PlaceSearchResult } from "@/lib/types/explorer";
import type { ParcelWithSources } from "@/lib/types/parcel";
import { bboxToFitBounds } from "@/lib/geo/bbox";
import { Header } from "@/components/layout/Header";
import { AtlasMap } from "@/components/map/AtlasMap";
import { MapHint } from "@/components/map/MapHint";
import { ParcelDetailPanel } from "@/components/parcel/ParcelDetailPanel";

export function AtlasExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParcelHandled = useRef(false);

  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [parcelDetail, setParcelDetail] = useState<ParcelWithSources | null>(null);
  const [parcelLoading, setParcelLoading] = useState(false);
  const [parcelError, setParcelError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<MapFlyTarget | null>(null);

  const loadParcel = useCallback((id: string, syncUrl = true) => {
    setSelectedParcelId(id);
    setParcelLoading(true);
    setParcelError(null);
    setParcelDetail(null);

    if (syncUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("parcel", id);
      router.replace(`/?${params.toString()}`, { scroll: false });
    }

    fetch(`/api/parcels/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Parcel not found");
        }
        return r.json();
      })
      .then((data: ParcelWithSources) => {
        setParcelDetail(data);
        if (data.bbox) {
          setFlyTarget({
            key: `parcel-${id}-${Date.now()}`,
            bounds: bboxToFitBounds(data.bbox),
          });
        } else if (data.centroid) {
          setFlyTarget({
            key: `parcel-${id}-${Date.now()}`,
            center: data.centroid,
            zoom: 15,
          });
        }
      })
      .catch((err: Error) => setParcelError(err.message || "Could not load parcel details."))
      .finally(() => setParcelLoading(false));
  }, [router, searchParams]);

  useEffect(() => {
    const parcelParam = searchParams.get("parcel");
    if (!parcelParam || urlParcelHandled.current) return;
    urlParcelHandled.current = true;
    loadParcel(parcelParam, false);
  }, [loadParcel, searchParams]);

  const handlePlaceSelect = useCallback((place: PlaceSearchResult) => {
    if (place.placeType === "municipality" && place.bbox) {
      setFlyTarget({
        key: `place-muni-${place.id}-${Date.now()}`,
        bounds: bboxToFitBounds(place.bbox),
      });
      return;
    }

    if (place.bbox) {
      setFlyTarget({
        key: `place-${place.id}-${Date.now()}`,
        bounds: bboxToFitBounds(place.bbox),
      });
      return;
    }

    setFlyTarget({
      key: `place-${place.id}-${Date.now()}`,
      center: place.centroid,
      zoom: place.placeType === "populated_place" ? 13 : 12,
    });
  }, []);

  const handleParcelSelect = useCallback(
    (id: string) => {
      loadParcel(id, true);
    },
    [loadParcel],
  );

  const handleParcelClose = useCallback(() => {
    setSelectedParcelId(null);
    setParcelDetail(null);
    setParcelError(null);
    setParcelLoading(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("parcel");
    const next = params.toString();
    router.replace(next ? `/?${next}` : "/", { scroll: false });
  }, [router, searchParams]);

  return (
    <div className="flex h-screen flex-col atlas-chrome-bg">
      <Header
        onPlaceSelect={handlePlaceSelect}
        onParcelSelect={handleParcelSelect}
      />
      <main className="map-container relative flex flex-1 flex-col">
        <AtlasMap
          selectedMunicipalityId="calais"
          selectedParcelId={selectedParcelId}
          flyTarget={flyTarget}
          onParcelSelect={handleParcelSelect}
        />
        <MapHint />
        <ParcelDetailPanel
          parcel={parcelDetail}
          loading={parcelLoading}
          error={parcelError}
          onClose={handleParcelClose}
        />
      </main>
    </div>
  );
}
