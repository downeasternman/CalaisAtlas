"use client";

import type { ReactNode } from "react";
import type { ParcelWithSources } from "@/lib/types/parcel";
import { CONFIDENCE_LABELS, scoreToLevel } from "@/lib/tax/confidence";
import { forestEnrollmentFromAttrs } from "@/lib/tax/tree-growth";
import { isValidAccountNumber } from "@/lib/tax/owner-validate";
import { SourceCitation } from "@/components/source/SourceCitation";

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

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
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
  if (!loading && !parcel && !error) return null;

  const confidenceLevel = scoreToLevel(parcel?.joinConfidence ?? null);
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

  const percentileLabel =
    parcel?.valuePct != null && parcel.valuePct >= 0
      ? `${
          parcel.cohort === 1
            ? "Improved"
            : parcel.cohort === 0
              ? "Unimproved"
              : "Cohort"
        } $/acre · ${formatOrdinalPercentile(parcel.valuePct)}`
      : null;

  return (
    <aside
      className="parcel-detail-panel motion-slide-up absolute bottom-4 left-4 z-20 w-[min(100%,22rem)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/95 p-4 shadow-lg backdrop-blur-sm"
      aria-label="Parcel details"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-fraunces)] text-lg text-[var(--color-ocean-deep)]">
            {parcel?.mapLot ?? "Parcel"}
          </h2>
          {parcel?.municipalityName ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {parcel.municipalityName}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-land-paper)]"
          aria-label="Close parcel details"
        >
          Close
        </button>
      </div>

      {loading ? <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {parcel && !loading ? (
        <dl className="space-y-3">
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
                {parcel.taxYear && !parcel.taxAmount
                  ? ` (${parcel.taxYear})`
                  : ""}
              </span>
              {parcel.valuePerAcre != null && parcel.valuePerAcre > 0 ? (
                <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {formatCurrency(String(Math.round(parcel.valuePerAcre)))}/acre (GIS)
                  {percentileLabel ? ` · ${percentileLabel}` : ""}
                </div>
              ) : percentileLabel ? (
                <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {percentileLabel}
                </div>
              ) : null}
              {parcel.fullyExempt ? (
                <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  Tax-exempt
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
                {parcel.acreageDiscrepancy ? (
                  <div className="text-[10px] italic">
                    GIS and tax-book acreage disagree (not resolved)
                  </div>
                ) : null}
              </div>
            </Field>
          ) : null}
        </dl>
      ) : null}

      {parcel?.joinMethod && parcel.joinMethod !== "unjoined" && parcel.ownerName ? (
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
          {parcel.assessedTotalValue ? CONFIDENCE_LABELS[confidenceLevel] : null}
          {parcel.joinMethod === "map_lot" && parcel.territoryType === "organized"
            ? " · joined via map/lot"
            : ""}
          {parcel.joinMethod === "map_lot_parent"
            ? " · tax record matched via parent map/lot"
            : ""}
          {parcel.joinMethod === "property_id"
            ? " · joined via property ID + map/lot index"
            : ""}
          {parcel.joinMethod === "property_card"
            ? " · owner from 2023 property card (backup)"
            : ""}
        </p>
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
    </aside>
  );
}
