import { startingVerticalModel } from "./model";
import type { VerticalAntennaModel } from "./schema";

export interface VerticalRegressionCase {
  band: "40m" | "20m" | "10m";
  frequencyHz: number;
  expected: { resistanceOhm: number; reactanceOhm: number; gainDbi: number; takeOffAngleDeg: number };
}

/** Same-engine regression expectations; separate 4NEC2 comparison is documented externally. */
export const IDEAL_VERTICAL_REGRESSION_CASES: VerticalRegressionCase[] = [
  { band: "40m", frequencyHz: 7_100_000, expected: { resistanceOhm: 33.82, reactanceOhm: -19.01, gainDbi: 5.13, takeOffAngleDeg: 0 } },
  { band: "20m", frequencyHz: 14_100_000, expected: { resistanceOhm: 34.03, reactanceOhm: -15.58, gainDbi: 5.13, takeOffAngleDeg: 0 } },
  { band: "10m", frequencyHz: 28_500_000, expected: { resistanceOhm: 34.30, reactanceOhm: -12.00, gainDbi: 5.13, takeOffAngleDeg: 0 } },
];

/**
 * Explicit-wire analogue of NEC-2 User's Guide Example 10. The original uses
 * GR/WG/GF numerical-Green-function staging; this model expands all six
 * radials and therefore checks the same dimensions/ground, not byte identity.
 */
export function nec2UserGuideExample10Equivalent(): VerticalAntennaModel {
  const initial = startingVerticalModel(10_000_000, "elevated-explicit-radials");
  return {
    ...initial,
    radiatorLengthM: 7.5,
    radiatorDiameterM: 0.006,
    baseHeightM: 0.01,
    radials: { representation: "explicit-wires", count: 6, lengthM: 30, droopAngleRad: 0, diameterM: 0.006 },
    ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.001, relativePermittivity: 4 },
    provenance: { dimensionsAreStartingPoints: true, manualDimensions: true },
  };
}
