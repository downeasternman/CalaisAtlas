"use client";

import type { MunicipalityOption, PlaceSearchResult } from "@/lib/types/explorer";
import { MunicipalityFilter } from "@/components/filters/MunicipalityFilter";
import { PlaceSearch } from "@/components/search/PlaceSearch";

type HeaderProps = {
  municipalities: MunicipalityOption[];
  selectedMunicipalityId: string | null;
  onMunicipalityChange: (id: string | null) => void;
  onPlaceSelect: (place: PlaceSearchResult) => void;
};

export function Header({
  municipalities,
  selectedMunicipalityId,
  onMunicipalityChange,
  onPlaceSelect,
}: HeaderProps) {
  return (
    <header className="atlas-grain relative z-20 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/90 backdrop-blur-sm">
      <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="shrink-0">
            <h1 className="font-[family-name:var(--font-fraunces)] text-xl font-semibold tracking-tight text-[var(--color-ocean-deep)] md:text-2xl">
              Washington County Atlas
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] md:text-sm">
              Washington County, Maine
            </p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center md:max-w-2xl">
            <PlaceSearch
              municipalityId={selectedMunicipalityId}
              onPlaceSelect={onPlaceSelect}
            />
            <MunicipalityFilter
              municipalities={municipalities}
              selectedId={selectedMunicipalityId}
              onChange={onMunicipalityChange}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
