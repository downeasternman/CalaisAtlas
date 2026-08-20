"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaceSearchResult } from "@/lib/types/explorer";
import { SearchResults } from "./SearchResults";

type PlaceSearchProps = {
  municipalityId: string | null;
  onPlaceSelect: (place: PlaceSearchResult) => void;
};

export function PlaceSearch({ municipalityId, onPlaceSelect }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (municipalityId) params.set("municipalityId", municipalityId);
        const res = await fetch(`/api/places/search?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as PlaceSearchResult[];
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, municipalityId]);

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
    (place: PlaceSearchResult) => {
      setQuery(place.name);
      setOpen(false);
      onPlaceSelect(place);
    },
    [onPlaceSelect],
  );

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <label
        htmlFor="place-search"
        className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
      >
        Search places
      </label>
      <input
        id="place-search"
        type="search"
        value={query}
        onChange={(e) => {
          const value = e.target.value;
          setQuery(value);
          if (value.trim().length < 2) {
            setResults([]);
            setOpen(false);
          }
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Town, village, place…"
        autoComplete="off"
        className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-ocean-mid)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ocean-mid)]"
      />
      {loading && (
        <span className="absolute right-3 top-9 text-xs text-[var(--color-text-secondary)]">
          …
        </span>
      )}
      {open && (
        <SearchResults results={results} onSelect={handleSelect} />
      )}
    </div>
  );
}
