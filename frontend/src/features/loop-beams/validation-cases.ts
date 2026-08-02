import type { LoopBeamModel } from "./schema";
export interface LoopBeamRegressionCase { kind: LoopBeamModel["kind"]; expected: { resistanceOhm: number; reactanceOhm: number; peakGainDbi: number; takeOffAngleDeg: number } }
/** Exact-deck reference results independently reproduced by 4NEC2's merged NEC-2D build 2.7. */
export const LOOP_BEAM_PERFECT_GROUND_REGRESSION_CASES: LoopBeamRegressionCase[] = [
  { kind: "square-loop", expected: { resistanceOhm: 106.289, reactanceOhm: -72.509, peakGainDbi: 8.46, takeOffAngleDeg: 36 } },
  { kind: "delta-loop", expected: { resistanceOhm: 103.861, reactanceOhm: -77.3984, peakGainDbi: 7.94, takeOffAngleDeg: 42 } },
  { kind: "diamond-loop", expected: { resistanceOhm: 88.9143, reactanceOhm: -80.3723, peakGainDbi: 7.95, takeOffAngleDeg: 0 } },
  { kind: "cubical-quad", expected: { resistanceOhm: 84.0498, reactanceOhm: 10.183, peakGainDbi: 14.36, takeOffAngleDeg: 18 } },
  { kind: "hexbeam", expected: { resistanceOhm: 39.3944, reactanceOhm: 52.9702, peakGainDbi: 12.12, takeOffAngleDeg: 28 } },
];
