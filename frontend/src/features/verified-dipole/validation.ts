import type { HorizontalDipoleModel } from "./model";
import { segmentDipole, type DipoleSegmentation } from "./segmentation";
import { wavelengthMetres } from "./units";

export interface DipoleModelAssessment {
  valid: boolean;
  errors: string[];
  warnings: string[];
  segmentation: DipoleSegmentation | null;
}

export function assessDipoleModel(model: HorizontalDipoleModel): DipoleModelAssessment {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isFinite(model.frequencyHz) || model.frequencyHz < 1_800_000 || model.frequencyHz > 54_000_000) {
    errors.push("Frequency must be between 1.8 and 54 MHz for this verified HF workflow.");
  }
  if (!Number.isFinite(model.totalLengthM) || model.totalLengthM <= 0) {
    errors.push("Dipole length must be greater than zero.");
  }
  if (!Number.isFinite(model.wireDiameterM) || model.wireDiameterM <= 0) {
    errors.push("Wire diameter must be greater than zero.");
  }
  if (!Number.isFinite(model.heightM) || model.heightM < 0) {
    errors.push("Height must be zero or greater.");
  }
  if (model.referenceImpedanceOhm !== 50 && model.referenceImpedanceOhm !== 75) {
    errors.push("Reference impedance must be 50 or 75 ohms.");
  }
  if (model.ground.kind === "real") {
    if (!Number.isFinite(model.ground.conductivitySPerM) || model.ground.conductivitySPerM < 0) {
      errors.push("Real-ground conductivity must be zero or greater in S/m.");
    }
    if (!Number.isFinite(model.ground.relativePermittivity) || model.ground.relativePermittivity < 1) {
      errors.push("Real-ground relative permittivity must be at least 1.");
    }
  }

  if (errors.length === 0) {
    const radiusM = model.wireDiameterM / 2;
    const wavelengthM = wavelengthMetres(model.frequencyHz);
    if (model.wireDiameterM >= model.totalLengthM / 10) {
      errors.push("Wire diameter is implausibly large relative to dipole length.");
    }
    if (model.ground.kind !== "free-space" && model.heightM <= radiusM) {
      errors.push("The wire surface must remain above the ground plane.");
    }
    if (radiusM / wavelengthM > 0.01) {
      warnings.push("Wire radius exceeds 0.01 wavelength; NEC's thin-wire approximation may be suspect.");
    }
    if (model.ground.kind !== "free-space" && model.heightM / wavelengthM < 0.02) {
      warnings.push("The dipole is very close to ground; results are especially sensitive to the ground model.");
    }
    if (model.ground.kind === "real" && model.ground.conductivitySPerM === 0) {
      warnings.push("Zero conductivity describes a lossless dielectric, not typical real soil.");
    }
  }

  let segmentation: DipoleSegmentation | null = null;
  if (errors.length === 0) {
    try {
      segmentation = segmentDipole(model);
      warnings.push(...segmentation.warnings);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Automatic segmentation failed.");
    }
  }

  return { valid: errors.length === 0, errors, warnings, segmentation };
}
