/**
 * Stable same-engine regression cases. These values detect unintended changes
 * in our NEC generation/parser pipeline; they are not independent RF truth.
 */
export interface DipoleRegressionCase {
  id: string;
  description: string;
  ground: "free-space" | "perfect";
  heightM: number;
  expected: {
    resistanceOhm: number;
    reactanceOhm: number;
    maximumGainDbi: number;
    takeOffAngleDeg: number | null;
  };
}

export const VALIDATION_FREQUENCY_MHZ = 14.1;
export const VALIDATION_DIPOLE_LENGTH_M = 10.631;
export const VALIDATION_WIRE_DIAMETER_MM = 1;

/** Published Virginia Tech/UNM NEC-2 case (Ellingson, 2006). */
export const PUBLISHED_NEC_REFERENCE = {
  id: "ellingson-38mhz-half-wave",
  sourceUrl: "https://leo.phys.unm.edu/~lwa/memos/memo/lwa0065a.pdf",
  frequencyMhz: 38,
  totalLengthM: 3.9474,
  wireDiameterMm: 0.1,
  sourceSegments: 11,
  applicationSegments: 21,
  expected: { resistanceOhm: 77.41, reactanceOhm: 45.09, maximumGainDbi: 2.16 },
  tolerance: { impedanceOhm: 0.5, gainDb: 0.05 },
} as const;

export const DIPOLE_REGRESSION_CASES: DipoleRegressionCase[] = [
  {
    id: "half-wave-free-space",
    description: "Exact approximately half-wave thin dipole in free space",
    ground: "free-space",
    heightM: 0,
    expected: { resistanceOhm: 78.27, reactanceOhm: 44.44, maximumGainDbi: 2.16, takeOffAngleDeg: null },
  },
  {
    id: "half-wave-perfect-ground",
    description: "Half-wave dipole 0.10 wavelength over perfect ground",
    ground: "perfect",
    heightM: 2.1262,
    expected: { resistanceOhm: 23.63, reactanceOhm: 67.01, maximumGainDbi: 8.83, takeOffAngleDeg: 90 },
  },
  {
    id: "height-quarter-wave",
    description: "Half-wave dipole 0.25 wavelength over perfect ground",
    ground: "perfect",
    heightM: 5.3155,
    expected: { resistanceOhm: 94.11, reactanceOhm: 75.78, maximumGainDbi: 7.49, takeOffAngleDeg: 90 },
  },
  {
    id: "height-half-wave",
    description: "Half-wave dipole 0.50 wavelength over perfect ground",
    ground: "perfect",
    heightM: 10.631,
    expected: { resistanceOhm: 72.8, reactanceOhm: 25.9, maximumGainDbi: 8.43, takeOffAngleDeg: 30 },
  },
  {
    id: "height-one-wave",
    description: "Half-wave dipole 1.00 wavelength over perfect ground",
    ground: "perfect",
    heightM: 21.262,
    expected: { resistanceOhm: 76.45, reactanceOhm: 34.54, maximumGainDbi: 8.23, takeOffAngleDeg: 15 },
  },
  {
    id: "height-two-waves",
    description: "Half-wave dipole 2.00 wavelengths over perfect ground",
    ground: "perfect",
    heightM: 42.524,
    expected: { resistanceOhm: 77.64, reactanceOhm: 39.38, maximumGainDbi: 8.14, takeOffAngleDeg: 60 },
  },
];
