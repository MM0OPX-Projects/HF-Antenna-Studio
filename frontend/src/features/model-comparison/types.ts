import type { PatternData } from "../../api/nec";
import type { AnalyserSweep, SweepConfig } from "../frequency-analyser/types";
import type { RadialWorkflowSettings } from "../ground-radials/workflow";

export type ComparisonFamily = "dipole" | "vertical" | "phased-array" | "yagi";

/** Immutable copy of a local project captured when it is assigned to a slot. */
export interface ComparisonProjectSnapshot {
  projectId: string;
  projectName: string;
  projectRevision: number;
  project: unknown;
}

export interface ComparisonSlotDefinition {
  id: string;
  /** Whether this slot participates in the next comparison. Missing means enabled for older projects. */
  enabled?: boolean;
  family: ComparisonFamily;
  parameterValue: number;
  source?: "builtin" | "saved-project";
  savedProject?: ComparisonProjectSnapshot;
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
  family: ComparisonFamily | "saved-project";
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
