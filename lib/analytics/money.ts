/** Parse a source money/acre string to number without mutating the source. */
export function numericFromSource(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return null;
  return n;
}
