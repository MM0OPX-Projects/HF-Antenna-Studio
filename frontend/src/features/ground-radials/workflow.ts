import { phasedWavelengthM, startingPhasedArrayModel, switchPhasedRadialRepresentation } from "../phased-arrays/model";
import type { PhasedArrayGround, PhasedArrayModel } from "../phased-arrays/schema";
import { startingVerticalModel, wavelengthM } from "../vertical-antennas/model";
import type { VerticalAntennaModel, VerticalGround } from "../vertical-antennas/schema";

export type WorkflowVerticalRadialMode = "elevated-independent" | "near-surface";
export type WorkflowPhasedRadialMode =
  | "perfect-ground-image"
  | "elevated-independent"
  | "near-surface-independent"
  | "near-surface-shared";

export interface RadialWorkflowSettings {
  schemaVersion: 1;
  verticalMode: WorkflowVerticalRadialMode;
  phasedMode: WorkflowPhasedRadialMode;
  radialLengthWavelengths: number;
  radialDiameterM: number;
  nearSurfaceClearanceM: number;
  elevatedHeightWavelengths: number;
  elevatedDroopAngleDeg: number;
  phasedRadialCount: number;
}

export type RadialWorkflowGround =
  | { kind: "perfect" }
  | { kind: "sommerfeld-norton"; conductivitySPerM: number; relativePermittivity: number };

export function createDefaultRadialWorkflowSettings(): RadialWorkflowSettings {
  return {
    schemaVersion: 1,
    verticalMode: "elevated-independent",
    phasedMode: "perfect-ground-image",
    radialLengthWavelengths: 0.25,
    radialDiameterM: 0.001,
    nearSurfaceClearanceM: 0.01,
    elevatedHeightWavelengths: 0.12,
    elevatedDroopAngleDeg: 20,
    phasedRadialCount: 16,
  };
}

export function radialSettingsForGround(
  settings: RadialWorkflowSettings,
  groundKind: RadialWorkflowGround["kind"],
): RadialWorkflowSettings {
  if (groundKind === "perfect") {
    return {
      ...settings,
      verticalMode: settings.verticalMode === "near-surface" ? "elevated-independent" : settings.verticalMode,
      phasedMode: settings.phasedMode.startsWith("near-surface") ? "perfect-ground-image" : settings.phasedMode,
    };
  }
  return {
    ...settings,
    phasedMode: settings.phasedMode === "perfect-ground-image" ? "near-surface-shared" : settings.phasedMode,
  };
}

function finiteRange(value: number, minimum: number, maximum: number, label: string): string[] {
  return Number.isFinite(value) && value >= minimum && value <= maximum
    ? []
    : [`${label} must be between ${minimum} and ${maximum}.`];
}

export function validateRadialWorkflowSettings(
  settings: RadialWorkflowSettings,
  families: ReadonlySet<"vertical" | "phased-array">,
  ground: RadialWorkflowGround,
): string[] {
  const errors = [
    ...(settings.schemaVersion !== 1 ? ["Unsupported radial-workflow schema version."] : []),
    ...finiteRange(settings.radialLengthWavelengths, 0.02, 2, "Radial length (wavelengths)"),
    ...finiteRange(settings.radialDiameterM, 0.0002, 0.1, "Radial diameter (m)"),
    ...finiteRange(settings.nearSurfaceClearanceM, 0.0002, 0.2, "Near-surface clearance (m)"),
    ...finiteRange(settings.elevatedHeightWavelengths, 0.005, 2, "Elevated radial height (wavelengths)"),
    ...finiteRange(settings.elevatedDroopAngleDeg, 0, 60, "Elevated radial droop (degrees)"),
  ];
  if (!Number.isInteger(settings.phasedRadialCount) || settings.phasedRadialCount < 4 || settings.phasedRadialCount > 64) {
    errors.push("Phased radial count must be a whole number from 4 to 64.");
  }
  if (families.has("vertical") && settings.verticalMode === "near-surface" && ground.kind !== "sommerfeld-norton") {
    errors.push("Near-surface vertical radials require Sommerfeld/Norton real ground.");
  }
  if (families.has("phased-array")) {
    if (settings.phasedMode === "perfect-ground-image" && ground.kind !== "perfect") {
      errors.push("Perfect-ground image phased arrays require perfect ground.");
    }
    if (settings.phasedMode.startsWith("near-surface") && ground.kind !== "sommerfeld-norton") {
      errors.push("Near-surface phased radials require Sommerfeld/Norton real ground.");
    }
  }
  return [...new Set(errors)];
}

function verticalGround(ground: RadialWorkflowGround): VerticalGround {
  return ground.kind === "perfect" ? { kind: "perfect" } : { kind: "sommerfeld-norton", conductivitySPerM: ground.conductivitySPerM, relativePermittivity: ground.relativePermittivity };
}

function phasedGround(ground: RadialWorkflowGround): PhasedArrayGround {
  return ground.kind === "perfect" ? { kind: "perfect" } : { kind: "sommerfeld-norton", conductivitySPerM: ground.conductivitySPerM, relativePermittivity: ground.relativePermittivity };
}

export function createWorkflowVerticalModel(
  frequencyHz: number,
  ground: RadialWorkflowGround,
  settings: RadialWorkflowSettings,
  radialCount: number,
  referenceImpedanceOhm: 50 | 75,
): VerticalAntennaModel {
  const nearSurface = settings.verticalMode === "near-surface";
  const model = startingVerticalModel(frequencyHz, nearSurface ? "ground-mounted-explicit-radials" : "elevated-explicit-radials");
  model.ground = verticalGround(ground);
  model.baseHeightM = nearSurface ? settings.nearSurfaceClearanceM : wavelengthM(frequencyHz) * settings.elevatedHeightWavelengths;
  model.radials = {
    representation: "explicit-wires",
    count: Math.round(radialCount),
    lengthM: wavelengthM(frequencyHz) * settings.radialLengthWavelengths,
    droopAngleRad: nearSurface ? 0 : settings.elevatedDroopAngleDeg * Math.PI / 180,
    diameterM: settings.radialDiameterM,
  };
  model.referenceImpedanceOhm = referenceImpedanceOhm;
  return model;
}

export function createWorkflowPhasedModel(
  frequencyHz: number,
  ground: RadialWorkflowGround,
  settings: RadialWorkflowSettings,
): PhasedArrayModel {
  let model = startingPhasedArrayModel(frequencyHz);
  model.ground = phasedGround(ground);
  if (settings.phasedMode === "perfect-ground-image") {
    model = switchPhasedRadialRepresentation(model, "perfect-ground-image");
    model.ground = phasedGround(ground);
    return model;
  }
  const nearSurface = settings.phasedMode.startsWith("near-surface");
  model = switchPhasedRadialRepresentation(model, nearSurface ? "near-surface-explicit-wires" : "elevated-explicit-wires");
  model.ground = phasedGround(ground);
  model.elementBaseHeightM = nearSurface ? settings.nearSurfaceClearanceM : phasedWavelengthM(frequencyHz) * settings.elevatedHeightWavelengths;
  model.radials = {
    representation: nearSurface ? "near-surface-explicit-wires" : "elevated-explicit-wires",
    topology: settings.phasedMode === "near-surface-shared" ? "shared-bonded-network" : "independent-per-element",
    count: settings.phasedRadialCount,
    lengthM: phasedWavelengthM(frequencyHz) * settings.radialLengthWavelengths,
    droopAngleRad: nearSurface ? 0 : settings.elevatedDroopAngleDeg * Math.PI / 180,
    diameterM: settings.radialDiameterM,
  };
  return model;
}

export function radialWorkflowSummary(settings: RadialWorkflowSettings, family: "vertical" | "phased-array"): string {
  if (family === "vertical") return settings.verticalMode === "near-surface" ? "near-surface explicit radial field" : "elevated independent radial wires";
  return settings.phasedMode.replace(/-/g, " ");
}
