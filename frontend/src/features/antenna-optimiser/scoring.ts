import type { OptimisationConstraints, OptimisationObjective } from "./types";
import type { SweepMetrics } from "../parameter-sweeps/types";

function required(value: number | null, label: string): number {
  if (value === null || !Number.isFinite(value)) throw new Error(`${label} is unavailable for this modelling mode.`);
  return value;
}

export function scoreMetrics(metrics: SweepMetrics, objective: OptimisationObjective): number {
  if (objective.kind === "lowest-swr") return required(metrics.swr, "SWR");
  if (objective.kind === "maximum-forward-gain") return -metrics.gainDbi;
  if (objective.kind === "maximum-front-to-back") return -required(metrics.frontToBackDb, "Front-to-back");
  if (objective.kind === "target-feed-resistance") return Math.abs(required(metrics.resistanceOhm, "Feed resistance") - objective.targetResistanceOhm);
  if (objective.kind === "target-zero-reactance") return Math.abs(required(metrics.reactanceOhm, "Feed reactance"));
  if (objective.kind === "target-take-off-angle") return Math.abs(metrics.takeOffAngleDeg - objective.targetTakeOffAngleDeg);
  const weights = objective.weights;
  return weights.swr * (requiredWhenWeighted(metrics.swr, weights.swr, "SWR") - 1)
    - weights.gain * metrics.gainDbi
    - weights.frontToBack * requiredWhenWeighted(metrics.frontToBackDb, weights.frontToBack, "Front-to-back")
    + weights.resistance * Math.abs(requiredWhenWeighted(metrics.resistanceOhm, weights.resistance, "Feed resistance") - objective.targetResistanceOhm)
    + weights.reactance * Math.abs(requiredWhenWeighted(metrics.reactanceOhm, weights.reactance, "Feed reactance"))
    + weights.takeOffAngle * Math.abs(metrics.takeOffAngleDeg - objective.targetTakeOffAngleDeg);
}

function requiredWhenWeighted(value: number | null, weight: number, label: string): number {
  if (weight === 0) return 0;
  return required(value, label);
}

export function constraintFailures(metrics: SweepMetrics, constraints: OptimisationConstraints): string[] {
  const failures: string[] = [];
  if (constraints.maximumSwr !== null && (metrics.swr === null || !Number.isFinite(metrics.swr) || metrics.swr > constraints.maximumSwr)) failures.push(`SWR exceeds ${constraints.maximumSwr}.`);
  if (constraints.minimumGainDbi !== null && metrics.gainDbi < constraints.minimumGainDbi) failures.push(`Gain is below ${constraints.minimumGainDbi} dBi.`);
  if (constraints.minimumFrontToBackDb !== null && (metrics.frontToBackDb === null || metrics.frontToBackDb < constraints.minimumFrontToBackDb)) failures.push(`Front-to-back is below ${constraints.minimumFrontToBackDb} dB.`);
  if (constraints.maximumTakeOffAngleDeg !== null && metrics.takeOffAngleDeg > constraints.maximumTakeOffAngleDeg) failures.push(`Take-off angle exceeds ${constraints.maximumTakeOffAngleDeg}°.`);
  return failures;
}
