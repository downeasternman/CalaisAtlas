export function PublicDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "text-[11px] leading-snug text-[var(--color-text-secondary)]" : "text-xs leading-relaxed text-[var(--color-text-secondary)]"}>
      Assessment and mapping information is for public reference only. Boundaries are not a
      survey; ownership may be stale; values are not market appraisals; tax payment status is not
      shown. Verify consequential decisions with the{" "}
      <a
        href="https://calaismaine.org/departments/assessing/"
        className="text-[var(--color-ocean-deep)] underline"
        target="_blank"
        rel="noreferrer"
      >
        City Assessor
      </a>{" "}
      and registry records.
    </p>
  );
}
