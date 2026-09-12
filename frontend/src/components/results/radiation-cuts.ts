import type { PatternData } from "../../api/nec";
import type { PolarSeries } from "../../features/height-lab/HeightPolarPlot";
import type { NormalizedPatternPoint } from "../../features/verified-dipole/result";
import { extractFullElevationCut } from "./full-elevation-cut";

export interface RadiationCutSeries {
  azimuth: PolarSeries[];
  elevation: PolarSeries[];
  azimuthElevationDeg: number;
  elevationBearingDeg: number;
}

export type AzimuthBearingConvention = "nec-phi" | "compass" | "legacy-compass";

export interface AzimuthCutSample {
  points: NormalizedPatternPoint[];
  requestedElevationDeg: number;
  actualElevationDeg: number;
  thetaIndex: number;
  method: "exact" | "interpolated";
  lowerElevationDeg: number;
  upperElevationDeg: number;
  /** Bearing of the strongest valid sample in this selected cut. */
  peakBearingDeg: number | null;
  peakGainDbi: number | null;
}

function validGain(gain: number): boolean {
  return Number.isFinite(gain) && gain > -900;
}

function normalize(points: Array<{ angleDeg: number; gainDbi: number }>): NormalizedPatternPoint[] {
  const valid = points.filter((point) => validGain(point.gainDbi));
  if (valid.length === 0) return [];
  const maximum = Math.max(...valid.map((point) => point.gainDbi));
  return valid.map((point) => ({
    ...point,
    normalizedDb: Math.max(-40, point.gainDbi - maximum),
  }));
}

function compassBearing(phiDeg: number): number {
  return ((-90 - phiDeg) % 360 + 360) % 360;
}

function bearingForPhi(phiDeg: number, convention: AzimuthBearingConvention): number {
  if (convention === "nec-phi") return ((phiDeg % 360) + 360) % 360;
  if (convention === "compass") return ((90 - phiDeg) % 360 + 360) % 360;
  return compassBearing(phiDeg);
}

function strongestGridPoint(pattern: PatternData): { thetaIndex: number; phiIndex: number; gainDbi: number } | null {
  let thetaIndex = 0;
  let phiIndex = 0;
  let gainDbi = -Infinity;
  for (let ti = 0; ti < pattern.theta_count; ti += 1) {
    const theta = pattern.theta_start + ti * pattern.theta_step;
    // Standard workspace cuts describe the physical upper hemisphere only.
    if (Math.abs(theta) > 90 + 1e-6) continue;
    for (let pi = 0; pi < pattern.phi_count; pi += 1) {
      const candidate = pattern.gain_dbi[ti]?.[pi] ?? -999.99;
      if (validGain(candidate) && candidate > gainDbi) {
        gainDbi = candidate;
        thetaIndex = ti;
        phiIndex = pi;
      }
    }
  }
  return Number.isFinite(gainDbi) ? { thetaIndex, phiIndex, gainDbi } : null;
}

function nearestCanonicalThetaIndex(pattern: PatternData, physicalThetaDeg: number): number {
  const target = Math.abs(physicalThetaDeg);
  let selected = 0;
  let selectedTheta = pattern.theta_start;
  let distance = Infinity;
  for (let index = 0; index < pattern.theta_count; index += 1) {
    const theta = pattern.theta_start + index * pattern.theta_step;
    if (theta < -1e-6 || theta > 90 + 1e-6) continue;
    const candidateDistance = Math.abs(theta - target);
    if (candidateDistance < distance) {
      selected = index;
      selectedTheta = theta;
      distance = candidateDistance;
    }
  }
  if (Number.isFinite(distance)) return selected;

  // Some imported grids contain signed theta only. Retain support and let the
  // caller rotate phi by 180 degrees to preserve the physical bearing.
  for (let index = 0; index < pattern.theta_count; index += 1) {
    const theta = pattern.theta_start + index * pattern.theta_step;
    const candidateDistance = Math.abs(Math.abs(theta) - target);
    if (candidateDistance < distance || (candidateDistance === distance && theta > selectedTheta)) {
      selected = index;
      selectedTheta = theta;
      distance = candidateDistance;
    }
  }
  return selected;
}

function physicalPhiDeg(thetaDeg: number, phiDeg: number): number {
  return thetaDeg < -1e-6 ? phiDeg + 180 : phiDeg;
}

function interpolatedThetaGain(pattern: PatternData, requestedThetaDeg: number, phiIndex: number): number | null {
  const rows = Array.from({ length: pattern.theta_count }, (_, index) => ({
    index,
    theta: pattern.theta_start + index * pattern.theta_step,
  })).filter((row) => row.theta >= -1e-6 && row.theta <= 90 + 1e-6);
  if (rows.length === 0) return null;
  const exact = rows.find((row) => Math.abs(row.theta - requestedThetaDeg) <= 1e-6);
  if (exact) {
    const gain = pattern.gain_dbi[exact.index]?.[phiIndex] ?? -999.99;
    return validGain(gain) ? gain : null;
  }
  const upper = rows.find((row) => row.theta > requestedThetaDeg);
  const lower = upper ? rows[rows.indexOf(upper) - 1] : undefined;
  if (!lower || !upper) return null;
  const lowerGain = pattern.gain_dbi[lower.index]?.[phiIndex] ?? -999.99;
  const upperGain = pattern.gain_dbi[upper.index]?.[phiIndex] ?? -999.99;
  if (!validGain(lowerGain) || !validGain(upperGain)) return null;
  const fraction = (requestedThetaDeg - lower.theta) / (upper.theta - lower.theta);
  return lowerGain + (upperGain - lowerGain) * fraction;
}

/** Select/interpolate a NEC theta row and expose it as a complete 360° cut. */
export function azimuthCutFromPattern(
  pattern: PatternData,
  requestedElevationDeg?: number,
  convention: AzimuthBearingConvention = "nec-phi",
): AzimuthCutSample | null {
  const strongest = strongestGridPoint(pattern);
  if (!strongest) return null;
  const requested = requestedElevationDeg === undefined
    ? Math.max(0, Math.min(90, 90 - Math.abs(pattern.theta_start + strongest.thetaIndex * pattern.theta_step)))
    : Math.max(0, Math.min(90, requestedElevationDeg));
  const requestedThetaDeg = 90 - requested;
  const thetaIndex = nearestCanonicalThetaIndex(pattern, requestedThetaDeg);
  const theta = pattern.theta_start + thetaIndex * pattern.theta_step;
  const exactRow = Math.abs(theta - requestedThetaDeg) <= 1e-6;
  const surroundingRows = Array.from({ length: pattern.theta_count }, (_, index) => pattern.theta_start + index * pattern.theta_step)
    .filter((value) => value >= -1e-6 && value <= 90 + 1e-6)
    .sort((left, right) => left - right);
  const lowerRows = surroundingRows.filter((value) => value <= requestedThetaDeg + 1e-6);
  const lowerTheta = lowerRows[lowerRows.length - 1] ?? theta;
  const upperTheta = surroundingRows.find((value) => value >= requestedThetaDeg - 1e-6) ?? theta;
  const method = requestedElevationDeg !== undefined && !exactRow && surroundingRows.length > 0 && Math.abs(lowerTheta - upperTheta) > 1e-6 ? "interpolated" : "exact";
  const rowTheta = method === "interpolated" ? requestedThetaDeg : theta;
  const interpolation = method === "interpolated";
  const points = normalize(Array.from({ length: pattern.phi_count }, (_, phiIndex) => ({
    angleDeg: bearingForPhi(physicalPhiDeg(rowTheta, pattern.phi_start + phiIndex * pattern.phi_step), convention),
    gainDbi: interpolation
      ? interpolatedThetaGain(pattern, requestedThetaDeg, phiIndex) ?? -999.99
      : pattern.gain_dbi[thetaIndex]?.[phiIndex] ?? -999.99,
  })).sort((left, right) => left.angleDeg - right.angleDeg));
  const peak = points.reduce<NormalizedPatternPoint | null>((best, point) => !best || point.gainDbi > best.gainDbi ? point : best, null);
  return {
    points,
    requestedElevationDeg: requested,
    actualElevationDeg: method === "interpolated" ? requested : Math.max(0, Math.min(90, 90 - Math.abs(theta))),
    thetaIndex,
    method,
    lowerElevationDeg: 90 - upperTheta,
    upperElevationDeg: 90 - lowerTheta,
    peakBearingDeg: peak?.angleDeg ?? null,
    peakGainDbi: peak?.gainDbi ?? null,
  };
}

/** Convert a displayed compass bearing to the NEC phi convention used by the cuts. */
export function necPhiForBearing(bearingDeg: number, convention: AzimuthBearingConvention = "legacy-compass"): number {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  if (convention === "nec-phi") return normalized;
  if (convention === "compass") return ((90 - normalized) % 360 + 360) % 360;
  return ((-90 - normalized) % 360 + 360) % 360;
}

/** Build a normalised vertical cut through a requested displayed bearing. */
export function elevationCutFromPattern(
  pattern: PatternData,
  bearingDeg: number,
  convention: AzimuthBearingConvention = "legacy-compass",
): NormalizedPatternPoint[] {
  return normalize(extractFullElevationCut(pattern, necPhiForBearing(bearingDeg, convention)));
}

/**
 * Derive the two standard workspace cuts from a solved NEC far-field grid.
 * The azimuth cut uses the elevation row containing the grid maximum. The
 * elevation cut uses that maximum's bearing and the real opposite-bearing
 * samples; it is never mirrored from the primary hemisphere.
 */
export function radiationCutSeriesFromPattern(
  pattern: PatternData,
  options: { id?: string; label?: string; color?: string } = {},
): RadiationCutSeries {
  const strongest = strongestGridPoint(pattern);
  if (!strongest) {
    return { azimuth: [], elevation: [], azimuthElevationDeg: 0, elevationBearingDeg: 0 };
  }
  const { thetaIndex: bestThetaIndex, phiIndex: bestPhiIndex } = strongest;

  const id = options.id ?? "current";
  const label = options.label ?? "Current solved model";
  const color = options.color ?? "#f97316";
  const series = (points: NormalizedPatternPoint[]): PolarSeries[] => points.length > 0
    ? [{ id, label, color, points, current: true }]
    : [];
  const azimuth = azimuthCutFromPattern(pattern, undefined, "legacy-compass")?.points ?? [];
  const bestThetaDeg = pattern.theta_start + bestThetaIndex * pattern.theta_step;
  const bestPhiDeg = physicalPhiDeg(bestThetaDeg, pattern.phi_start + bestPhiIndex * pattern.phi_step);
  const elevation = normalize(extractFullElevationCut(pattern, bestPhiDeg));
  const necThetaDeg = bestThetaDeg;

  return {
    azimuth: series(azimuth),
    elevation: series(elevation),
    azimuthElevationDeg: Math.max(0, Math.min(90, 90 - Math.abs(necThetaDeg))),
    elevationBearingDeg: compassBearing(bestPhiDeg),
  };
}
