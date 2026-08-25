import type { ParameterId, ParameterSweepFamily, ParameterSweepGround, SolvedSweepModel, SweepMetrics } from "../parameter-sweeps/types";
import type { RadialWorkflowSettings } from "../ground-radials/workflow";

export type OptimisationObjectiveKind =
  | "lowest-swr"
  | "maximum-forward-gain"
  | "maximum-front-to-back"
  | "target-feed-resistance"
  | "target-zero-reactance"
  | "target-take-off-angle"
  | "weighted-multi-objective";

export interface OptimisationWeights {
  swr: number;
  gain: number;
  frontToBack: number;
  resistance: number;
  reactance: number;
  takeOffAngle: number;
}

export interface OptimisationObjective {
  kind: OptimisationObjectiveKind;
  targetResistanceOhm: number;
  targetTakeOffAngleDeg: number;
  weights: OptimisationWeights;
}

export interface OptimisationConstraints {
  maximumSwr: number | null;
  minimumGainDbi: number | null;
  minimumFrontToBackDb: number | null;
  maximumTakeOffAngleDeg: number | null;
}

export interface OptimisationVariable {
  parameterId: ParameterId;
  minimum: number;
  maximum: number;
}

export interface OptimisationAlgorithmSettings {
  id: "bounded-coordinate-pattern-search-v1";
  maximumEvaluations: number;
  initialStepFraction: number;
  stepShrinkFactor: number;
  minimumStepFraction: number;
}

export interface OptimisationDefinition {
  schemaVersion: 2;
  family: ParameterSweepFamily;
  frequencyMhz: number;
  ground: ParameterSweepGround;
  radialSystems: RadialWorkflowSettings;
  referenceImpedanceOhm: 50 | 75;
  variables: OptimisationVariable[];
  objective: OptimisationObjective;
  constraints: OptimisationConstraints;
  algorithm: OptimisationAlgorithmSettings;
}

export type CandidateStatus = "feasible" | "constraint-rejected" | "model-rejected";

export interface OptimisationCandidate {
  evaluation: number;
  parameters: Partial<Record<ParameterId, number>>;
  status: CandidateStatus;
  score: number | null;
  bestSoFarScore: number | null;
  rejectionReasons: string[];
  solved: SolvedSweepModel | null;
  cached: boolean;
}

export interface RetainedOptimisationSolution extends OptimisationCandidate {
  status: "feasible";
  score: number;
  solved: SolvedSweepModel;
}

export interface OptimisationResult {
  schemaVersion: 2;
  id: string;
  definitionKey: string;
  definition: OptimisationDefinition;
  createdAt: string;
  completedAt: string;
  elapsedMs: number;
  terminationReason: "evaluation-limit" | "step-tolerance" | "search-exhausted";
  startingDesign: OptimisationCandidate;
  bestSolution: RetainedOptimisationSolution;
  retainedSolutions: RetainedOptimisationSolution[];
  history: OptimisationCandidate[];
  cacheHits: number;
  engines: string[];
  warnings: string[];
  globalOptimumEstablished: false;
}

export interface OptimisationProgress {
  completed: number;
  maximum: number;
  cacheHits: number;
  bestScore: number | null;
  currentParameters: Partial<Record<ParameterId, number>>;
}

export type OptimisationPhase = "idle" | "running" | "complete" | "cancelled" | "error";

export type MetricRequirements = Partial<Record<keyof SweepMetrics, true>>;
