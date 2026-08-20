/**
 * Heuristic: Washington County UT townships/plantations in METWP naming.
 * Organized towns/cities are handled in Phase D2.
 */
export function isUtMunicipalityName(name: string): boolean {
  const n = name.trim();
  if (n === "Indian Twp Res") return true;
  return /\b(Twp|BPP|Plt|NBPP)\b/i.test(n);
}

export function filterUtMunicipalityNames(names: string[]): string[] {
  return names.filter(isUtMunicipalityName);
}
