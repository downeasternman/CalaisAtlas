"use client";

import { useCallback, useEffect, useState } from "react";
import type { MapFlyTarget, MunicipalityOption, PlaceSearchResult } from "@/lib/types/explorer";
import type { ParcelWithSources } from "@/lib/types/parcel";
import { bboxToFitBounds } from "@/lib/geo/bbox";
import { CALAIS_BBOX } from "@/lib/geo/calais";
import { Header } from "@/components/layout/Header";
import { AtlasMap } from "@/components/map/AtlasMap";
import { ParcelDetailPanel } from "@/components/parcel/ParcelDetailPanel";

export function AtlasExplorer() {
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [parcelDetail, setParcelDetail] = useState<ParcelWithSources | null>(null);
  const [parcelLoading, setParcelLoading] = useState(false);
  const [parcelError, setParcelError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<MapFlyTarget | null>(null);
  const [municipalities, setMunicipalities] = useState<MunicipalityOption[]>([]);

  useEffect(() => {
    fetch("/api/municipalities")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MunicipalityOption[]) => setMunicipalities(data))
      .catch(() => setMunicipalities([]));
  }, []);

  const flyToMunicipality = useCallback((id: string | null) => {
    if (!id) {
      setFlyTarget({
        key: `county-${Date.now()}`,
        bounds: bboxToFitBounds(CALAIS_BBOX),
      });
      return;
    }
    const muni = municipalities.find((m) => m.id === id);
    if (!muni) return;
    setFlyTarget({
      key: `muni-${id}-${Date.now()}`,
      bounds: bboxToFitBounds(muni.bbox),
    });
  }, [municipalities]);

  const handleMunicipalityChange = useCallback(
    (id: string | null) => {
      setSelectedMunicipalityId(id);
      setSelectedParcelId(null);
      setParcelDetail(null);
      setParcelError(null);
      flyToMunicipality(id);
    },
    [flyToMunicipality],
  );

  const handlePlaceSelect = useCallback(
    (place: PlaceSearchResult) => {
      if (place.placeType === "municipality" && place.municipalityId) {
        setSelectedMunicipalityId(place.municipalityId);
        if (place.bbox) {
          setFlyTarget({
            key: `place-muni-${place.id}-${Date.now()}`,
            bounds: bboxToFitBounds(place.bbox),
          });
        } else {
          flyToMunicipality(place.municipalityId);
        }
        return;
      }

      setFlyTarget({
        key: `place-${place.id}-${Date.now()}`,
        center: place.centroid,
        zoom: place.placeType === "populated_place" ? 12 : 11,
      });
    },
    [flyToMunicipality],
  );

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
      <Header
        municipalities={municipalities}
        selectedMunicipalityId={selectedMunicipalityId}
        onMunicipalityChange={handleMunicipalityChange}
        onPlaceSelect={handlePlaceSelect}
      />
      <main className="map-container flex flex-1 flex-col">
        <AtlasMap
          selectedMunicipalityId={selectedMunicipalityId}
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
