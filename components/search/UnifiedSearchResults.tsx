"use client";

import type { UnifiedSearchResult } from "@/lib/types/search";

type UnifiedSearchResultsProps = {
  places: UnifiedSearchResult[];
  parcels: UnifiedSearchResult[];
  activeIndex: number;
  onSelect: (result: UnifiedSearchResult) => void;
  listboxId: string;
};

type IndexedResult = {
  result: UnifiedSearchResult;
  index: number;
};

function buildIndexedResults(
  parcels: UnifiedSearchResult[],
  places: UnifiedSearchResult[],
): { parcelRows: IndexedResult[]; placeRows: IndexedResult[] } {
  let index = -1;
  const parcelRows = parcels
    .filter((result): result is Extract<UnifiedSearchResult, { kind: "parcel" }> => result.kind === "parcel")
    .map((result) => {
      index += 1;
      return { result, index };
    });

  const placeRows = places
    .filter((result): result is Extract<UnifiedSearchResult, { kind: "place" }> => result.kind === "place")
    .map((result) => {
      index += 1;
      return { result, index };
    });

  return { parcelRows, placeRows };
}

export function UnifiedSearchResults({
  places,
  parcels,
  activeIndex,
  onSelect,
  listboxId,
}: UnifiedSearchResultsProps) {
  const { parcelRows, placeRows } = buildIndexedResults(parcels, places);
  const total = parcelRows.length + placeRows.length;

  return (
    <ul
      id={listboxId}
      role="listbox"
      className="motion-slide-up absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-1 shadow-lg"
    >
      {parcelRows.length > 0 ? (
        <li className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Parcels
        </li>
      ) : null}
      {parcelRows.map(({ result, index }) => (
        <li
          key={result.id}
          id={`${listboxId}-option-${index}`}
          role="option"
          aria-selected={activeIndex === index}
        >
          <button
            type="button"
            onClick={() => onSelect(result)}
            className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm ${
              activeIndex === index
                ? "bg-[var(--color-land-paper)]"
                : "hover:bg-[var(--color-land-paper)]"
            }`}
          >
            <span className="font-medium text-[var(--color-text-primary)]">{result.label}</span>
            {result.subtitle ? (
              <span className="text-xs text-[var(--color-text-secondary)]">{result.subtitle}</span>
            ) : null}
          </button>
        </li>
      ))}

      {placeRows.length > 0 ? (
        <li className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Places
        </li>
      ) : null}
      {placeRows.map(({ result, index }) => (
        <li
          key={result.id}
          id={`${listboxId}-option-${index}`}
          role="option"
          aria-selected={activeIndex === index}
        >
          <button
            type="button"
            onClick={() => onSelect(result)}
            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
              activeIndex === index
                ? "bg-[var(--color-land-paper)]"
                : "hover:bg-[var(--color-land-paper)]"
            }`}
          >
            <span className="font-medium text-[var(--color-text-primary)]">{result.name}</span>
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
              Place
            </span>
          </button>
        </li>
      ))}

      {total === 0 ? (
        <li className="px-3 py-3 text-sm text-[var(--color-text-secondary)]">No matches in Calais</li>
      ) : null}
    </ul>
  );
}

export function flattenSearchResults(
  places: UnifiedSearchResult[],
  parcels: UnifiedSearchResult[],
): UnifiedSearchResult[] {
  return [...parcels, ...places];
}
