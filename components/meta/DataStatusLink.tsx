"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicDisclaimer } from "./PublicDisclaimer";

type HealthResponse = {
  releaseId: string | null;
  generatedAt: string | null;
  coverage: {
    parcelCount: number;
    withOwner: number | null;
    withAssessment: number | null;
    ranked: number | null;
    cardBackups: number | null;
    searchIndexCount: number | null;
    sourceDates: Record<string, string | null>;
  };
  tilesPresent: boolean;
};

export function DataStatusLink() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/meta/health")
      .then(async (r) => {
        if (!r.ok) throw new Error("Health check failed");
        return r.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch(() => setError("Could not load data status."));
  }, []);

  useEffect(() => {
    if (open && !health) load();
  }, [health, load, open]);

  const pct = (part: number | null, total: number) =>
    part != null && total > 0 ? `${Math.round((part / total) * 1000) / 10}%` : "—";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 self-start rounded border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-land-paper)] sm:mb-0.5"
      >
        Data status
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 md:items-center">
          <div
            role="dialog"
            aria-labelledby="data-status-title"
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="data-status-title" className="font-[family-name:var(--font-fraunces)] text-lg text-[var(--color-ocean-deep)]">
                Data status
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[44px] rounded px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-land-paper)]"
              >
                Close
              </button>
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            {health ? (
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">Release</dt>
                  <dd>{health.releaseId ?? "Not packaged"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">Parcels</dt>
                  <dd>{health.coverage.parcelCount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">With owner</dt>
                  <dd>
                    {health.coverage.withOwner?.toLocaleString() ?? "—"} (
                    {pct(health.coverage.withOwner, health.coverage.parcelCount)})
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">With assessment</dt>
                  <dd>
                    {health.coverage.withAssessment?.toLocaleString() ?? "—"} (
                    {pct(health.coverage.withAssessment, health.coverage.parcelCount)})
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">Ranked on map</dt>
                  <dd>
                    {health.coverage.ranked?.toLocaleString() ?? "—"} (
                    {pct(health.coverage.ranked, health.coverage.parcelCount)})
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">2023 card owner backups</dt>
                  <dd>{health.coverage.cardBackups?.toLocaleString() ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">Map tiles</dt>
                  <dd>{health.tilesPresent ? "Available" : "Missing"}</dd>
                </div>
              </dl>
            ) : (
              !error ? <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p> : null
            )}

            <div className="mt-4 border-t border-[var(--color-border)] pt-3">
              <PublicDisclaimer />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
