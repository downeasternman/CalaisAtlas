"use client";

import type { PlaceSearchResult } from "@/lib/types/explorer";

type SearchResultsProps = {
  results: PlaceSearchResult[];
  onSelect: (place: PlaceSearchResult) => void;
};

const TYPE_LABELS: Record<string, string> = {
  municipality: "Town",
  populated_place: "Place",
  water: "Water",
  landmark: "Landmark",
};

export function SearchResults({ results, onSelect }: SearchResultsProps) {
  return (
    <ul
      role="listbox"
      className="motion-slide-up absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-1 shadow-lg"
    >
      {results.map((place) => (
        <li key={place.id} role="option" aria-selected={false}>
          <button
            type="button"
            onClick={() => onSelect(place)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-land-paper)]"
          >
            <span className="font-medium text-[var(--color-text-primary)]">{place.name}</span>
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
              {TYPE_LABELS[place.placeType] ?? place.placeType}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
