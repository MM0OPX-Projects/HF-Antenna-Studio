import type { ComparisonConditions, ComparisonFamily, ComparisonSlotDefinition } from "./types";
import type { SweepConfig } from "../frequency-analyser/types";
import { createDefaultRadialWorkflowSettings } from "../ground-radials/workflow";
import { useUIStore } from "../../stores/uiStore";

export const COMPARISON_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#a855f7"] as const;

export const FAMILY_PARAMETERS: Record<ComparisonFamily, { familyLabel: string; parameterLabel: string; unit: string; min: number; max: number; step: number }> = {
  dipole: { familyLabel: "Horizontal dipole", parameterLabel: "Height", unit: "m", min: 0.5, max: 80, step: 0.5 },
  vertical: { familyLabel: "Quarter-wave vertical", parameterLabel: "Radial count", unit: "", min: 2, max: 128, step: 1 },
  "phased-array": { familyLabel: "Two-element phased array", parameterLabel: "Element 2 phase", unit: "°", min: -360, max: 360, step: 5 },
  yagi: { familyLabel: "Three-element Yagi", parameterLabel: "Boom height", unit: "m", min: 0.5, max: 80, step: 0.5 },
};

function slot(id: string, family: ComparisonFamily, parameterValue: number): ComparisonSlotDefinition {
  return { id, family, parameterValue };
}

export const COMPARISON_PRESETS = {
  mixed: [slot("model-1", "dipole", 5), slot("model-2", "vertical", 4), slot("model-3", "phased-array", 90), slot("model-4", "yagi", 10)],
  dipole: [slot("model-1", "dipole", 5), slot("model-2", "dipole", 10), slot("model-3", "dipole", 15), slot("model-4", "dipole", 20)],
  vertical: [slot("model-1", "vertical", 2), slot("model-2", "vertical", 4), slot("model-3", "vertical", 8), slot("model-4", "vertical", 16)],
  phased: [slot("model-1", "phased-array", 0), slot("model-2", "phased-array", 90), slot("model-3", "phased-array", 180), slot("model-4", "phased-array", 270)],
  yagi: [slot("model-1", "yagi", 5), slot("model-2", "yagi", 10), slot("model-3", "yagi", 15), slot("model-4", "yagi", 20)],
} as const;

export function clonePreset(name: keyof typeof COMPARISON_PRESETS): ComparisonSlotDefinition[] {
  return COMPARISON_PRESETS[name].map((definition) => ({ ...definition }));
}

export function createDefaultComparisonConditions(): ComparisonConditions {
  return {
    frequencyMhz: 14.1,
    ground: { kind: "perfect" },
    radialSystems: createDefaultRadialWorkflowSettings(),
    referenceImpedanceOhm: 50,
    azimuthElevationDeg: 10,
    elevationBearingDeg: 0,
  };
}

export function createDefaultComparisonSweep(): SweepConfig {
  return { mode: "start-stop", startMhz: 13.8, stopMhz: 14.4, points: 11, referenceOhms: 50 };
}

export function comparisonDefinitionKey(definition: ComparisonSlotDefinition): string {
  return JSON.stringify(definition);
}

export function comparisonConditionKey(conditions: ComparisonConditions, sweep?: SweepConfig): string {
  return JSON.stringify({ conditions, ...(sweep ? { sweep } : {}), conductor: useUIStore.getState().conductor });
}

export function comparisonLabel(definition: ComparisonSlotDefinition): string {
  const meta = FAMILY_PARAMETERS[definition.family];
  const value = definition.family === "vertical" ? Math.round(definition.parameterValue).toString() : Number(definition.parameterValue.toFixed(2)).toString();
  return `${meta.familyLabel} · ${meta.parameterLabel} ${value}${meta.unit}`;
}

export function validateComparisonDefinition(definition: ComparisonSlotDefinition): string[] {
  const meta = FAMILY_PARAMETERS[definition.family];
  const errors: string[] = [];
  if (!Number.isFinite(definition.parameterValue) || definition.parameterValue < meta.min || definition.parameterValue > meta.max) errors.push(`${meta.parameterLabel} must be between ${meta.min} and ${meta.max}${meta.unit}.`);
  if (definition.family === "vertical" && !Number.isInteger(definition.parameterValue)) errors.push("Radial count must be a whole number.");
  return errors;
}

export function validateComparisonRadialCounts(definitions: ComparisonSlotDefinition[], conditions: ComparisonConditions): string[] {
  if (conditions.radialSystems.verticalMode !== "near-surface") return [];
  return definitions.flatMap((definition, index) => definition.family === "vertical" && definition.parameterValue < 4
    ? [`Model ${index + 1}: near-surface vertical models require at least four explicit radial wires.`]
    : []);
}

export function comparisonConditionWarnings(
  results: Array<{ conditionKey: string; definitionKey: string; slotId: string }>,
  definitions: ComparisonSlotDefinition[],
  conditions: ComparisonConditions,
  sweep?: SweepConfig,
): string[] {
  if (results.length === 0) return [];
  const requested = comparisonConditionKey(conditions, sweep);
  const warnings: string[] = [];
  const keys = new Set(results.map((result) => result.conditionKey));
  if (keys.size > 1) warnings.push("Solved models use different frequency, ground, reference-impedance, cut, or sweep conditions. Their plots are not overlaid together.");
  if (results.some((result) => result.conditionKey !== requested)) warnings.push("One or more solved results differ from the current common-condition controls; rerun before treating them as a controlled comparison.");
  if (results.some((result) => result.definitionKey !== comparisonDefinitionKey(definitions.find((definition) => definition.id === result.slotId)!))) warnings.push("One or more model controls have changed since calculation; stale results are excluded from overlays.");
  return warnings;
}
