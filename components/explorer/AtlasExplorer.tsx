"use client";

import { useCallback, useState } from "react";
import type { MapFlyTarget, PlaceSearchResult } from "@/lib/types/explorer";
import type { ParcelWithSources } from "@/lib/types/parcel";
import { bboxToFitBounds } from "@/lib/geo/bbox";
import { Header } from "@/components/layout/Header";
import { AtlasMap } from "@/components/map/AtlasMap";
import { ParcelDetailPanel } from "@/components/parcel/ParcelDetailPanel";

export function AtlasExplorer() {
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [parcelDetail, setParcelDetail] = useState<ParcelWithSources | null>(null);
  const [parcelLoading, setParcelLoading] = useState(false);
  const [parcelError, setParcelError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<MapFlyTarget | null>(null);

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

  const handleParcelSelect = useCallback((id: string) => {
    setSelectedParcelId(id);
    setParcelLoading(true);
    setParcelError(null);
    setParcelDetail(null);
    fetch(`/api/parcels/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Parcel not found");
        return r.json();
      })
      .then((data: ParcelWithSources) => setParcelDetail(data))
      .catch(() => setParcelError("Could not load parcel details."))
      .finally(() => setParcelLoading(false));
  }, []);

  const handleParcelClose = useCallback(() => {
    setSelectedParcelId(null);
    setParcelDetail(null);
    setParcelError(null);
    setParcelLoading(false);
  }, []);

  return (
    <div className="flex h-screen flex-col atlas-chrome-bg">
      <Header onPlaceSelect={handlePlaceSelect} />
      <main className="map-container flex flex-1 flex-col">
        <AtlasMap
          selectedMunicipalityId="calais"
          selectedParcelId={selectedParcelId}
          flyTarget={flyTarget}
          onParcelSelect={handleParcelSelect}
        />
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
