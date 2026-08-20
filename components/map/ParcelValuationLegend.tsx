"use client";

import { useState } from "react";

export function ParcelValuationLegend() {
  const [open, setOpen] = useState(true);

  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 max-w-[14rem] md:bottom-3 md:right-3">
      <div className="pointer-events-auto rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/90 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[10px] font-medium text-[var(--color-text-primary)] md:text-xs"
          aria-expanded={open}
        >
          Assessed total
          <span className="text-[var(--color-text-secondary)]">{open ? "−" : "+"}</span>
        </button>
        {open ? (
          <div className="space-y-1.5 border-t border-[var(--color-border)] px-2.5 py-2 text-[10px] leading-snug text-[var(--color-text-secondary)] md:text-[11px]">
            <div>
              <div
                className="h-2.5 w-full rounded-sm border border-[var(--color-border)]"
                style={{
                  background:
                    "linear-gradient(to right, var(--color-value-low), var(--color-value-low-mid), var(--color-value-mid), var(--color-value-high-mid), var(--color-value-high))",
                }}
                aria-hidden
              />
              <div className="mt-1 flex justify-between text-[9px] text-[var(--color-text-primary)] md:text-[10px]">
                <span>Lowest assessed</span>
                <span>Median</span>
                <span>Highest assessed</span>
              </div>
            </div>
            <div className="flex items-start gap-2 border-t border-[var(--color-border)] pt-1.5">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm border"
                style={{
                  backgroundColor: "var(--color-parcel-none)",
                  borderColor: "var(--color-parcel-none-line)",
                }}
                aria-hidden
              />
              <div>
                <div className="text-[var(--color-text-primary)]">No assessment</div>
                <div className="text-[9px] italic md:text-[10px]">
                  Unranked — null or unjoined total
                </div>
              </div>
            </div>
            <p className="pt-0.5 text-[9px] italic leading-snug md:text-[10px]">
              2025-26 RE Commitment · percentile among Calais parcels with an assessed
              total
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
