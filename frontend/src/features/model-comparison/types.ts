import type { PatternData } from "../../api/nec";
import type { AnalyserSweep, SweepConfig } from "../frequency-analyser/types";
import type { RadialWorkflowSettings } from "../ground-radials/workflow";

export type ComparisonFamily = "dipole" | "vertical" | "phased-array" | "yagi";

export interface ComparisonSlotDefinition {
  id: string;
  family: ComparisonFamily;
  parameterValue: number;
}

export type ComparisonGround =
  | { kind: "perfect" }
  | { kind: "sommerfeld-norton"; conductivitySPerM: number; relativePermittivity: number };

export interface ComparisonConditions {
  frequencyMhz: number;
  ground: ComparisonGround;
  radialSystems: RadialWorkflowSettings;
  referenceImpedanceOhm: 50 | 75;
  azimuthElevationDeg: number;
  elevationBearingDeg: number;
}

export interface ComparisonPatternPoint {
  angleDeg: number;
  gainDbi: number;
  normalizedDb: number;
}

export interface ComparisonMetrics {
  gainDbi: number;
  takeOffAngleDeg: number | null;
  frontToBackDb: number | null;
  beamwidthDeg: number | null;
  resistanceOhm: number | null;
  reactanceOhm: number | null;
  swr: number | null;
}

export interface ComparisonResult {
  slotId: string;
  label: string;
  color: string;
  family: ComparisonFamily;
  definitionKey: string;
  conditionKey: string;
  conditions: ComparisonConditions;
  sweepConfig: SweepConfig;
  metrics: ComparisonMetrics;
  azimuthPattern: ComparisonPatternPoint[];
  elevationPattern: ComparisonPatternPoint[];
  radiationPattern: PatternData;
  sweep: AnalyserSweep | null;
  sweepUnavailableReason: string | null;
  generatedNec: string;
  engine: string;
  warnings: string[];
}

export interface ComparisonRunConfig {
  conditions: ComparisonConditions;
  sweep: SweepConfig;
}

export type ComparisonRunPhase = "idle" | "running" | "complete" | "cancelled" | "error";
