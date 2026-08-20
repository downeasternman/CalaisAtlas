/**
 * Convert a [west, south, east, north] bbox to MapLibre fitBounds format.
 */
export function bboxToFitBounds(
  bbox: [number, number, number, number],
): [[number, number], [number, number]] {
  const [west, south, east, north] = bbox;
  return [
    [west, south],
    [east, north],
  ];
}

/**
 * Parse a bbox string from environment variable.
 * Format: "west,south,east,north"
 */
export function parseBboxEnv(value: string | undefined): [number, number, number, number] | null {
  if (!value) return null;
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return parts as [number, number, number, number];
}
