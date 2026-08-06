import type { AnalyserPoint, AnalyserSweep } from "../frequency-analyser/types";

export type TouchstoneDataFormat = "RI" | "MA" | "DB";
export type TouchstoneFrequencyUnit = "HZ" | "KHZ" | "MHZ" | "GHZ";
export type ComparisonMetric = "swr" | "resistance" | "reactance";
export type AlignmentMode = "exact" | "linear-simulation";

export interface MeasurementPoint {
  ordinal: number;
  sourceLine: number;
  rawLine: string;
  frequencyHz: number;
  frequencyMhz: number;
  originalValue1: number;
  originalValue2: number;
  s11Real: number;
  s11Imag: number;
  s11Magnitude: number;
  s11PhaseDeg: number;
  swr: number | null;
  resistanceOhms: number | null;
  reactanceOhms: number | null;
}

export interface MeasurementDataset {
  schemaVersion: 1;
  id: string;
  fileName: string;
  byteLength: number;
  lastModified: number | null;
  importedAt: string;
  sourceText: string;
  touchstoneVersion: "1.0" | "2.0";
  optionLine: string;
  frequencyUnit: TouchstoneFrequencyUnit;
  dataFormat: TouchstoneDataFormat;
  parameter: "S";
  referenceOhms: number;
  declaredFrequencyCount: number | null;
  points: MeasurementPoint[];
  warnings: string[];
}

export interface AlignedComparisonPoint {
  frequencyMhz: number;
  measurementOrdinal: number;
  measurement: MeasurementPoint;
  simulation: AnalyserPoint | null;
  alignment: "exact" | "linear-simulation" | null;
  swrDifference: number | null;
  resistanceDifferenceOhms: number | null;
  reactanceDifferenceOhms: number | null;
}

export interface MeasurementComparison {
  schemaVersion: 1;
  measurementId: string;
  simulationId: string;
  alignmentMode: AlignmentMode;
  alignmentLabel: string;
  referenceImpedanceMatches: boolean;
  points: AlignedComparisonPoint[];
  alignedPointCount: number;
  warnings: string[];
}

export interface MeasurementComparisonExport {
  format: "hf-antenna-studio-measurement-comparison";
  version: 1;
  createdAt: string;
  measurement: MeasurementDataset;
  simulation: AnalyserSweep;
  comparison: MeasurementComparison;
}
