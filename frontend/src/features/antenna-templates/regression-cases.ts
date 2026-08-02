import type { TemplateId } from "./schema";

/** Same-engine envelopes: useful for regression detection, not independent RF validation. */
export const TEMPLATE_REGRESSION_CASES: Array<{
  id: TemplateId;
  expected: { resistanceOhm: number; reactanceOhm: number; maximumGainDbi: number; takeOffAngleDeg: number };
}> = [
  { id: "horizontal-dipole", expected: { resistanceOhm: 62.87, reactanceOhm: -40.14, maximumGainDbi: 7.35, takeOffAngleDeg: 30 } },
  { id: "inverted-v", expected: { resistanceOhm: 64.52, reactanceOhm: -65.52, maximumGainDbi: 5.52, takeOffAngleDeg: 45 } },
  { id: "sloper", expected: { resistanceOhm: 70.23, reactanceOhm: -61.24, maximumGainDbi: 5.46, takeOffAngleDeg: 35 } },
  { id: "quarter-wave-vertical", expected: { resistanceOhm: 34.37, reactanceOhm: -12.06, maximumGainDbi: 5.13, takeOffAngleDeg: 0 } },
  { id: "ground-plane-vertical", expected: { resistanceOhm: 54.48, reactanceOhm: -16.75, maximumGainDbi: 0.22, takeOffAngleDeg: 20 } },
  { id: "full-wave-loop", expected: { resistanceOhm: 137.33, reactanceOhm: -23.94, maximumGainDbi: 5.45, takeOffAngleDeg: 40 } },
  { id: "delta-loop", expected: { resistanceOhm: 98.64, reactanceOhm: -64.50, maximumGainDbi: 2.74, takeOffAngleDeg: 80 } },
  { id: "square-loop", expected: { resistanceOhm: 116.71, reactanceOhm: -66.58, maximumGainDbi: 4.90, takeOffAngleDeg: 50 } },
];
