"use client";

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

function formatCurrency(value: string | null): string | null {
  if (!value) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
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

export function ParcelDetailPanel({
  parcel,
  loading,
  error,
  onClose,
}: ParcelDetailPanelProps) {
  if (!loading && !parcel && !error) return null;

  const confidenceLevel = scoreToLevel(parcel?.joinConfidence ?? null);
  const forestSummary = parcel ? formatForestEnrollment(parcel) : null;
  const homesteadLabel = parcel?.attrsRaw?.homesteadLabel === true;

  return (
    <aside
      className="parcel-detail-panel motion-slide-up absolute bottom-4 left-4 z-20 w-[min(100%,22rem)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/95 p-4 shadow-lg backdrop-blur-sm"
      aria-label="Parcel details"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-fraunces)] text-lg text-[var(--color-ocean-deep)]">
            Parcel
          </h2>
          {parcel?.municipalityName ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {parcel.municipalityName}
              {parcel.taxMunicipalityName &&
              parcel.taxMunicipalityName !== parcel.municipalityName ? (
                <span className="block text-xs">
                  Tax jurisdiction: {parcel.taxMunicipalityName}
                </span>
              ) : null}
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
        <dl className="space-y-2 text-sm">
          {parcel.mapLot ? (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Map / lot</dt>
              <dd className="font-medium">{parcel.mapLot}</dd>
            </div>
          ) : null}
          {parcel.tpl ? (
            <div>
              <dt className="text-[var(--color-text-secondary)]">TPL</dt>
              <dd className="font-mono text-xs">{parcel.tpl}</dd>
            </div>
          ) : null}
          {parcel.accountNumber &&
          (isValidAccountNumber(parcel.accountNumber) ||
            isUtAccountNumber(parcel.accountNumber)) ? (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Account</dt>
              <dd className="font-mono text-xs">{parcel.accountNumber}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[var(--color-text-secondary)]">Owner</dt>
            <dd className="font-medium">
              {parcel.ownerName ?? (
                <span className="font-normal text-[var(--color-text-secondary)]">
                  Not available from tax source
                </span>
              )}
            </dd>
            {parcel.mailAddress ? (
              <dd className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {parcel.mailAddress}
              </dd>
            ) : null}
            {parcel.attrsRaw?.situsLabel &&
            typeof parcel.attrsRaw.situsLabel === "string" ? (
              <dd className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Location label (tax book): {parcel.attrsRaw.situsLabel}
              </dd>
            ) : null}
          </div>
          {parcel.assessedTotalValue ? (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Assessed total</dt>
              <dd className="font-medium">
                {formatCurrency(parcel.assessedTotalValue)}
                {parcel.taxYear ? ` (${parcel.taxYear})` : ""}
              </dd>
            </div>
          ) : parcel.ownerName ? (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Assessed total</dt>
              <dd className="font-normal text-[var(--color-text-secondary)]">
                Not available from tax source
              </dd>
            </div>
          ) : null}
          {parcel.assessedLandValue || parcel.assessedBuildingValue ? (
            <div className="grid grid-cols-2 gap-2">
              {parcel.assessedLandValue ? (
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Land</dt>
                  <dd>{formatCurrency(parcel.assessedLandValue)}</dd>
                </div>
              ) : null}
              {parcel.assessedBuildingValue ? (
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Building</dt>
                  <dd>{formatCurrency(parcel.assessedBuildingValue)}</dd>
                </div>
              ) : null}
            </div>
          ) : null}
          {parcel.assessedExemptionValue ? (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Tax exemption</dt>
              <dd className="font-medium">
                {formatCurrency(parcel.assessedExemptionValue)}
                {homesteadLabel ? (
                  <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">
                    (homestead)
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {forestSummary ? (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Tree Growth</dt>
              <dd>{forestSummary}</dd>
            </div>
          ) : null}
          {parcel.taxAmount ? (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Tax billed</dt>
              <dd>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 2,
                }).format(Number(parcel.taxAmount))}
              </dd>
            </div>
          ) : null}
          {parcel.gisAcreage || parcel.taxAcreage || parcel.acreage ? (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Acreage</dt>
              <dd>
                {parcel.gisAcreage ? (
                  <span>GIS: {formatAcres(parcel.gisAcreage)}</span>
                ) : parcel.acreage ? (
                  <span>{formatAcres(parcel.acreage)}</span>
                ) : null}
                {parcel.taxAcreage ? (
                  <span className="block text-xs text-[var(--color-text-secondary)]">
                    Tax book: {formatAcres(parcel.taxAcreage)}
                  </span>
                ) : null}
                {parcel.acreageDiscrepancy ? (
                  <span className="block text-xs text-[var(--color-text-secondary)]">
                    GIS and tax-book acreage disagree (not resolved)
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {typeof parcel.attrsRaw?.lotCountInGroup === "number" &&
          parcel.attrsRaw.lotCountInGroup > 1 ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Multi-lot valuation: full assessment copied to each of{" "}
              {parcel.attrsRaw.lotCountInGroup} lots (not allocated by acreage).
            </p>
          ) : null}
        </dl>
      ) : null}

      {parcel?.joinMethod && parcel.joinMethod !== "unjoined" && parcel.ownerName ? (
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
          {parcel.assessedTotalValue ? CONFIDENCE_LABELS[confidenceLevel] : null}
          {parcel.joinMethod === "property_id" ? " · joined via property ID + map/lot index" : ""}
          {parcel.joinMethod === "map_lot" && parcel.territoryType === "organized"
            ? " · joined via map/lot"
            : ""}
          {parcel.joinMethod === "map_lot_parent"
            ? " · tax record matched via parent map/lot"
            : ""}
        </p>
      ) : null}

      {parcel?.territoryType !== "organized" &&
      parcel?.tpl?.toUpperCase().startsWith("WAP") &&
      !parcel.assessedTotalValue ? (
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
          This parcel uses WAP plat numbering. Tax data from the state valuation book uses WA
          map sheets — see Day Block or related divisions for matching ownership records.
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
