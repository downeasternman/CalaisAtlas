"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { ParcelWithSources } from "@/lib/types/parcel";
import { forestEnrollmentFromAttrs } from "@/lib/tax/tree-growth";
import { isValidAccountNumber } from "@/lib/tax/owner-validate";
import { SourceCitation } from "@/components/source/SourceCitation";
import { PublicDisclaimer } from "@/components/meta/PublicDisclaimer";

type ParcelDetailPanelProps = {
  parcel: ParcelWithSources | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

function formatAcres(value: string | null): string | null {
  if (!value) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `${num.toLocaleString("en-US", { maximumFractionDigits: 4 })} ac`;
}

function isUtAccountNumber(account: string): boolean {
  return /^\d{4}-\d{4}$/.test(account.trim());
}

function formatOrdinalPercentile(value: number): string {
  const rounded = Math.round(value);
  const mod100 = rounded % 100;
  const mod10 = rounded % 10;
  let suffix = "th";
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = "st";
    else if (mod10 === 2) suffix = "nd";
    else if (mod10 === 3) suffix = "rd";
  }
  return `${rounded}${suffix}`;
}

function formatCurrency(value: string | null, fractionDigits = 0): string | null {
  if (!value) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(num);
}

function formatMailLines(mailAddress: string | null): string[] {
  if (!mailAddress) return [];
  return mailAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatForestEnrollment(parcel: ParcelWithSources): string | null {
  const enrollment = forestEnrollmentFromAttrs(parcel.attrsRaw);
  if (!enrollment && !parcel.hasTreeGrowth) return null;

  const parts: string[] = [];
  if (enrollment?.softAcres && enrollment.softAcres > 0) {
    parts.push(`${enrollment.softAcres} ac softwood`);
  }
  if (enrollment?.mixedAcres && enrollment.mixedAcres > 0) {
    parts.push(`${enrollment.mixedAcres} ac mixed wood`);
  }
  if (enrollment?.hardAcres && enrollment.hardAcres > 0) {
    parts.push(`${enrollment.hardAcres} ac hardwood`);
  }

  if (parts.length === 0) {
    return parcel.hasTreeGrowth ? "Enrolled (acreage not parsed)" : null;
  }

  return parts.join(" · ");
}

function cohortLabel(cohort: number | null | undefined): string {
  if (cohort === 1) return "improved";
  if (cohort === 0) return "unimproved";
  return "comparable";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-[var(--color-text-primary)]">{children}</dd>
    </div>
  );
}

export function ParcelDetailPanel({
  parcel,
  loading,
  error,
  onClose,
}: ParcelDetailPanelProps) {
  const [dataQualityOpen, setDataQualityOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!loading && !parcel && !error) return null;

  const forestSummary = parcel ? formatForestEnrollment(parcel) : null;
  const isHomestead =
    parcel?.homestead === true || parcel?.attrsRaw?.homesteadLabel === true;
  const mailLines = formatMailLines(parcel?.mailAddress ?? null);
  const situs =
    parcel?.situsAddress ||
    (typeof parcel?.attrsRaw?.situsLabel === "string"
      ? parcel.attrsRaw.situsLabel
      : null);
  const situsDistinct =
    situs &&
    !mailLines.some((line) => line.toUpperCase() === situs.toUpperCase()) &&
    !parcel?.ownerName?.toUpperCase().includes(situs.toUpperCase());

  const percentileSentence =
    parcel?.valuePct != null && parcel.valuePct >= 0
      ? `Assessed at the ${formatOrdinalPercentile(parcel.valuePct)} percentile among ${cohortLabel(parcel.cohort)} Calais parcels by value per GIS acre.`
      : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside
      className="parcel-detail-panel motion-slide-up fixed inset-x-0 bottom-0 z-20 max-h-[70vh] overflow-y-auto rounded-t-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/95 p-4 shadow-lg backdrop-blur-sm md:absolute md:inset-x-auto md:bottom-4 md:left-4 md:right-auto md:max-h-[calc(100%-2rem)] md:w-[min(100%,22rem)] md:rounded-lg"
      aria-label="Parcel details"
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border)] md:hidden" />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-fraunces)] text-lg text-[var(--color-ocean-deep)]">
            {situs || parcel?.mapLot || "Parcel"}
          </h2>
          {parcel?.mapLot ? (
            <p className="text-sm text-[var(--color-text-secondary)]">{parcel.mapLot}</p>
          ) : null}
          {parcel?.municipalityName ? (
            <p className="text-xs text-[var(--color-text-secondary)]">{parcel.municipalityName}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          {parcel ? (
            <button
              type="button"
              onClick={copyLink}
              className="min-h-[44px] rounded px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-land-paper)]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-land-paper)]"
            aria-label="Close parcel details"
          >
            Close
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {parcel && !loading ? (
        <dl className="space-y-3">
          {parcel.taxAmount != null && parcel.taxAmount !== "" ? (
            <Field label="Tax billed">
              <span className="text-base font-semibold text-[var(--color-ocean-deep)]">
                {formatCurrency(parcel.taxAmount, 2)}
              </span>
              {parcel.taxYear ? (
                <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">
                  ({parcel.taxYear})
                </span>
              ) : null}
            </Field>
          ) : null}

          {parcel.assessedTotalValue ? (
            <Field label="Assessed total">
              <span className="font-medium">
                {formatCurrency(parcel.assessedTotalValue)}
                {parcel.taxYear && !parcel.taxAmount ? ` (${parcel.taxYear})` : ""}
              </span>
              {parcel.valuePerAcre != null && parcel.valuePerAcre > 0 ? (
                <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {formatCurrency(String(Math.round(parcel.valuePerAcre)))}/acre (GIS)
                </div>
              ) : null}
              {percentileSentence ? (
                <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {percentileSentence}
                </div>
              ) : null}
              {parcel.bookFullyExempt || parcel.fullyExempt ? (
                <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  Fully tax-exempt in commitment book
                </div>
              ) : null}
            </Field>
          ) : parcel.ownerName ? (
            <Field label="Assessed total">
              <span className="text-[var(--color-text-secondary)]">
                Not available from tax source
              </span>
            </Field>
          ) : null}

          {parcel.accountNumber &&
          (isValidAccountNumber(parcel.accountNumber) ||
            isUtAccountNumber(parcel.accountNumber)) ? (
            <Field label="Account">
              <span className="font-mono text-xs">{parcel.accountNumber}</span>
            </Field>
          ) : null}

          <Field label="Owner">
            <span className="font-medium">
              {parcel.ownerName ?? (
                <span className="font-normal text-[var(--color-text-secondary)]">
                  Not available from tax source
                </span>
              )}
            </span>
          </Field>

          {mailLines.length > 0 ? (
            <Field label="Mailing address">
              <div className="space-y-0.5 text-[var(--color-text-secondary)]">
                {mailLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </Field>
          ) : null}

          {situsDistinct ? (
            <Field label="Location">
              <span className="text-[var(--color-text-secondary)]">{situs}</span>
            </Field>
          ) : null}

          {parcel.assessedLandValue ? (
            <Field label="Land">{formatCurrency(parcel.assessedLandValue)}</Field>
          ) : null}
          {parcel.assessedBuildingValue ? (
            <Field label="Building">
              {formatCurrency(parcel.assessedBuildingValue)}
            </Field>
          ) : null}

          {parcel.assessedExemptionValue ? (
            <Field label="Exemption">
              <span className="font-medium">
                {formatCurrency(parcel.assessedExemptionValue)}
                {isHomestead ? (
                  <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">
                    (homestead)
                  </span>
                ) : null}
              </span>
            </Field>
          ) : isHomestead ? (
            <Field label="Exemption">
              <span className="text-xs text-[var(--color-text-secondary)]">Homestead</span>
            </Field>
          ) : null}

          {forestSummary ? <Field label="Tree Growth">{forestSummary}</Field> : null}

          {parcel.gisAcreage || parcel.taxAcreage || parcel.acreage ? (
            <Field label="Acreage">
              <div className="space-y-0.5 text-[var(--color-text-secondary)]">
                {parcel.gisAcreage ? (
                  <div>GIS: {formatAcres(parcel.gisAcreage)}</div>
                ) : parcel.acreage ? (
                  <div>{formatAcres(parcel.acreage)}</div>
                ) : null}
                {parcel.taxAcreage ? (
                  <div>Tax book: {formatAcres(parcel.taxAcreage)}</div>
                ) : null}
              </div>
            </Field>
          ) : null}
        </dl>
      ) : null}

      {parcel?.warnings && parcel.warnings.length > 0 ? (
        <div className="mt-3 space-y-1">
          {parcel.warnings.map((warning) => (
            <p
              key={warning.code}
              className={`text-xs ${warning.severity === "warn" ? "text-amber-800" : "text-[var(--color-text-secondary)]"}`}
            >
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}

      {parcel ? (
        <div className="mt-3 border-t border-[var(--color-border)] pt-2">
          <button
            type="button"
            onClick={() => setDataQualityOpen((v) => !v)}
            className="flex w-full items-center justify-between py-1 text-left text-xs font-medium text-[var(--color-text-primary)]"
            aria-expanded={dataQualityOpen}
          >
            Data quality
            <span>{dataQualityOpen ? "−" : "+"}</span>
          </button>
          {dataQualityOpen ? (
            <div className="space-y-1 pt-1 text-xs text-[var(--color-text-secondary)]">
              {parcel.joinMethod && parcel.joinMethod !== "unjoined" ? (
                <p>
                  Join method: {parcel.joinMethod.replace(/_/g, " ")}
                  {parcel.joinConfidence != null
                    ? ` · confidence ${Math.round(parcel.joinConfidence * 100)}%`
                    : ""}
                </p>
              ) : (
                <p>Tax record not joined to this parcel geometry.</p>
              )}
              {parcel.acreageDiscrepancy ? (
                <p>GIS and tax-book acreage disagree (not resolved).</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {parcel?.taxSource && parcel.ownerName ? (
        <div className="mt-4 space-y-1 border-t border-[var(--color-border)] pt-3">
          <SourceCitation label="Tax / ownership" source={parcel.taxSource} />
          <SourceCitation label="Parcel boundary" source={parcel.geometrySource} />
        </div>
      ) : parcel ? (
        <div className="mt-4 space-y-1 border-t border-[var(--color-border)] pt-3">
          <SourceCitation label="Parcel boundary" source={parcel.geometrySource} />
        </div>
      ) : null}

      <div className="mt-3 border-t border-[var(--color-border)] pt-3">
        <PublicDisclaimer compact />
      </div>
    </aside>
  );
}
