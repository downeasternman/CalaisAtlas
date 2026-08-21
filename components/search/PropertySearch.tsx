"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { UnifiedSearchResult } from "@/lib/types/search";
import type { PlaceSearchResult } from "@/lib/types/explorer";
import {
  UnifiedSearchResults,
  flattenSearchResults,
} from "./UnifiedSearchResults";

type PropertySearchProps = {
  onPlaceSelect: (place: PlaceSearchResult) => void;
  onParcelSelect: (parcelId: string) => void;
};

export function PropertySearch({ onPlaceSelect, onParcelSelect }: PropertySearchProps) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<UnifiedSearchResult[]>([]);
  const [parcels, setParcels] = useState<UnifiedSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const flatResults = flattenSearchResults(places, parcels);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q: query.trim() });
        const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setPlaces([]);
          setParcels([]);
          setOpen(false);
          setError(body?.error ?? "Search unavailable");
          return;
        }
        const data = (await res.json()) as {
          places: UnifiedSearchResult[];
          parcels: UnifiedSearchResult[];
        };
        setPlaces(data.places);
        setParcels(data.parcels);
        setOpen(data.places.length + data.parcels.length > 0);
        setActiveIndex(data.parcels.length + data.places.length > 0 ? 0 : -1);
      } catch {
        if (!controller.signal.aborted) {
          setPlaces([]);
          setParcels([]);
          setOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (result: UnifiedSearchResult) => {
      if (result.kind === "parcel") {
        setQuery(result.label);
        setOpen(false);
        onParcelSelect(result.id);
        return;
      }

      setQuery(result.name);
      setOpen(false);
      onPlaceSelect({
        id: result.id,
        name: result.name,
        placeType: result.placeType,
        municipalityId: result.municipalityId,
        score: result.score,
        centroid: result.centroid,
        bbox: result.bbox,
      });
    },
    [onParcelSelect, onPlaceSelect],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || flatResults.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((idx) => (idx + 1) % flatResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((idx) => (idx <= 0 ? flatResults.length - 1 : idx - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const selected = flatResults[activeIndex];
      if (selected) handleSelect(selected);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const activeDescendant =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <label
        htmlFor="property-search"
        className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
      >
        Search property
      </label>
      <input
        id="property-search"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          const value = e.target.value;
          setQuery(value);
          if (value.trim().length < 2) {
            setPlaces([]);
            setParcels([]);
            setOpen(false);
            setActiveIndex(-1);
            setError(null);
          }
        }}
        onFocus={() => {
          if (flatResults.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Address, owner, map/lot, account, or place…"
        autoComplete="off"
        className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-ocean-mid)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ocean-mid)]"
      />
      <span className="sr-only" aria-live="polite">
        {open ? `${flatResults.length} results` : ""}
      </span>
      {loading ? (
        <span className="absolute right-3 top-9 text-xs text-[var(--color-text-secondary)]">…</span>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-red-700">{error}</p>
      ) : null}
      {open ? (
        <UnifiedSearchResults
          places={places}
          parcels={parcels}
          activeIndex={activeIndex}
          onSelect={handleSelect}
          listboxId={listboxId}
        />
      ) : null}
    </div>
  );
}
