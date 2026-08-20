"use client";

import type { MunicipalityOption } from "@/lib/types/explorer";

type MunicipalityFilterProps = {
  municipalities: MunicipalityOption[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
};

export function MunicipalityFilter({
  municipalities,
  selectedId,
  onChange,
}: MunicipalityFilterProps) {
  return (
    <div className="flex w-full shrink-0 flex-col gap-1 sm:w-52">
      <label
        htmlFor="municipality-filter"
        className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
      >
        Town
      </label>
      <select
        id="municipality-filter"
        value={selectedId ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm focus:border-[var(--color-ocean-mid)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ocean-mid)]"
      >
        <option value="">All towns</option>
        {municipalities.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {selectedId && (
        <p className="text-[10px] text-[var(--color-text-secondary)]">
          {municipalities.find((m) => m.id === selectedId)?.coverage.hasOwnership
            ? "Ownership data available"
            : "Ownership data not yet available"}
        </p>
      )}
    </div>
  );
}
