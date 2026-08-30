export interface GainPatternPoint {
  angleDeg: number;
  gainDbi: number;
  normalizedDb: number;
}

export interface GainAtAngleReading {
  requestedAngleDeg: number;
  gainDbi: number;
  normalizedDb: number;
  peakGainDbi: number;
  method: "exact" | "interpolated";
  lowerAngleDeg: number;
  upperAngleDeg: number;
}

const EXACT_TOLERANCE_DEG = 1e-6;

function isValidSample(point: GainPatternPoint): boolean {
  return Number.isFinite(point.gainDbi) && Number.isFinite(point.normalizedDb) && point.gainDbi > -900;
}

/**
 * Read a far-field cut at a 0–180° elevation-plane angle.
 *
 * NEC samples are returned unchanged. Values between samples use linear
 * interpolation in decibels and are explicitly identified as interpolated;
 * callers must not present them as additional NEC solves.
 */
export function gainAtAngle(
  points: GainPatternPoint[],
  requestedAngleDeg: number,
): GainAtAngleReading | null {
  if (!Number.isFinite(requestedAngleDeg)) return null;

  const sorted = points
    .filter((point) => Number.isFinite(point.angleDeg))
    .sort((left, right) => left.angleDeg - right.angleDeg)
    .filter((point, index, all) => index === 0 || Math.abs(point.angleDeg - all[index - 1]!.angleDeg) > EXACT_TOLERANCE_DEG);
  const valid = sorted.filter(isValidSample);
  const peakGainDbi = valid.length > 0 ? Math.max(...valid.map((point) => point.gainDbi)) : -Infinity;

  const exact = sorted.find((point) => Math.abs(point.angleDeg - requestedAngleDeg) <= EXACT_TOLERANCE_DEG);
  if (exact && isValidSample(exact)) {
    return {
      requestedAngleDeg,
      gainDbi: exact.gainDbi,
      normalizedDb: exact.normalizedDb,
      peakGainDbi,
      method: "exact",
      lowerAngleDeg: exact.angleDeg,
      upperAngleDeg: exact.angleDeg,
    };
  }

  const upperIndex = sorted.findIndex((point) => point.angleDeg > requestedAngleDeg);
  if (upperIndex <= 0) return null;
  const lower = sorted[upperIndex - 1]!;
  const upper = sorted[upperIndex]!;
  if (!isValidSample(lower) || !isValidSample(upper)) return null;
  const span = upper.angleDeg - lower.angleDeg;
  if (span <= EXACT_TOLERANCE_DEG) return null;
  const fraction = (requestedAngleDeg - lower.angleDeg) / span;

  return {
    requestedAngleDeg,
    gainDbi: lower.gainDbi + (upper.gainDbi - lower.gainDbi) * fraction,
    normalizedDb: lower.normalizedDb + (upper.normalizedDb - lower.normalizedDb) * fraction,
    peakGainDbi,
    method: "interpolated",
    lowerAngleDeg: lower.angleDeg,
    upperAngleDeg: upper.angleDeg,
  };
}

export function clampElevationAngle(angleDeg: number): number {
  return Math.min(180, Math.max(0, angleDeg));
}
