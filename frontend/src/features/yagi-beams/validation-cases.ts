export interface YagiRegressionCase {
  elements: 2 | 3 | 5;
  expected: {
    resistanceOhm: number;
    reactanceOhm: number;
    forwardGainDbi: number;
    rearGainDbi: number;
    takeOffAngleDeg: number;
  };
}

/** Same-deck browser regressions independently reproduced by the local NEC-2D comparator. */
export const YAGI_PERFECT_GROUND_REGRESSION_CASES: YagiRegressionCase[] = [
  { elements: 2, expected: { resistanceOhm: 57.80, reactanceOhm: 26.01, forwardGainDbi: 11.85, rearGainDbi: -3.52, takeOffAngleDeg: 28 } },
  { elements: 3, expected: { resistanceOhm: 20.53, reactanceOhm: 9.38, forwardGainDbi: 13.38, rearGainDbi: -1.37, takeOffAngleDeg: 26 } },
  { elements: 5, expected: { resistanceOhm: 24.66, reactanceOhm: 10.36, forwardGainDbi: 14.87, rearGainDbi: -2.16, takeOffAngleDeg: 24 } },
];

/**
 * NBS Technical Note 688, Table 1 / figures 5-7: scaled 0.4-wavelength-boom
 * 3-element geometry. The publication used a folded driven element and a
 * measured comparison method, so these are sanity envelopes, not exact oracles.
 */
export const NIST_SCALED_THREE_ELEMENT_SANITY = {
  frequencyHz: 14_175_000,
  drivenLengthWavelengths: 0.5,
  reflectorLengthWavelengths: 0.482,
  directorLengthWavelengths: 0.424,
  reflectorSpacingWavelengths: 0.2,
  directorSpacingWavelengths: 0.2,
  heightWavelengths: 3,
  publishedBeamwidthsDeg: [57, 72] as const,
  publishedRearSuppressionDb: 8,
};
