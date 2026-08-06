import { generatePhasedArray, phasedWavelengthM, startingPhasedArrayModel } from "../phased-arrays/model";
import type { PhasedArrayModel } from "../phased-arrays/schema";
import { createDefaultDipoleModel, SPEED_OF_LIGHT_M_PER_S, type HorizontalDipoleModel } from "../verified-dipole/model";
import { generateVerticalModel, startingVerticalModel } from "../vertical-antennas/model";
import type { VerticalAntennaModel } from "../vertical-antennas/schema";
import { generateYagiModel, startingYagiModel } from "../yagi-beams/model";
import type { YagiAntennaModel } from "../yagi-beams/schema";
import type { ParameterAxis, ParameterId, ParameterSweepDefinition, ParameterSweepFamily } from "./types";

export const MAX_PARAMETER_SWEEP_JOBS = 81;
export const MAX_TWO_DIMENSIONAL_AXIS_POINTS = 9;

export interface ParameterDefinition {
  id: ParameterId;
  family: ParameterSweepFamily;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  integer: boolean;
}

export const PARAMETER_DEFINITIONS: Record<ParameterId, ParameterDefinition> = {
  "dipole-height": { id: "dipole-height", family: "dipole", label: "Dipole height", unit: "m", min: 0.5, max: 80, step: 0.5, integer: false },
  "dipole-length": { id: "dipole-length", family: "dipole", label: "Dipole total length", unit: "m", min: 0.5, max: 100, step: 0.1, integer: false },
  "vertical-length": { id: "vertical-length", family: "vertical", label: "Vertical radiator length", unit: "m", min: 0.2, max: 60, step: 0.1, integer: false },
  "radial-count": { id: "radial-count", family: "vertical", label: "Explicit radial count", unit: "", min: 2, max: 32, step: 1, integer: true },
  "yagi-director-spacing": { id: "yagi-director-spacing", family: "yagi", label: "First-director spacing", unit: "m", min: 0.1, max: 30, step: 0.1, integer: false },
  "yagi-height": { id: "yagi-height", family: "yagi", label: "Yagi boom height", unit: "m", min: 0.2, max: 80, step: 0.5, integer: false },
  "array-spacing": { id: "array-spacing", family: "phased-array", label: "Array element spacing", unit: "m", min: 0.05, max: 100, step: 0.1, integer: false },
  "array-phase": { id: "array-phase", family: "phased-array", label: "Element 2 phase", unit: "°", min: -360, max: 360, step: 5, integer: false },
};

export const FAMILY_LABELS: Record<ParameterSweepFamily, string> = {
  dipole: "Horizontal dipole",
  vertical: "Elevated vertical with explicit radials",
  yagi: "Three-element Yagi",
  "phased-array": "Two-element ideal-current phased array",
};

export type BuiltSweepModel =
  | { family: "dipole"; model: HorizontalDipoleModel; modelKey: string; issues: string[] }
  | { family: "vertical"; model: VerticalAntennaModel; modelKey: string; issues: string[] }
  | { family: "yagi"; model: YagiAntennaModel; modelKey: string; issues: string[] }
  | { family: "phased-array"; model: PhasedArrayModel; modelKey: string; issues: string[] };

export function parametersForFamily(family: ParameterSweepFamily): ParameterDefinition[] {
  return Object.values(PARAMETER_DEFINITIONS).filter((parameter) => parameter.family === family);
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function rounded(value: number): number { return Number(value.toPrecision(12)); }

export function defaultAxis(parameterId: ParameterId, frequencyMhz: number, points = 9): ParameterAxis {
  const lambda = SPEED_OF_LIGHT_M_PER_S / (frequencyMhz * 1e6);
  const ranges: Record<ParameterId, [number, number]> = {
    "dipole-height": [lambda * 0.1, lambda],
    "dipole-length": [lambda * 0.4, lambda * 0.55],
    "vertical-length": [lambda * 0.18, lambda * 0.3],
    "radial-count": [2, 16],
    "yagi-director-spacing": [lambda * 0.1, lambda * 0.3],
    "yagi-height": [lambda * 0.25, lambda],
    "array-spacing": [lambda * 0.1, lambda * 0.5],
    "array-phase": [0, 360],
  };
  const parameter = PARAMETER_DEFINITIONS[parameterId];
  const [rawStart, rawStop] = ranges[parameterId];
  const start = parameter.integer ? Math.ceil(rawStart) : rounded(clamp(rawStart, parameter.min, parameter.max));
  const stop = parameter.integer ? Math.floor(rawStop) : rounded(clamp(rawStop, parameter.min, parameter.max));
  return { parameterId, start, stop, points };
}

export function createDefaultSweepDefinition(): ParameterSweepDefinition {
  return { schemaVersion: 1, mode: "one-dimensional", family: "dipole", frequencyMhz: 14.1, ground: { kind: "perfect" }, referenceImpedanceOhm: 50, axes: [defaultAxis("dipole-height", 14.1)] };
}

export function axisValues(axis: ParameterAxis): number[] {
  const parameter = PARAMETER_DEFINITIONS[axis.parameterId];
  if (axis.points < 2) return [];
  return Array.from({ length: axis.points }, (_, index) => {
    const raw = axis.start + (axis.stop - axis.start) * index / (axis.points - 1);
    return parameter.integer ? Math.round(raw) : rounded(raw);
  });
}

export function parameterSweepJobCount(definition: ParameterSweepDefinition): number {
  return definition.axes.reduce((total, axis) => total * axis.points, 1);
}

export function parameterSweepDefinitionKey(definition: ParameterSweepDefinition): string {
  return JSON.stringify(definition);
}

export function validateParameterSweepDefinition(definition: ParameterSweepDefinition): string[] {
  const errors: string[] = [];
  const expectedAxes = definition.mode === "one-dimensional" ? 1 : 2;
  if (definition.axes.length !== expectedAxes) errors.push(`${definition.mode === "one-dimensional" ? "One-dimensional" : "Two-dimensional"} sweeps require exactly ${expectedAxes} axis${expectedAxes === 1 ? "" : "es"}.`);
  if (!Number.isFinite(definition.frequencyMhz) || definition.frequencyMhz < 1.8 || definition.frequencyMhz > 54) errors.push("Frequency must be from 1.8 to 54 MHz.");
  if (definition.ground.kind === "sommerfeld-norton") {
    if (!Number.isFinite(definition.ground.conductivitySPerM) || definition.ground.conductivitySPerM < 0.00001 || definition.ground.conductivitySPerM > 10) errors.push("Ground conductivity must be from 0.00001 to 10 S/m.");
    if (!Number.isFinite(definition.ground.relativePermittivity) || definition.ground.relativePermittivity < 1 || definition.ground.relativePermittivity > 100) errors.push("Ground relative permittivity must be from 1 to 100.");
  }
  if (new Set(definition.axes.map((axis) => axis.parameterId)).size !== definition.axes.length) errors.push("Two-dimensional axes must use different parameters.");
  definition.axes.forEach((axis, index) => {
    const parameter = PARAMETER_DEFINITIONS[axis.parameterId];
    const prefix = `Axis ${index + 1}`;
    if (parameter.family !== definition.family) errors.push(`${prefix} parameter does not belong to the selected antenna family.`);
    if (!Number.isFinite(axis.start) || !Number.isFinite(axis.stop) || axis.start < parameter.min || axis.stop > parameter.max || axis.stop <= axis.start) errors.push(`${prefix} must increase within ${parameter.min}–${parameter.max}${parameter.unit}.`);
    const maximumPoints = definition.mode === "two-dimensional" ? MAX_TWO_DIMENSIONAL_AXIS_POINTS : MAX_PARAMETER_SWEEP_JOBS;
    if (!Number.isInteger(axis.points) || axis.points < 2 || axis.points > maximumPoints) errors.push(`${prefix} point count must be an integer from 2 to ${maximumPoints}.`);
    if (parameter.integer && (!Number.isInteger(axis.start) || !Number.isInteger(axis.stop))) errors.push(`${prefix} start and stop must be whole numbers.`);
    if (new Set(axisValues(axis)).size !== axis.points) errors.push(`${prefix} does not produce ${axis.points} distinct values; reduce the point count or widen the range.`);
  });
  if (parameterSweepJobCount(definition) > MAX_PARAMETER_SWEEP_JOBS) errors.push(`Sweep requests ${parameterSweepJobCount(definition)} jobs; the maximum is ${MAX_PARAMETER_SWEEP_JOBS}.`);
  return [...new Set(errors)];
}

export function parameterCoordinates(definition: ParameterSweepDefinition): Array<{ axisValues: number[]; parameterValues: Partial<Record<ParameterId, number>> }> {
  const first = axisValues(definition.axes[0]!);
  if (definition.mode === "one-dimensional") return first.map((value) => ({ axisValues: [value], parameterValues: { [definition.axes[0]!.parameterId]: value } }));
  const second = axisValues(definition.axes[1]!);
  return second.flatMap((secondValue) => first.map((firstValue) => ({ axisValues: [firstValue, secondValue], parameterValues: { [definition.axes[0]!.parameterId]: firstValue, [definition.axes[1]!.parameterId]: secondValue } })));
}

function commonGround(definition: ParameterSweepDefinition) {
  return definition.ground.kind === "perfect" ? { kind: "perfect" as const } : { kind: "sommerfeld-norton" as const, conductivitySPerM: definition.ground.conductivitySPerM, relativePermittivity: definition.ground.relativePermittivity };
}

export function buildSweepModel(definition: ParameterSweepDefinition, values: Partial<Record<ParameterId, number>>): BuiltSweepModel {
  const frequencyHz = definition.frequencyMhz * 1e6;
  if (definition.family === "dipole") {
    const start = createDefaultDipoleModel();
    const model: HorizontalDipoleModel = { ...start, frequencyHz, totalLengthM: SPEED_OF_LIGHT_M_PER_S / frequencyHz * 0.476, heightM: SPEED_OF_LIGHT_M_PER_S / frequencyHz * 0.5, ground: commonGround(definition).kind === "perfect" ? { kind: "perfect" } : { kind: "real", conductivitySPerM: definition.ground.kind === "sommerfeld-norton" ? definition.ground.conductivitySPerM : 0.005, relativePermittivity: definition.ground.kind === "sommerfeld-norton" ? definition.ground.relativePermittivity : 13 }, referenceImpedanceOhm: definition.referenceImpedanceOhm };
    if (values["dipole-height"] !== undefined) model.heightM = values["dipole-height"]!;
    if (values["dipole-length"] !== undefined) model.totalLengthM = values["dipole-length"]!;
    return { family: "dipole", model, modelKey: JSON.stringify(model), issues: [] };
  }
  if (definition.family === "vertical") {
    let model = startingVerticalModel(frequencyHz, "elevated-explicit-radials");
    model = { ...model, ground: commonGround(definition), referenceImpedanceOhm: definition.referenceImpedanceOhm, provenance: { ...model.provenance, manualDimensions: true } };
    if (values["vertical-length"] !== undefined) model.radiatorLengthM = values["vertical-length"]!;
    if (values["radial-count"] !== undefined) model.radials = { ...model.radials, count: values["radial-count"]! };
    const generated = generateVerticalModel(model);
    return { family: "vertical", model, modelKey: JSON.stringify(model), issues: generated.issues.map((issue) => `${issue.severity}: ${issue.message}`) };
  }
  if (definition.family === "yagi") {
    let model = startingYagiModel(frequencyHz, 1);
    model = { ...model, ground: commonGround(definition), referenceImpedanceOhm: definition.referenceImpedanceOhm, provenance: { ...model.provenance, manualDimensions: true } };
    if (values["yagi-director-spacing"] !== undefined) model.directors = [{ ...model.directors[0]!, spacingFromPreviousM: values["yagi-director-spacing"]! }];
    if (values["yagi-height"] !== undefined) model.boomHeightM = values["yagi-height"]!;
    const generated = generateYagiModel(model);
    return { family: "yagi", model, modelKey: JSON.stringify(model), issues: generated.issues.map((issue) => `${issue.severity}: ${issue.message}`) };
  }
  let model = startingPhasedArrayModel(frequencyHz);
  if (definition.ground.kind === "sommerfeld-norton") {
    const lambda = phasedWavelengthM(frequencyHz);
    model = { ...model, elementBaseHeightM: lambda * 0.12, ground: commonGround(definition), radials: { ...model.radials, representation: "explicit-wires", count: 4 } };
  }
  if (values["array-spacing"] !== undefined) model.spacingM = values["array-spacing"]!;
  if (values["array-phase"] !== undefined) model.ideal = { ...model.ideal, phase2Deg: values["array-phase"]! };
  model = { ...model, provenance: { ...model.provenance, manualDimensions: true } };
  const generated = generatePhasedArray(model);
  return { family: "phased-array", model, modelKey: JSON.stringify(model), issues: generated.issues.map((issue) => `${issue.severity}: ${issue.message}`) };
}

export function builtParameterValue(built: BuiltSweepModel, parameterId: ParameterId): number {
  if (built.family === "dipole") return parameterId === "dipole-height" ? built.model.heightM : built.model.totalLengthM;
  if (built.family === "vertical") return parameterId === "radial-count" ? built.model.radials.count : built.model.radiatorLengthM;
  if (built.family === "yagi") return parameterId === "yagi-height" ? built.model.boomHeightM : built.model.directors[0]!.spacingFromPreviousM;
  return parameterId === "array-phase" ? built.model.ideal.phase2Deg : built.model.spacingM;
}

export function fingerprintText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
