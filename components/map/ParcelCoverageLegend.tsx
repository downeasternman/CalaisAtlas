"use client";

import { useState } from "react";

type LegendItem = {
  label: string;
  sublabel?: string;
  fill: string;
  line: string;
};

const PRIMARY_ITEMS: LegendItem[] = [
  {
    label: "Owner + assessment",
    fill: "var(--color-parcel-full)",
    line: "var(--color-parcel-full-line)",
  },
  {
    label: "Owner + assessment, tax exemption",
    sublabel: "includes homestead",
    fill: "var(--color-parcel-exempt)",
    line: "var(--color-parcel-exempt-line)",
  },
  {
    label: "Tree Growth enrollment",
    fill: "var(--color-parcel-tree-growth)",
    line: "var(--color-parcel-tree-growth-line)",
  },
  {
    label: "Owner only",
    fill: "var(--color-parcel-owner)",
    line: "var(--color-parcel-owner-line)",
  },
  {
    label: "Parcel boundary only",
    fill: "var(--color-parcel-none)",
    line: "var(--color-parcel-none-line)",
  },
];

function Swatch({ fill, line }: { fill: string; line: string }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-sm border"
      style={{ backgroundColor: fill, borderColor: line }}
      aria-hidden
    />
  );
}

export function ParcelCoverageLegend() {
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
          Coverage
          <span className="text-[var(--color-text-secondary)]">{open ? "−" : "+"}</span>
        </button>
        {open ? (
          <div className="space-y-1.5 border-t border-[var(--color-border)] px-2.5 py-2 text-[10px] leading-snug text-[var(--color-text-secondary)] md:text-[11px]">
            {PRIMARY_ITEMS.map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                <Swatch fill={item.fill} line={item.line} />
                <div>
                  <div className="text-[var(--color-text-primary)]">{item.label}</div>
                  {item.sublabel ? (
                    <div className="text-[9px] italic md:text-[10px]">{item.sublabel}</div>
                  ) : null}
                </div>
              </div>
            ))}
            <div className="flex items-start gap-2 border-t border-[var(--color-border)] pt-1.5">
              <Swatch
                fill="var(--color-parcel-full-muted)"
                line="var(--color-parcel-full-line)"
              />
              <div>
                <div className="text-[var(--color-text-primary)]">Muted shade</div>
                <div className="text-[9px] italic md:text-[10px]">
                  Low confidence — verify with source
                </div>
              </div>
            </div>
            <p className="pt-0.5 text-[9px] italic leading-snug md:text-[10px]">
              Program colors take priority when a parcel has enrolled forest land or an
              exemption.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
