import { slugify } from "@/lib/geo/slug";

const STREET_SUFFIXES = new Set([
  "LN",
  "RD",
  "ST",
  "AVE",
  "DR",
  "ROUTE",
  "RTE",
  "HWY",
  "HIGHWAY",
  "CT",
  "CIR",
  "WAY",
  "PKWY",
]);

/**
 * Infer tax municipality slug from a valuation-book mail address line.
 */
export function mailMunicipalityHintFromAddress(mailAddress: string | null): string | null {
  if (!mailAddress) return null;
  const upper = mailAddress.toUpperCase().replace(/,/g, " ");
  const tokens = upper.split(/\s+/).filter(Boolean);

  const pltIdx = tokens.lastIndexOf("PLT");
  if (pltIdx > 0) {
    const nameParts: string[] = [];
    for (let i = pltIdx - 1; i >= 0; i--) {
      const token = tokens[i];
      if (/^\d/.test(token) || STREET_SUFFIXES.has(token)) break;
      nameParts.unshift(token);
      if (nameParts.length >= 4) break;
    }
    if (nameParts.length > 0) {
      return slugify(`${nameParts.join(" ")} Plt`);
    }
  }

  const twpIdx = tokens.lastIndexOf("TWP");
  if (twpIdx > 0) {
    const nameParts: string[] = [];
    for (let i = twpIdx - 1; i >= 0; i--) {
      const token = tokens[i];
      if (/^\d/.test(token) || STREET_SUFFIXES.has(token)) break;
      nameParts.unshift(token);
      if (nameParts.length >= 4) break;
    }
    if (nameParts.length > 0) {
      return slugify(`${nameParts.join(" ")} Twp`);
    }
  }

  const bpp = upper.match(/\b(T\d+\s+[A-Z]+\s+BPP)\b/);
  if (bpp) return slugify(bpp[1]);

  const nbpp = upper.match(/\b(T\d+\s+R\d+\s+NBPP)\b/);
  if (nbpp) return slugify(nbpp[1]);

  return null;
}
