import type { PatternData } from "../../api/nec";

export interface FullElevationCutPoint {
  angleDeg: number;
  gainDbi: number;
}

function angularDistanceDeg(left: number, right: number): number {
  return Math.abs(((left - right + 540) % 360) - 180);
}

function nearestPhiIndex(pattern: PatternData, requestedPhiDeg: number): number {
  let selected = 0;
  let distance = Infinity;
  for (let index = 0; index < pattern.phi_count; index += 1) {
    const candidate = pattern.phi_start + index * pattern.phi_step;
    const delta = angularDistanceDeg(candidate, requestedPhiDeg);
    if (delta < distance) {
      selected = index;
      distance = delta;
    }
  }
  return selected;
}

function thetaIndex(pattern: PatternData, requestedThetaDeg: number): number | null {
  if (Math.abs(pattern.theta_step) < 1e-9) return null;
  const index = Math.round((requestedThetaDeg - pattern.theta_start) / pattern.theta_step);
  if (index < 0 || index >= pattern.theta_count) return null;
  const actual = pattern.theta_start + index * pattern.theta_step;
  return Math.abs(actual - requestedThetaDeg) <= Math.abs(pattern.theta_step) * 0.01 + 1e-6
    ? index
    : null;
}

function validGain(pattern: PatternData, theta: number, phiIndex: number): number | null {
  const index = thetaIndex(pattern, theta);
  if (index === null) return null;
  const gain = pattern.gain_dbi[index]?.[phiIndex];
  return Number.isFinite(gain) && gain! > -900 ? gain! : null;
}

/**
 * Extract the complete above-horizon elevation plane from a NEC angular grid.
 *
 * Display convention:
 * - 0°: primary-bearing horizon
 * - 90°: zenith
 * - 180°: opposite-bearing horizon
 *
 * NEC can represent the opposite half-plane either as negative theta at the
 * primary phi, or as positive theta at phi + 180°. The two coordinates name
 * the same physical direction. Prefer the signed-theta solver sample when it
 * exists and fall back to the opposite-phi representation used by some grids.
 */
export function extractFullElevationCut(
  pattern: PatternData,
  primaryPhiDeg: number,
): FullElevationCutPoint[] {
  const primaryPhiIndex = nearestPhiIndex(pattern, primaryPhiDeg);
  const oppositePhiIndex = nearestPhiIndex(pattern, primaryPhiDeg + 180);
  const points: FullElevationCutPoint[] = [];

  const absoluteThetaSamples = new Set<number>();
  for (let index = 0; index < pattern.theta_count; index += 1) {
    const theta = pattern.theta_start + index * pattern.theta_step;
    if (Math.abs(theta) <= 90 + 1e-6) absoluteThetaSamples.add(Math.min(90, Math.abs(theta)));
  }

  for (const upperThetaDeg of [...absoluteThetaSamples].sort((left, right) => left - right)) {
    const primaryGain = validGain(pattern, upperThetaDeg, primaryPhiIndex);
    points.push({
      angleDeg: 90 - upperThetaDeg,
      gainDbi: primaryGain ?? -999.99,
    });
    if (upperThetaDeg > 1e-6) {
      const signedThetaGain = validGain(pattern, -upperThetaDeg, primaryPhiIndex);
      const oppositePhiGain = validGain(pattern, upperThetaDeg, oppositePhiIndex);
      points.push({
        angleDeg: 90 + upperThetaDeg,
        gainDbi: signedThetaGain ?? oppositePhiGain ?? -999.99,
      });
    }
  }

  return points.sort((left, right) => left.angleDeg - right.angleDeg);
}
