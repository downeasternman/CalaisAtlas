"use client";

type Citation = {
  label: string;
  asOf: string | null;
};

const CITATIONS: Citation[] = [
  {
    label: "Maine GeoLibrary boundaries (METWP / CNTY24P)",
    asOf: null,
  },
  {
    label: "© OpenStreetMap contributors",
    asOf: null,
  },
];

type MapAttributionProps = {
  asOfDate?: string | null;
};

export function MapAttribution({ asOfDate }: MapAttributionProps) {
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 md:right-auto md:max-w-xl">
      <div className="pointer-events-auto rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/90 px-2.5 py-1.5 text-[10px] leading-snug text-[var(--color-text-secondary)] shadow-sm backdrop-blur-sm md:text-xs">
        {CITATIONS.map((c) => (
          <div key={c.label}>
            {c.label}
            {(asOfDate || c.asOf) && (
              <span className="text-[var(--color-text-secondary)]">
                {" "}
                · as of {asOfDate ?? c.asOf}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
