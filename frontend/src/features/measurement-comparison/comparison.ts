import { deriveAnalyserPointFromImpedance } from "../frequency-analyser/math";
import type { AnalyserPoint, AnalyserSweep } from "../frequency-analyser/types";
import type { AlignmentMode, MeasurementComparison, MeasurementDataset, MeasurementPoint } from "./types";

const EXACT_TOLERANCE_MHZ = 1e-9;

function finiteDifference(left: number | null, right: number | null): number | null {
  return left !== null && right !== null && Number.isFinite(left) && Number.isFinite(right) ? left - right : null;
}

function exactSimulationPoint(points: AnalyserPoint[], frequencyMhz: number): AnalyserPoint | null {
  let low = 0;
  let high = points.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const point = points[middle]!;
    const difference = point.frequencyMhz - frequencyMhz;
    if (Math.abs(difference) <= EXACT_TOLERANCE_MHZ) return point;
    if (difference < 0) low = middle + 1; else high = middle - 1;
  }
  return null;
}

function linearlyInterpolatedSimulationPoint(points: AnalyserPoint[], frequencyMhz: number, referenceOhms: number): AnalyserPoint | null {
  const exact = exactSimulationPoint(points, frequencyMhz);
  if (exact) return exact;
  if (points.length < 2 || frequencyMhz < points[0]!.frequencyMhz || frequencyMhz > points[points.length - 1]!.frequencyMhz) return null;
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle]!.frequencyMhz < frequencyMhz) low = middle; else high = middle;
  }
  const left = points[low]!;
  const right = points[high]!;
  const span = right.frequencyMhz - left.frequencyMhz;
  if (!(span > 0)) return null;
  const fraction = (frequencyMhz - left.frequencyMhz) / span;
  const resistance = left.resistanceOhms + fraction * (right.resistanceOhms - left.resistanceOhms);
  const reactance = left.reactanceOhms + fraction * (right.reactanceOhms - left.reactanceOhms);
  return deriveAnalyserPointFromImpedance(frequencyMhz, resistance, reactance, referenceOhms);
}

function measurementValue(point: MeasurementPoint, field: "swr" | "resistance" | "reactance"): number | null {
  return field === "swr" ? point.swr : field === "resistance" ? point.resistanceOhms : point.reactanceOhms;
}

export function compareMeasurementToSimulation(measurement: MeasurementDataset, simulation: AnalyserSweep, alignmentMode: AlignmentMode): MeasurementComparison {
  const referenceImpedanceMatches = Math.abs(measurement.referenceOhms - simulation.config.referenceOhms) <= 1e-9;
  const points = measurement.points.map((measured) => {
    const exact = exactSimulationPoint(simulation.points, measured.frequencyMhz);
    const simulated = alignmentMode === "exact" ? exact : exact ?? linearlyInterpolatedSimulationPoint(simulation.points, measured.frequencyMhz, simulation.config.referenceOhms);
    const alignment = simulated ? exact ? "exact" as const : "linear-simulation" as const : null;
    return {
      frequencyMhz: measured.frequencyMhz,
      measurementOrdinal: measured.ordinal,
      measurement: measured,
      simulation: simulated,
      alignment,
      swrDifference: referenceImpedanceMatches ? finiteDifference(measurementValue(measured, "swr"), simulated?.swr ?? null) : null,
      resistanceDifferenceOhms: finiteDifference(measurementValue(measured, "resistance"), simulated?.resistanceOhms ?? null),
      reactanceDifferenceOhms: finiteDifference(measurementValue(measured, "reactance"), simulated?.reactanceOhms ?? null),
    };
  });
  const alignedPointCount = points.filter((point) => point.simulation !== null).length;
  const warnings: string[] = [];
  if (!referenceImpedanceMatches) warnings.push(`Measurement S11/SWR uses ${measurement.referenceOhms} Ω while simulation SWR uses ${simulation.config.referenceOhms} Ω. R and X remain comparable; SWR difference is not condition-matched.`);
  if (alignedPointCount === 0) warnings.push("No measurement frequencies align with the simulation range/grid under the selected alignment mode.");
  if (alignmentMode === "linear-simulation") warnings.push("Simulation R and X are linearly interpolated only between bracketing solved frequencies onto unchanged measurement frequencies; SWR is re-derived from interpolated impedance. No extrapolation is used.");
  return {
    schemaVersion: 1,
    measurementId: measurement.id,
    simulationId: simulation.id,
    alignmentMode,
    alignmentLabel: alignmentMode === "exact" ? "Exact frequency matches only; no interpolation" : "Linear simulation R/X interpolation onto original measurement frequencies; no extrapolation",
    referenceImpedanceMatches,
    points,
    alignedPointCount,
    warnings,
  };
}
