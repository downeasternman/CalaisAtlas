import type { Map as MaplibreMap, ExpressionSpecification } from "maplibre-gl";
import { LAYER_IDS } from "./layers";

/**
 * Apply visual emphasis for the selected municipality on boundary layers.
 */
export function applyMunicipalityEmphasis(
  map: MaplibreMap,
  selectedId: string | null,
): void {
  const hasSelection = Boolean(selectedId);

  const fillOpacity = (
    hasSelection
      ? ["case", ["==", ["get", "id"], selectedId], 0.14, 0.02]
      : 0.05
  ) as ExpressionSpecification;

  const lineOpacity = (
    hasSelection
      ? ["case", ["==", ["get", "id"], selectedId], 0.95, 0.2]
      : 0.75
  ) as ExpressionSpecification;

  const lineWidth = (
    hasSelection
      ? ["case", ["==", ["get", "id"], selectedId], 2.4, 0.6]
      : ["interpolate", ["linear"], ["zoom"], 6, 0.4, 10, 0.8, 13, 1.2]
  ) as ExpressionSpecification;

  const labelOpacity = (
    hasSelection
      ? ["case", ["==", ["get", "id"], selectedId], 1, 0.35]
      : 1
  ) as ExpressionSpecification;

  if (map.getLayer(LAYER_IDS.MUNICIPALITY_FILL)) {
    map.setPaintProperty(LAYER_IDS.MUNICIPALITY_FILL, "fill-opacity", fillOpacity);
  }
  if (map.getLayer(LAYER_IDS.MUNICIPALITY_LINE)) {
    map.setPaintProperty(LAYER_IDS.MUNICIPALITY_LINE, "line-opacity", lineOpacity);
    map.setPaintProperty(LAYER_IDS.MUNICIPALITY_LINE, "line-width", lineWidth);
  }
  if (map.getLayer(LAYER_IDS.MUNICIPALITY_LABEL)) {
    map.setPaintProperty(LAYER_IDS.MUNICIPALITY_LABEL, "text-opacity", labelOpacity);
  }
}
