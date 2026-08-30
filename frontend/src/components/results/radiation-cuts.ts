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

/** Select one real NEC theta row and expose it as a complete 360° cut. */
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
  let thetaIndex = strongest.thetaIndex;
  if (requestedElevationDeg !== undefined) {
    const requestedTheta = 90 - requested;
    let distance = Infinity;
    for (let index = 0; index < pattern.theta_count; index += 1) {
      const theta = pattern.theta_start + index * pattern.theta_step;
      const candidateDistance = Math.abs(theta - requestedTheta);
      if (candidateDistance < distance) {
        thetaIndex = index;
        distance = candidateDistance;
      }
    }
  }
  const theta = pattern.theta_start + thetaIndex * pattern.theta_step;
  const points = normalize(Array.from({ length: pattern.phi_count }, (_, phiIndex) => ({
    angleDeg: bearingForPhi(pattern.phi_start + phiIndex * pattern.phi_step, convention),
    gainDbi: pattern.gain_dbi[thetaIndex]?.[phiIndex] ?? -999.99,
  })).sort((left, right) => left.angleDeg - right.angleDeg));
  return {
    points,
    requestedElevationDeg: requested,
    actualElevationDeg: Math.max(0, Math.min(90, 90 - (requestedElevationDeg === undefined ? Math.abs(theta) : theta))),
    thetaIndex,
  };
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
  const bestPhiDeg = pattern.phi_start + bestPhiIndex * pattern.phi_step;
  const elevation = normalize(extractFullElevationCut(pattern, bestPhiDeg));
  const necThetaDeg = pattern.theta_start + bestThetaIndex * pattern.theta_step;

  return {
    azimuth: series(azimuth),
    elevation: series(elevation),
    azimuthElevationDeg: Math.max(0, Math.min(90, 90 - Math.abs(necThetaDeg))),
    elevationBearingDeg: compassBearing(bestPhiDeg),
  };
}
