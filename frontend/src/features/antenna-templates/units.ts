import type { ParameterDisplayUnit } from "./schema";

const METRES_PER_FOOT = 0.3048;
const METRES_PER_INCH = 0.0254;

export function toDisplayUnit(valueSI: number, unit: ParameterDisplayUnit): number {
  switch (unit) {
    case "MHz": return valueSI / 1_000_000;
    case "ft": return valueSI / METRES_PER_FOOT;
    case "mm": return valueSI * 1_000;
    case "in": return valueSI / METRES_PER_INCH;
    case "deg": return valueSI * 180 / Math.PI;
    default: return valueSI;
  }
}

export function fromDisplayUnit(value: number, unit: ParameterDisplayUnit): number {
  switch (unit) {
    case "MHz": return value * 1_000_000;
    case "ft": return value * METRES_PER_FOOT;
    case "mm": return value / 1_000;
    case "in": return value * METRES_PER_INCH;
    case "deg": return value * Math.PI / 180;
    default: return value;
  }
}

export function displayStep(stepSI: number, unit: ParameterDisplayUnit): number {
  return toDisplayUnit(stepSI, unit);
}
