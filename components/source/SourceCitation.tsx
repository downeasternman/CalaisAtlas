import type { Source } from "@/lib/types/source";

type SourceCitationProps = {
  label: string;
  source: Source | null;
};

export function SourceCitation({ label, source }: SourceCitationProps) {
  if (!source) {
    return (
      <p className="text-xs text-[var(--color-text-secondary)]">
        {label}: source unavailable
      </p>
    );
  }

  return (
    <p className="text-xs text-[var(--color-text-secondary)]">
      <span className="font-medium text-[var(--color-text-primary)]">{label}:</span>{" "}
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-[var(--color-border)] underline-offset-2 hover:text-[var(--color-ocean-mid)]"
        >
          {source.name}
        </a>
      ) : (
        source.name
      )}
      {source.asOfDate ? ` · as of ${source.asOfDate}` : null}
    </p>
  );
}
