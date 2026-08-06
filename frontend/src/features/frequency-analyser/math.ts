import type { FrequencyResult } from "../../api/nec";
import type { AnalyserPoint, SweepConfig } from "./types";

export const MIN_SWEEP_POINTS = 3;
export const MAX_SWEEP_POINTS = 401;

export function startStopToCenterSpan(startMhz: number, stopMhz: number) {
  return { centerMhz: (startMhz + stopMhz) / 2, spanMhz: stopMhz - startMhz };
}

export function centerSpanToStartStop(centerMhz: number, spanMhz: number) {
  return { startMhz: centerMhz - spanMhz / 2, stopMhz: centerMhz + spanMhz / 2 };
}

export function validateSweepConfig(config: SweepConfig): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(config.startMhz) || config.startMhz < 1.8) errors.push("Start frequency must be at least 1.8 MHz.");
  if (!Number.isFinite(config.stopMhz) || config.stopMhz > 54) errors.push("Stop frequency must not exceed 54 MHz.");
  if (Number.isFinite(config.startMhz) && Number.isFinite(config.stopMhz) && config.stopMhz <= config.startMhz) errors.push("Stop frequency must be greater than start frequency.");
  if (!Number.isInteger(config.points) || config.points < MIN_SWEEP_POINTS || config.points > MAX_SWEEP_POINTS) errors.push(`Points must be an integer from ${MIN_SWEEP_POINTS} to ${MAX_SWEEP_POINTS}.`);
  if (!Number.isFinite(config.referenceOhms) || config.referenceOhms <= 0 || config.referenceOhms > 1000) errors.push("Reference impedance must be greater than 0 and no more than 1000 ohms.");
  return errors;
}

export function deriveAnalyserPoint(result: FrequencyResult, referenceOhms: number): AnalyserPoint {
  return deriveAnalyserPointFromImpedance(result.frequency_mhz, result.impedance.real, result.impedance.imag, referenceOhms);
}

export function deriveAnalyserPointFromImpedance(frequencyMhz: number, resistance: number, reactance: number, referenceOhms: number): AnalyserPoint {
  const denominator = (resistance + referenceOhms) ** 2 + reactance ** 2;
  const reflectionReal = denominator === 0
    ? Number.POSITIVE_INFINITY
    : (resistance ** 2 + reactance ** 2 - referenceOhms ** 2) / denominator;
  const reflectionImag = denominator === 0 ? 0 : (2 * referenceOhms * reactance) / denominator;
  const reflectionMagnitude = Math.hypot(reflectionReal, reflectionImag);
  const swr = reflectionMagnitude >= 1 ? Number.POSITIVE_INFINITY : (1 + reflectionMagnitude) / (1 - reflectionMagnitude);
  const returnLossDb = reflectionMagnitude === 0 ? Number.POSITIVE_INFINITY : -20 * Math.log10(reflectionMagnitude);
  return {
    frequencyMhz,
    resistanceOhms: resistance,
    reactanceOhms: reactance,
    impedanceMagnitudeOhms: Math.hypot(resistance, reactance),
    swr,
    reflectionReal,
    reflectionImag,
    reflectionMagnitude,
    reflectionPhaseDeg: Math.atan2(reflectionImag, reflectionReal) * 180 / Math.PI,
    returnLossDb,
  };
}

export function deriveAnalyserPoints(results: FrequencyResult[], referenceOhms: number): AnalyserPoint[] {
  return results.map((result) => deriveAnalyserPoint(result, referenceOhms));
}

export function nearestPointIndex(points: AnalyserPoint[], frequencyMhz: number): number {
  if (points.length === 0) return -1;
  let closest = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (Math.abs(points[index]!.frequencyMhz - frequencyMhz) < Math.abs(points[closest]!.frequencyMhz - frequencyMhz)) closest = index;
  }
  return closest;
}
