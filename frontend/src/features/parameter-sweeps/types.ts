import type { PatternData } from "../../api/nec";
import type { RadialWorkflowSettings } from "../ground-radials/workflow";

export type ParameterSweepFamily = "dipole" | "vertical" | "yagi" | "phased-array";

export type ParameterId =
  | "dipole-height"
  | "dipole-length"
  | "vertical-length"
  | "radial-count"
  | "yagi-director-spacing"
  | "yagi-height"
  | "array-spacing"
  | "array-phase";

export type SweepMetricId = "swr" | "gain" | "take-off" | "front-to-back" | "resistance" | "reactance";
export type ParameterSweepMode = "one-dimensional" | "two-dimensional";
export type ParameterSweepPhase = "idle" | "running" | "complete" | "cancelled" | "error";

export type ParameterSweepGround =
  | { kind: "perfect" }
  | { kind: "sommerfeld-norton"; conductivitySPerM: number; relativePermittivity: number };

export interface ParameterAxis {
  parameterId: ParameterId;
  start: number;
  stop: number;
  points: number;
}

export interface ParameterSweepDefinition {
  schemaVersion: 2;
  mode: ParameterSweepMode;
  family: ParameterSweepFamily;
  frequencyMhz: number;
  ground: ParameterSweepGround;
  radialSystems: RadialWorkflowSettings;
  referenceImpedanceOhm: 50 | 75;
  axes: ParameterAxis[];
}

export interface SweepMetrics {
  swr: number | null;
  gainDbi: number;
  takeOffAngleDeg: number;
  frontToBackDb: number | null;
  resistanceOhm: number | null;
  reactanceOhm: number | null;
}

export interface SolvedSweepModel {
  modelKey: string;
  generatedNec: string;
  necFingerprint: string;
  metrics: SweepMetrics;
  engine: string;
  computedInMs: number;
  warnings: string[];
  /** Exact far-field grid returned for this model. Optional only for legacy/test fixtures. */
  radiationPattern?: PatternData;
}

export interface ParameterSweepPoint extends SolvedSweepModel {
  ordinal: number;
  axisValues: number[];
  parameterValues: Partial<Record<ParameterId, number>>;
  cached: boolean;
}

export interface ParameterSweepResult {
  schemaVersion: 2;
  id: string;
  definitionKey: string;
  definition: ParameterSweepDefinition;
  createdAt: string;
  completedAt: string;
  elapsedMs: number;
  totalJobs: number;
  cacheHits: number;
  points: ParameterSweepPoint[];
  engines: string[];
  warnings: string[];
}

export interface ParameterSweepProgress {
  completed: number;
  total: number;
  cacheHits: number;
  currentLabel: string;
}
