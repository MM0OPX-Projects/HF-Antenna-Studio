import { SPEED_OF_LIGHT_M_PER_S } from "./model";

export type LengthUnit = "m" | "mm" | "ft" | "in";

const METRES_PER_UNIT: Record<LengthUnit, number> = {
  m: 1,
  mm: 0.001,
  ft: 0.3048,
  in: 0.0254,
};

export function lengthToMetres(value: number, unit: LengthUnit): number {
  return value * METRES_PER_UNIT[unit];
}
export function metresToLength(valueM: number, unit: LengthUnit): number {
  return valueM / METRES_PER_UNIT[unit];
}

export function megahertzToHertz(valueMhz: number): number {
  return valueMhz * 1_000_000;
}

export function hertzToMegahertz(valueHz: number): number {
  return valueHz / 1_000_000;
}

export function wavelengthMetres(frequencyHz: number): number {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new RangeError("Frequency must be a positive finite value.");
  }
  return SPEED_OF_LIGHT_M_PER_S / frequencyHz;
}
