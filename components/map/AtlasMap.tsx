"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import Map, { NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { CALAIS_BBOX } from "@/lib/geo/calais";
import { bboxToFitBounds } from "@/lib/geo/bbox";
import { LAYER_IDS } from "@/lib/map/layers";
import {
  cohortVisibilityFilter,
  homesteadVisibilityFilter,
} from "@/lib/map/parcel-valuation";
import { buildAtlasStyle } from "@/lib/map/style";
import { applyMunicipalityEmphasis } from "@/lib/map/municipality-emphasis";
import {
  highlightSelectedParcel,
  setupParcelClickHandler,
} from "@/lib/map/interactions";
import type { MapFlyTarget } from "@/lib/types/explorer";
import { MapAttribution } from "./MapAttribution";
import {
  ParcelValuationLegend,
  type CohortVisibility,
} from "./ParcelValuationLegend";

let protocolRegistered = false;

function ensurePmtilesProtocol() {
  if (protocolRegistered || typeof window === "undefined") return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  protocolRegistered = true;
}

type AtlasMapProps = {
  selectedMunicipalityId: string | null;
  selectedParcelId: string | null;
  flyTarget: MapFlyTarget | null;
  onParcelSelect: (parcelId: string) => void;
};

export function AtlasMap({
  selectedMunicipalityId,
  selectedParcelId,
  flyTarget,
  onParcelSelect,
}: AtlasMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [asOfDate, setAsOfDate] = useState<string | null>(null);
  const [cohortVisibility, setCohortVisibility] = useState<CohortVisibility>("both");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    ensurePmtilesProtocol();
    fetch("/api/meta/map-sources")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { asOfDate?: string } | null) => {
        if (data?.asOfDate) setAsOfDate(data.asOfDate);
      })
      .catch(() => {});
  }, []);

  const style = useMemo(() => {
    if (!mounted) return null;
    return buildAtlasStyle(window.location.origin);
  }, [mounted]);
  const initialBounds = useMemo(
    () => bboxToFitBounds(CALAIS_BBOX),
    [],
  );

  const onMapLoad = useCallback(() => {
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    applyMunicipalityEmphasis(map, selectedMunicipalityId);
  }, [mapReady, selectedMunicipalityId]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    highlightSelectedParcel(map, selectedParcelId);
  }, [mapReady, selectedParcelId]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const fillFilter = cohortVisibilityFilter(cohortVisibility);
    if (map.getLayer(LAYER_IDS.PARCEL_FILL)) {
      map.setFilter(LAYER_IDS.PARCEL_FILL, fillFilter);
    }
    if (map.getLayer(LAYER_IDS.PARCEL_LINE)) {
      map.setFilter(LAYER_IDS.PARCEL_LINE, fillFilter);
    }
    if (map.getLayer(LAYER_IDS.PARCEL_HOMESTEAD)) {
      map.setFilter(
        LAYER_IDS.PARCEL_HOMESTEAD,
        homesteadVisibilityFilter(cohortVisibility),
      );
    }
  }, [mapReady, cohortVisibility]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    return setupParcelClickHandler(map, onParcelSelect);
  }, [mapReady, onParcelSelect]);

  useEffect(() => {
    if (!mapReady || !flyTarget) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (flyTarget.bounds) {
      map.fitBounds(flyTarget.bounds, { padding: 48, duration: 900 });
    } else if (flyTarget.center) {
      map.flyTo({
        center: flyTarget.center,
        zoom: flyTarget.zoom ?? 11,
        duration: 900,
      });
    }
  }, [mapReady, flyTarget]);

  if (!style) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-[var(--color-ocean-deep)] text-[var(--color-text-inverse)]">
        Loading map…
      </div>
    );
  }

  return (
    <div className="relative h-full w-full motion-fade-in">
      <Map
        ref={mapRef}
        initialViewState={{
          bounds: initialBounds,
          fitBoundsOptions: { padding: 40 },
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={style}
        attributionControl={false}
        onLoad={onMapLoad}
      >
        <NavigationControl position="top-right" showCompass={false} />
      </Map>
      <MapAttribution asOfDate={asOfDate} />
      <ParcelValuationLegend
        cohortVisibility={cohortVisibility}
        onCohortVisibilityChange={setCohortVisibility}
      />
    </div>
  );
}
