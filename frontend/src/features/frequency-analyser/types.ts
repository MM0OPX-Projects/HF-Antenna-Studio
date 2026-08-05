import type { FrequencyResult } from "../../api/nec";
import type { SimulateAdvancedRequest } from "../../engine/types";

export type SweepEntryMode = "start-stop" | "center-span";

export interface SweepConfig {
  mode: SweepEntryMode;
  startMhz: number;
  stopMhz: number;
  points: number;
  referenceOhms: number;
}

export interface AnalyserPoint {
  frequencyMhz: number;
  resistanceOhms: number;
  reactanceOhms: number;
  impedanceMagnitudeOhms: number;
  swr: number;
  reflectionReal: number;
  reflectionImag: number;
  reflectionMagnitude: number;
  reflectionPhaseDeg: number;
  returnLossDb: number;
}

export interface AnalyserSweep {
  id: string;
  label: string;
  color: string;
  config: SweepConfig;
  points: AnalyserPoint[];
  rawFrequencyData: FrequencyResult[];
  computedInMs: number;
  engine: string;
  warnings: string[];
  createdAt: string;
}

export interface AnalyserProject {
  format: "hf-antenna-studio-frequency-analyser";
  version: 1;
  appVersion: string;
  createdAt: string;
  antennaName: string;
  antennaSnapshot: SimulateAdvancedRequest;
  activeSweep: AnalyserSweep;
  savedSweeps: AnalyserSweep[];
}
