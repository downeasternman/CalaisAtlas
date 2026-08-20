"use client";

import { useState } from "react";

export type CohortVisibility = "both" | "improved" | "unimproved";

type ParcelValuationLegendProps = {
  cohortVisibility: CohortVisibility;
  onCohortVisibilityChange: (mode: CohortVisibility) => void;
};

function GradientBar({ label }: { label: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[9px] font-medium text-[var(--color-text-primary)] md:text-[10px]">
        {label}
      </div>
      <div
        className="h-2.5 w-full rounded-sm border border-[var(--color-border)]"
        style={{
          background:
            "linear-gradient(to right, var(--color-value-low), var(--color-value-low-mid), var(--color-value-mid), var(--color-value-high-mid), var(--color-value-high))",
        }}
        aria-hidden
      />
      <div className="mt-1 flex justify-between text-[9px] text-[var(--color-text-primary)] md:text-[10px]">
        <span>Lowest $/ac</span>
        <span>Highest $/ac</span>
      </div>
    </div>
  );
}

export function ParcelValuationLegend({
  cohortVisibility,
  onCohortVisibilityChange,
}: ParcelValuationLegendProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 max-w-[15.5rem] md:bottom-3 md:right-3">
      <div className="pointer-events-auto rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/90 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[10px] font-medium text-[var(--color-text-primary)] md:text-xs"
          aria-expanded={open}
        >
          Assessed value / acre
          <span className="text-[var(--color-text-secondary)]">{open ? "−" : "+"}</span>
        </button>
        {open ? (
          <div className="space-y-2 border-t border-[var(--color-border)] px-2.5 py-2 text-[10px] leading-snug text-[var(--color-text-secondary)] md:text-[11px]">
            <div
              className="flex gap-1"
              role="group"
              aria-label="Cohort visibility"
            >
              {(
                [
                  ["both", "Both"],
                  ["improved", "Improved"],
                  ["unimproved", "Unimproved"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onCohortVisibilityChange(mode)}
                  aria-pressed={cohortVisibility === mode}
                  className={`flex-1 rounded px-1.5 py-1 text-[9px] font-medium md:text-[10px] ${
                    cohortVisibility === mode
                      ? "bg-[var(--color-ocean-deep)] text-[var(--color-text-inverse)]"
                      : "bg-[var(--color-land-paper)] text-[var(--color-text-primary)] hover:bg-[var(--color-land-warm)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <GradientBar label="Improved (building > $0)" />
            <GradientBar label="Unimproved (building $0)" />

            <div className="flex items-start gap-2 border-t border-[var(--color-border)] pt-1.5">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm border"
                style={{
                  backgroundColor: "var(--color-value-exempt)",
                  borderColor: "var(--color-value-exempt-line)",
                }}
                aria-hidden
              />
              <div>
                <div className="text-[var(--color-text-primary)]">Fully tax-exempt</div>
                <div className="text-[9px] italic md:text-[10px]">
                  Exemption ≥ assessed total
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm border"
                style={{
                  backgroundColor: "var(--color-parcel-none)",
                  borderColor: "var(--color-parcel-none-line)",
                }}
                aria-hidden
              />
              <div>
                <div className="text-[var(--color-text-primary)]">No assessment / acre</div>
                <div className="text-[9px] italic md:text-[10px]">
                  Unranked — missing total or GIS acres
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span
                className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
                style={{
                  backgroundColor: "var(--color-accent-gold)",
                  borderColor: "var(--color-ocean-deep)",
                }}
                aria-hidden
              />
              <div>
                <div className="text-[var(--color-text-primary)]">Homestead exemption</div>
                <div className="text-[9px] italic md:text-[10px]">
                  $25k / $31k exemption in commitment book
                </div>
              </div>
            </div>

            <p className="pt-0.5 text-[9px] italic leading-snug md:text-[10px]">
              2025-26 RE Commitment · percentile within each cohort (assessed total ÷ GIS
              acres)
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
