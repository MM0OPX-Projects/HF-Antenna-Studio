import type { PatternData } from "../../api/nec";
import type { ComparisonPatternPoint } from "./types";
import { extractFullElevationCut } from "../../components/results/full-elevation-cut";

export function normalizeBearing(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** Matches the compass convention used by the Wire Editor and 3D viewport. */
export function compassBearingForPhi(phiDeg: number): number {
  return normalizeBearing(-90 - phiDeg);
}

function phiForCompassBearing(bearingDeg: number): number {
  return normalizeBearing(-90 - bearingDeg);
}

function angularDistance(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function normalize(points: Array<{ angleDeg: number; gainDbi: number }>): ComparisonPatternPoint[] {
  const finite = points.filter((point) => Number.isFinite(point.gainDbi) && point.gainDbi > -999);
  if (finite.length === 0) throw new Error("The requested comparison cut contains no finite gain samples.");
  const maximum = Math.max(...finite.map((point) => point.gainDbi));
  return finite.map((point) => ({ ...point, normalizedDb: Math.max(-40, point.gainDbi - maximum) }));
}

function nearestIndex(start: number, step: number, count: number, target: number, circular: boolean): number {
  let selected = 0; let distance = Infinity;
  for (let index = 0; index < count; index += 1) {
    const candidate = start + index * step;
    const delta = circular ? angularDistance(candidate, target) : Math.abs(candidate - target);
    if (delta < distance) { selected = index; distance = delta; }
  }
  return selected;
}

/** Extract matching cuts in compass coordinates: 0° north/+Y, 90° east/+X. */
export function extractComparisonCuts(pattern: PatternData, azimuthElevationDeg: number, elevationBearingDeg: number): { azimuth: ComparisonPatternPoint[]; elevation: ComparisonPatternPoint[]; actualAzimuthElevationDeg: number; actualElevationBearingDeg: number } {
  const requestedTheta = 90 - azimuthElevationDeg;
  const thetaIndex = nearestIndex(pattern.theta_start, pattern.theta_step, pattern.theta_count, requestedTheta, false);
  const requestedPhi = phiForCompassBearing(elevationBearingDeg);
  const phiIndex = nearestIndex(pattern.phi_start, pattern.phi_step, pattern.phi_count, requestedPhi, true);
  const azimuth = normalize(Array.from({ length: pattern.phi_count }, (_, index) => ({
    angleDeg: normalizeBearing(90 - (pattern.phi_start + index * pattern.phi_step)),
    gainDbi: pattern.gain_dbi[thetaIndex]?.[index] ?? -999.99,
  })).sort((a, b) => a.angleDeg - b.angleDeg));
  const actualPhiDeg = pattern.phi_start + phiIndex * pattern.phi_step;
  const elevation = normalize(extractFullElevationCut(pattern, actualPhiDeg));
  return {
    azimuth,
    elevation,
    actualAzimuthElevationDeg: 90 - (pattern.theta_start + thetaIndex * pattern.theta_step),
    actualElevationBearingDeg: compassBearingForPhi(pattern.phi_start + phiIndex * pattern.phi_step),
  };
}

/** Return the compass bearing of the strongest valid solved pattern sample. */
export function strongestComparisonBearing(pattern: PatternData): number {
  let bestGain = -Infinity;
  let bestPhiIndex = 0;
  for (let thetaIndex = 0; thetaIndex < pattern.theta_count; thetaIndex += 1) {
    for (let phiIndex = 0; phiIndex < pattern.phi_count; phiIndex += 1) {
      const gain = pattern.gain_dbi[thetaIndex]?.[phiIndex] ?? -999.99;
      if (Number.isFinite(gain) && gain > bestGain) {
        bestGain = gain;
        bestPhiIndex = phiIndex;
      }
    }
  }
  if (!Number.isFinite(bestGain) || bestGain <= -900) throw new Error("The solved pattern contains no valid gain samples.");
  return compassBearingForPhi(pattern.phi_start + bestPhiIndex * pattern.phi_step);
}

export function circularPatternMetrics(points: ComparisonPatternPoint[]): { frontToBackDb: number | null; beamwidthDeg: number | null } {
  if (points.length < 4) return { frontToBackDb: null, beamwidthDeg: null };
  const peakIndex = points.reduce((best, point, index) => point.gainDbi > points[best]!.gainDbi ? index : best, 0);
  const peak = points[peakIndex]!;
  const rear = points.reduce((best, point) => angularDistance(point.angleDeg, normalizeBearing(peak.angleDeg + 180)) < angularDistance(points[best]!.angleDeg, normalizeBearing(peak.angleDeg + 180)) ? points.indexOf(point) : best, 0);
  const threshold = peak.gainDbi - 3;
  const crossing = (direction: -1 | 1): number | null => {
    let previous = peak.gainDbi;
    for (let distance = 1; distance <= Math.floor(points.length / 2); distance += 1) {
      const index = (peakIndex + direction * distance + points.length) % points.length;
      const gain = points[index]!.gainDbi;
      if (gain < threshold && previous >= threshold) {
        const previousAngle = points[(peakIndex + direction * (distance - 1) + points.length) % points.length]!.angleDeg;
        const currentAngle = points[index]!.angleDeg;
        const step = angularDistance(previousAngle, currentAngle);
        return (distance - 1) * step + step * Math.abs(previous - threshold) / Math.max(Math.abs(previous - gain), 1e-12);
      }
      previous = gain;
    }
    return null;
  };
  const left = crossing(-1); const right = crossing(1);
  return { frontToBackDb: peak.gainDbi - points[rear]!.gainDbi, beamwidthDeg: left === null || right === null ? 360 : Math.round((left + right) * 10) / 10 };
}
