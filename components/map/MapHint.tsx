"use client";

import { useEffect, useState } from "react";

export function MapHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const shouldShow = sessionStorage.getItem("calais-map-hint-dismissed") !== "1";
    setVisible(shouldShow);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute bottom-24 left-3 z-10 max-w-xs md:bottom-6 md:left-4">
      <div className="pointer-events-auto rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/95 px-3 py-2 text-xs text-[var(--color-text-secondary)] shadow-sm backdrop-blur-sm">
        <p>Search for a property, or tap a parcel on the map.</p>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem("calais-map-hint-dismissed", "1");
            setVisible(false);
          }}
          className="mt-2 min-h-[44px] rounded px-2 py-1 text-[var(--color-ocean-deep)] hover:bg-[var(--color-land-paper)]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
