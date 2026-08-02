export interface PhasedArrayValidationCase {
  id: "broadside" | "endfire-forward" | "endfire-reverse";
  phase2Deg: number;
  expected: { forwardGainDbi: number; reverseGainDbi: number; frontToBackDb: number; headingDeg: number; takeOffAngleDeg: number; ambiguous: boolean };
}

/**
 * Exact 14.1 MHz, 0.25-wavelength-spacing, perfect-ground decks independently
 * reproduced by 4NEC2's merged NEC-2D build 2.7. The two implementations
 * agree at the recorded 0.01 dB / 2-degree RP resolution.
 */
export const PHASED_ARRAY_PERFECT_GROUND_CASES: PhasedArrayValidationCase[] = [
  { id: "broadside", phase2Deg: 0, expected: { forwardGainDbi: 6.20, reverseGainDbi: 6.20, frontToBackDb: 0, headingDeg: 0, takeOffAngleDeg: 2, ambiguous: true } },
  { id: "endfire-forward", phase2Deg: -90, expected: { forwardGainDbi: 8.18, reverseGainDbi: -26.72, frontToBackDb: 34.90, headingDeg: 90, takeOffAngleDeg: 2, ambiguous: false } },
  { id: "endfire-reverse", phase2Deg: 90, expected: { forwardGainDbi: 8.18, reverseGainDbi: -26.72, frontToBackDb: 34.90, headingDeg: 270, takeOffAngleDeg: 2, ambiguous: false } },
];
