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
  let bestThetaIndex = 0;
  let bestPhiIndex = 0;
  let bestGain = -Infinity;
  for (let thetaIndex = 0; thetaIndex < pattern.theta_count; thetaIndex += 1) {
    for (let phiIndex = 0; phiIndex < pattern.phi_count; phiIndex += 1) {
      const gain = pattern.gain_dbi[thetaIndex]?.[phiIndex] ?? -999.99;
      if (validGain(gain) && gain > bestGain) {
        bestGain = gain;
        bestThetaIndex = thetaIndex;
        bestPhiIndex = phiIndex;
      }
    }
  }
  if (!Number.isFinite(bestGain)) {
    return { azimuth: [], elevation: [], azimuthElevationDeg: 0, elevationBearingDeg: 0 };
  }

  const id = options.id ?? "current";
  const label = options.label ?? "Current solved model";
  const color = options.color ?? "#f97316";
  const series = (points: NormalizedPatternPoint[]): PolarSeries[] => points.length > 0
    ? [{ id, label, color, points, current: true }]
    : [];
  const azimuth = normalize(Array.from({ length: pattern.phi_count }, (_, phiIndex) => ({
    angleDeg: compassBearing(pattern.phi_start + phiIndex * pattern.phi_step),
    gainDbi: pattern.gain_dbi[bestThetaIndex]?.[phiIndex] ?? -999.99,
  })).sort((left, right) => left.angleDeg - right.angleDeg));
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
