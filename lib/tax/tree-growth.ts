export interface ForestEnrollment {
  softAcres: number | null;
  mixedAcres: number | null;
  hardAcres: number | null;
  softValue: number | null;
  mixedValue: number | null;
  hardValue: number | null;
}

const FOREST_LINE_RE =
  /^(Soft|Mixed|Hard):\s*([\d,]+(?:\.\d+)?)(?:\s+([\d,]+(?:\.\d+)?))?/i;
const TREE_GROWTH_TEXT_RE = /tree\s*growth/i;

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function emptyEnrollment(): ForestEnrollment {
  return {
    softAcres: null,
    mixedAcres: null,
    hardAcres: null,
    softValue: null,
    mixedValue: null,
    hardValue: null,
  };
}

export function parseForestEnrollmentFromLines(lines: string[]): ForestEnrollment {
  const enrollment = emptyEnrollment();

  for (const line of lines) {
    const match = line.trim().match(FOREST_LINE_RE);
    if (!match) continue;

    const kind = match[1]!.toLowerCase();
    const acres = parseNumber(match[2]);
    const value = parseNumber(match[3]);

    if (kind === "soft") {
      enrollment.softAcres = acres;
      enrollment.softValue = value;
    } else if (kind === "mixed") {
      enrollment.mixedAcres = acres;
      enrollment.mixedValue = value;
    } else if (kind === "hard") {
      enrollment.hardAcres = acres;
      enrollment.hardValue = value;
    }
  }

  return enrollment;
}

export function hasTreeGrowthEnrollment(
  enrollment: ForestEnrollment | null | undefined,
  extraText?: string | null,
): boolean {
  if (extraText && TREE_GROWTH_TEXT_RE.test(extraText)) return true;
  if (!enrollment) return false;

  const signals = [
    enrollment.softAcres,
    enrollment.mixedAcres,
    enrollment.hardAcres,
    enrollment.softValue,
    enrollment.mixedValue,
    enrollment.hardValue,
  ];

  return signals.some((value) => value != null && value > 0);
}

export function forestEnrollmentFromAttrs(
  attrsRaw: Record<string, unknown> | null | undefined,
): ForestEnrollment | null {
  const raw = attrsRaw?.forestEnrollment;
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  return {
    softAcres: typeof record.softAcres === "number" ? record.softAcres : null,
    mixedAcres: typeof record.mixedAcres === "number" ? record.mixedAcres : null,
    hardAcres: typeof record.hardAcres === "number" ? record.hardAcres : null,
    softValue: typeof record.softValue === "number" ? record.softValue : null,
    mixedValue: typeof record.mixedValue === "number" ? record.mixedValue : null,
    hardValue: typeof record.hardValue === "number" ? record.hardValue : null,
  };
}
