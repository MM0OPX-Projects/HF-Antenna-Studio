/**
 * Solver-independent, SI-only domain model for the verified dipole feature.
 * NEC card syntax and display units deliberately do not leak into this schema.
 */

export const SPEED_OF_LIGHT_M_PER_S = 299_792_458;

export type DipoleGround =
  | { kind: "free-space" }
  | { kind: "perfect" }
  | {
      kind: "real";
      conductivitySPerM: number;
      relativePermittivity: number;
    };

export interface HorizontalDipoleModel {
  schemaVersion: 1;
  kind: "center-fed-horizontal-dipole";
  frequencyHz: number;
  totalLengthM: number;
  wireDiameterM: number;
  heightM: number;
  ground: DipoleGround;
  referenceImpedanceOhm: 50 | 75;
  orientation: "x";
  conductor: { kind: "perfect" };
}
export function createDefaultDipoleModel(): HorizontalDipoleModel {
  return {
    schemaVersion: 1,
    kind: "center-fed-horizontal-dipole",
    frequencyHz: 14_100_000,
    totalLengthM: 10.15,
    wireDiameterM: 0.001,
    heightM: 10,
    ground: { kind: "perfect" },
    referenceImpedanceOhm: 50,
    orientation: "x",
    conductor: { kind: "perfect" },
  };
}
