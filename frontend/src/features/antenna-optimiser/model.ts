import { buildSweepModel, builtParameterValue, defaultAxis, parameterSweepDefinitionKey, parametersForFamily, PARAMETER_DEFINITIONS, type BuiltSweepModel } from "../parameter-sweeps/model";
import type { ParameterId, ParameterSweepDefinition, ParameterSweepFamily } from "../parameter-sweeps/types";
import type { OptimisationDefinition, OptimisationObjectiveKind, OptimisationVariable } from "./types";

export const MAX_OPTIMISER_EVALUATIONS = 121;
export const MAX_RETAINED_SOLUTIONS = 5;

export const OBJECTIVE_LABELS: Record<OptimisationObjectiveKind, string> = {
  "lowest-swr": "Lowest SWR",
  "maximum-forward-gain": "Maximum forward gain",
  "maximum-front-to-back": "Maximum front-to-back ratio",
  "target-feed-resistance": "Target feed resistance",
  "target-zero-reactance": "Reactance nearest zero",
  "target-take-off-angle": "Target take-off angle",
  "weighted-multi-objective": "Weighted multi-objective score",
};

export const OBJECTIVES_BY_FAMILY: Record<ParameterSweepFamily, OptimisationObjectiveKind[]> = {
  dipole: ["lowest-swr", "maximum-forward-gain", "target-feed-resistance", "target-zero-reactance", "target-take-off-angle", "weighted-multi-objective"],
  vertical: ["lowest-swr", "maximum-forward-gain", "target-feed-resistance", "target-zero-reactance", "target-take-off-angle", "weighted-multi-objective"],
  yagi: ["lowest-swr", "maximum-forward-gain", "maximum-front-to-back", "target-feed-resistance", "target-zero-reactance", "target-take-off-angle", "weighted-multi-objective"],
  "phased-array": ["maximum-forward-gain", "maximum-front-to-back", "target-take-off-angle", "weighted-multi-objective"],
};

function asSweepDefinition(definition: OptimisationDefinition): ParameterSweepDefinition {
  return { schemaVersion: 1, mode: "one-dimensional", family: definition.family, frequencyMhz: definition.frequencyMhz, ground: structuredClone(definition.ground), referenceImpedanceOhm: definition.referenceImpedanceOhm, axes: [] };
}

export function buildOptimisationModel(definition: OptimisationDefinition, parameters: Partial<Record<ParameterId, number>>): BuiltSweepModel {
  return buildSweepModel(asSweepDefinition(definition), parameters);
}

export function startingParameterValues(definition: OptimisationDefinition): Partial<Record<ParameterId, number>> {
  const built = buildOptimisationModel(definition, {});
  return Object.fromEntries(definition.variables.map((variable) => [variable.parameterId, builtParameterValue(built, variable.parameterId)]));
}

export function defaultOptimisationVariable(family: ParameterSweepFamily, parameterId: ParameterId, frequencyMhz: number): OptimisationVariable {
  const axis = defaultAxis(parameterId, frequencyMhz);
  if (PARAMETER_DEFINITIONS[parameterId].family !== family) throw new RangeError(`${parameterId} does not belong to ${family}.`);
  return { parameterId, minimum: axis.start, maximum: axis.stop };
}

export function createDefaultOptimisationDefinition(): OptimisationDefinition {
  return {
    schemaVersion: 1,
    family: "dipole",
    frequencyMhz: 14.1,
    ground: { kind: "perfect" },
    referenceImpedanceOhm: 50,
    variables: [defaultOptimisationVariable("dipole", "dipole-length", 14.1)],
    objective: { kind: "lowest-swr", targetResistanceOhm: 50, targetTakeOffAngleDeg: 20, weights: { swr: 1, gain: 0.1, frontToBack: 0.1, resistance: 0, reactance: 0, takeOffAngle: 0 } },
    constraints: { maximumSwr: null, minimumGainDbi: null, minimumFrontToBackDb: null, maximumTakeOffAngleDeg: null },
    algorithm: { id: "bounded-coordinate-pattern-search-v1", maximumEvaluations: 25, initialStepFraction: 0.25, stepShrinkFactor: 0.5, minimumStepFraction: 0.01 },
  };
}

export function optimisationDefinitionKey(definition: OptimisationDefinition): string {
  return parameterSweepDefinitionKey({ ...asSweepDefinition(definition), axes: definition.variables.map((variable) => ({ parameterId: variable.parameterId, start: variable.minimum, stop: variable.maximum, points: 2 })) }) + JSON.stringify({ objective: definition.objective, constraints: definition.constraints, algorithm: definition.algorithm });
}

function activeWeightedTerms(definition: OptimisationDefinition): Array<{ supported: boolean; value: number; label: string }> {
  const weights = definition.objective.weights;
  const singlePort = definition.family !== "phased-array";
  const directional = definition.family === "yagi" || definition.family === "phased-array";
  return [
    { supported: singlePort, value: weights.swr, label: "SWR" },
    { supported: true, value: weights.gain, label: "gain" },
    { supported: directional, value: weights.frontToBack, label: "front-to-back" },
    { supported: singlePort, value: weights.resistance, label: "resistance" },
    { supported: singlePort, value: weights.reactance, label: "reactance" },
    { supported: true, value: weights.takeOffAngle, label: "take-off angle" },
  ];
}

export function validateOptimisationDefinition(definition: OptimisationDefinition): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(definition.frequencyMhz) || definition.frequencyMhz < 1.8 || definition.frequencyMhz > 54) errors.push("Frequency must be from 1.8 to 54 MHz.");
  if (definition.variables.length < 1 || definition.variables.length > 2) errors.push("Select one or two dimensions to vary.");
  if (new Set(definition.variables.map((variable) => variable.parameterId)).size !== definition.variables.length) errors.push("Optimisation dimensions must be unique.");
  const startValues = startingParameterValues(definition);
  definition.variables.forEach((variable) => {
    const parameter = PARAMETER_DEFINITIONS[variable.parameterId];
    if (parameter.family !== definition.family) errors.push(`${parameter.label} does not belong to the selected family.`);
    if (!Number.isFinite(variable.minimum) || !Number.isFinite(variable.maximum) || variable.minimum < parameter.min || variable.maximum > parameter.max || variable.maximum <= variable.minimum) errors.push(`${parameter.label} limits must increase within ${parameter.min}–${parameter.max}${parameter.unit}.`);
    if (parameter.integer && (!Number.isInteger(variable.minimum) || !Number.isInteger(variable.maximum))) errors.push(`${parameter.label} limits must be whole numbers.`);
    const starting = startValues[variable.parameterId];
    if (starting !== undefined && (starting < variable.minimum || starting > variable.maximum)) errors.push(`${parameter.label} limits must contain the starting value ${starting.toFixed(parameter.integer ? 0 : 4)}${parameter.unit}.`);
  });
  if (!OBJECTIVES_BY_FAMILY[definition.family].includes(definition.objective.kind)) errors.push("The selected objective is unavailable for this antenna family and feed model.");
  if (!Number.isFinite(definition.objective.targetResistanceOhm) || definition.objective.targetResistanceOhm <= 0 || definition.objective.targetResistanceOhm > 1000) errors.push("Target resistance must be greater than 0 and no more than 1000 Ω.");
  if (!Number.isFinite(definition.objective.targetTakeOffAngleDeg) || definition.objective.targetTakeOffAngleDeg < 0 || definition.objective.targetTakeOffAngleDeg > 90) errors.push("Target take-off angle must be from 0° to 90°.");
  if (definition.objective.kind === "weighted-multi-objective") {
    const terms = activeWeightedTerms(definition);
    if (terms.some((term) => !Number.isFinite(term.value) || term.value < 0 || term.value > 100)) errors.push("Every objective weight must be finite and from 0 to 100.");
    if (!terms.some((term) => term.supported && term.value > 0)) errors.push("At least one supported weighted objective must have a positive weight.");
    const unsupported = terms.filter((term) => !term.supported && term.value > 0).map((term) => term.label);
    if (unsupported.length) errors.push(`Unsupported weighted terms must be zero for this model: ${unsupported.join(", ")}.`);
  }
  const constraints = definition.constraints;
  for (const [label, value] of [["Maximum SWR", constraints.maximumSwr], ["Minimum gain", constraints.minimumGainDbi], ["Minimum front-to-back", constraints.minimumFrontToBackDb], ["Maximum take-off angle", constraints.maximumTakeOffAngleDeg]] as const) if (value !== null && !Number.isFinite(value)) errors.push(`${label} constraint must be finite.`);
  if (constraints.maximumSwr !== null && (constraints.maximumSwr < 1 || definition.family === "phased-array")) errors.push("Maximum SWR must be at least 1 and requires a single-port model.");
  if (constraints.minimumFrontToBackDb !== null && definition.family !== "yagi" && definition.family !== "phased-array") errors.push("Minimum front-to-back requires a directional model.");
  if (constraints.maximumTakeOffAngleDeg !== null && (constraints.maximumTakeOffAngleDeg < 0 || constraints.maximumTakeOffAngleDeg > 90)) errors.push("Maximum take-off angle must be from 0° to 90°.");
  const algorithm = definition.algorithm;
  if (algorithm.id !== "bounded-coordinate-pattern-search-v1") errors.push("Unsupported optimiser algorithm.");
  if (!Number.isInteger(algorithm.maximumEvaluations) || algorithm.maximumEvaluations < 3 || algorithm.maximumEvaluations > MAX_OPTIMISER_EVALUATIONS) errors.push(`Maximum evaluations must be an integer from 3 to ${MAX_OPTIMISER_EVALUATIONS}.`);
  if (!Number.isFinite(algorithm.initialStepFraction) || algorithm.initialStepFraction <= 0 || algorithm.initialStepFraction > 0.5) errors.push("Initial step fraction must be greater than 0 and no more than 0.5.");
  if (!Number.isFinite(algorithm.stepShrinkFactor) || algorithm.stepShrinkFactor <= 0 || algorithm.stepShrinkFactor >= 1) errors.push("Step shrink factor must be between 0 and 1.");
  if (!Number.isFinite(algorithm.minimumStepFraction) || algorithm.minimumStepFraction <= 0 || algorithm.minimumStepFraction >= algorithm.initialStepFraction) errors.push("Minimum step fraction must be positive and smaller than the initial step fraction.");
  if (definition.ground.kind === "sommerfeld-norton") {
    if (!Number.isFinite(definition.ground.conductivitySPerM) || definition.ground.conductivitySPerM < 0.00001 || definition.ground.conductivitySPerM > 10) errors.push("Ground conductivity must be from 0.00001 to 10 S/m.");
    if (!Number.isFinite(definition.ground.relativePermittivity) || definition.ground.relativePermittivity < 1 || definition.ground.relativePermittivity > 100) errors.push("Ground relative permittivity must be from 1 to 100.");
  }
  return [...new Set(errors)];
}

export function availableVariables(family: ParameterSweepFamily, frequencyMhz: number): OptimisationVariable[] {
  return parametersForFamily(family).map((parameter) => defaultOptimisationVariable(family, parameter.id, frequencyMhz));
}
