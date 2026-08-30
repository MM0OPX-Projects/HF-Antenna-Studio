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
const NEC_NULL_GAIN_DBI = -999.99;

function isValidSample(point: GainPatternPoint): boolean {
  return Number.isFinite(point.gainDbi) && Number.isFinite(point.normalizedDb) && point.gainDbi > -900;
}

/**
 * Complete a plotted 0–180° elevation plane when NEC returned an exact
 * horizon null which an upstream normaliser omitted.
 *
 * The inserted points are display-only NEC-null sentinels at the plot floor.
 * Their gain remains invalid, so `gainAtAngle` will never report or
 * interpolate a made-up horizon value. Only one missing grid interval at
 * either boundary is completed; larger data gaps are left visibly open.
 */
export function withElevationHorizonFloorPoints(
  points: GainPatternPoint[],
): GainPatternPoint[] {
  const sorted = points
    .filter((point) => Number.isFinite(point.angleDeg) && point.angleDeg >= 0 && point.angleDeg <= 180)
    .sort((left, right) => left.angleDeg - right.angleDeg);
  if (sorted.length < 2) return sorted;

  const positiveSteps = sorted.slice(1)
    .map((point, index) => point.angleDeg - sorted[index]!.angleDeg)
    .filter((step) => step > EXACT_TOLERANCE_DEG);
  if (positiveSteps.length === 0) return sorted;
  const gridStep = Math.min(...positiveSteps);
  const boundaryTolerance = gridStep * 1.01 + EXACT_TOLERANCE_DEG;
  const floorPoint = (angleDeg: 0 | 180): GainPatternPoint => ({
    angleDeg,
    gainDbi: NEC_NULL_GAIN_DBI,
    normalizedDb: -40,
  });

  const completed = [...sorted];
  if (completed[0]!.angleDeg > EXACT_TOLERANCE_DEG && completed[0]!.angleDeg <= boundaryTolerance) {
    completed.unshift(floorPoint(0));
  }
  const finalAngle = completed[completed.length - 1]!.angleDeg;
  if (finalAngle < 180 - EXACT_TOLERANCE_DEG && 180 - finalAngle <= boundaryTolerance) {
    completed.push(floorPoint(180));
  }
  return completed;
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
