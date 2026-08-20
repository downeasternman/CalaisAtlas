import type { Map as MaplibreMap, MapLayerMouseEvent, FilterSpecification } from "maplibre-gl";
import { LAYER_IDS } from "./layers";

export function setupParcelClickHandler(
  map: MaplibreMap,
  onParcelSelect: (parcelId: string) => void,
): () => void {
  const layers = [LAYER_IDS.PARCEL_FILL, LAYER_IDS.PARCEL_LINE].filter((id) =>
    map.getLayer(id),
  );
  if (layers.length === 0) return () => {};

  const onClick = (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id === "string" && id) {
      onParcelSelect(id);
    }
  };

  const onMouseEnter = () => {
    map.getCanvas().style.cursor = "pointer";
  };
  const onMouseLeave = () => {
    map.getCanvas().style.cursor = "";
  };

  for (const layer of layers) {
    map.on("click", layer, onClick);
    map.on("mouseenter", layer, onMouseEnter);
    map.on("mouseleave", layer, onMouseLeave);
  }

  return () => {
    for (const layer of layers) {
      map.off("click", layer, onClick);
      map.off("mouseenter", layer, onMouseEnter);
      map.off("mouseleave", layer, onMouseLeave);
    }
  };
}

export function highlightSelectedParcel(map: MaplibreMap, parcelId: string | null): void {
  if (!map.getLayer(LAYER_IDS.PARCEL_LINE)) return;

  const filter: FilterSpecification = parcelId
    ? ["==", ["get", "id"], parcelId]
    : ["==", ["get", "id"], ""];

  if (map.getLayer(LAYER_IDS.PARCEL_SELECTED)) {
    map.setFilter(LAYER_IDS.PARCEL_SELECTED, filter);
  }
}
