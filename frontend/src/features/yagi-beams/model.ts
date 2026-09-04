import { HF_AMATEUR_BANDS } from "../antenna-templates/bands";
import { SPEED_OF_LIGHT_M_PER_S } from "../verified-dipole/model";
import { useUIStore } from "../../stores/uiStore";
import type { GeneratedYagiModel, YagiAntennaModel, YagiDirector, YagiIssue, YagiWire } from "./schema";

export { HF_AMATEUR_BANDS as YAGI_BAND_PRESETS };

export function yagiWavelengthM(frequencyHz: number): number {
  return SPEED_OF_LIGHT_M_PER_S / frequencyHz;
}

function startingDirectors(lambda: number, count: number): YagiDirector[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `director-${index + 1}`,
    lengthM: lambda * Math.max(0.42, 0.452 - index * 0.006),
    spacingFromPreviousM: lambda * (index === 0 ? 0.2 : 0.22),
  }));
}

export function startingYagiModel(frequencyHz = 14_175_000, directorCount = 1): YagiAntennaModel {
  const lambda = yagiWavelengthM(frequencyHz);
  return {
    schemaVersion: 1,
    kind: "horizontal-yagi-uda",
    frequencyHz,
    drivenElementLengthM: lambda * 0.476,
    reflectorLengthM: lambda * 0.504,
    reflectorSpacingM: lambda * 0.15,
    directors: startingDirectors(lambda, directorCount),
    boomHeightM: lambda * 0.5,
    elementDiameterM: 0.0254,
    ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 },
    referenceImpedanceOhm: 50,
    provenance: { dimensionsAreStartingPoints: true, manualDimensions: false },
  };
}

export function resizeYagi(model: YagiAntennaModel, directorCount: number): YagiAntennaModel {
  const count = Math.max(0, Math.min(6, Math.trunc(directorCount)));
  const defaults = startingDirectors(yagiWavelengthM(model.frequencyHz), count);
  return {
    ...model,
    directors: defaults.map((item, index) => model.directors[index] ? { ...model.directors[index]!, id: item.id } : item),
    provenance: { ...model.provenance, manualDimensions: true },
  };
}

export function regenerateYagiStartingDimensions(model: YagiAntennaModel, frequencyHz: number): YagiAntennaModel {
  const next = startingYagiModel(frequencyHz, model.directors.length);
  return {
    ...next,
    elementDiameterM: model.elementDiameterM,
    ground: model.ground,
    referenceImpedanceOhm: model.referenceImpedanceOhm,
  };
}

export function buildYagiWires(model: YagiAntennaModel): YagiWire[] {
  const wire = (id: string, family: YagiWire["family"], lengthM: number, y: number): YagiWire => ({
    id,
    family,
    startM: { x: -lengthM / 2, y, z: model.boomHeightM },
    endM: { x: lengthM / 2, y, z: model.boomHeightM },
    diameterM: model.elementDiameterM,
  });
  const wires: YagiWire[] = [
    wire("reflector", "reflector", model.reflectorLengthM, -model.reflectorSpacingM),
    wire("driven", "driven", model.drivenElementLengthM, 0),
  ];
  let y = 0;
  for (const director of model.directors) {
    y += director.spacingFromPreviousM;
    wires.push(wire(director.id, "director", director.lengthM, y));
  }
  return wires;
}

function rangeIssue(value: number, min: number, max: number, code: string, label: string): YagiIssue[] {
  if (!Number.isFinite(value)) return [{ severity: "error", code, message: `${label} must be finite.` }];
  return value < min || value > max ? [{ severity: "error", code, message: `${label} must be between ${min} and ${max}.` }] : [];
}

export function validateYagiModel(model: YagiAntennaModel, wires = buildYagiWires(model)): YagiIssue[] {
  const lambda = yagiWavelengthM(model.frequencyHz);
  const issues: YagiIssue[] = [
    ...rangeIssue(model.frequencyHz, 1_800_000, 54_000_000, "frequency", "Frequency (Hz)"),
    ...rangeIssue(model.drivenElementLengthM, 0.5, 100, "driven-length", "Driven-element length (m)"),
    ...rangeIssue(model.reflectorLengthM, 0.5, 100, "reflector-length", "Reflector length (m)"),
    ...rangeIssue(model.reflectorSpacingM, 0.1, 30, "reflector-spacing", "Reflector spacing (m)"),
    ...rangeIssue(model.boomHeightM, 0.2, 80, "height", "Boom height (m)"),
    ...rangeIssue(model.elementDiameterM, 0.0005, 0.2, "diameter", "Element diameter (m)"),
  ];
  if (model.directors.length > 6) issues.push({ severity: "error", code: "director-count", message: "The interactive model supports zero to six directors (two to eight total elements)." });
  if (new Set(model.directors.map((director) => director.id)).size !== model.directors.length) issues.push({ severity: "error", code: "director-identities", message: "Director identifiers must be unique." });
  model.directors.forEach((director, index) => {
    issues.push(...rangeIssue(director.lengthM, 0.5, 100, `director-${index + 1}-length`, `Director ${index + 1} length (m)`));
    issues.push(...rangeIssue(director.spacingFromPreviousM, 0.1, 30, `director-${index + 1}-spacing`, `Director ${index + 1} spacing (m)`));
  });
  if (model.ground.kind === "sommerfeld-norton") {
    issues.push(...rangeIssue(model.ground.conductivitySPerM, 0.00001, 10, "conductivity", "Ground conductivity (S/m)"));
    issues.push(...rangeIssue(model.ground.relativePermittivity, 1, 100, "permittivity", "Ground relative permittivity"));
  }
  if (model.boomHeightM < lambda * 0.05) issues.push({ severity: "warning", code: "low-height", message: "The boom is below 0.05 wavelength; check wire-to-ground validity and height convergence carefully." });
  if (model.reflectorLengthM <= model.drivenElementLengthM) issues.push({ severity: "warning", code: "short-reflector", message: "The reflector is not longer than the driven element; forward direction or matching may differ from the intended Yagi design." });
  model.directors.forEach((director, index) => {
    if (director.lengthM >= model.drivenElementLengthM) issues.push({ severity: "warning", code: `long-director-${index + 1}`, message: `Director ${index + 1} is not shorter than the driven element; verify the intended current phase and forward direction.` });
  });
  for (const wire of wires) {
    const length = wire.endM.x - wire.startM.x;
    if (![length, wire.startM.y, wire.startM.z, wire.diameterM].every(Number.isFinite) || length <= 0) issues.push({ severity: "error", code: `geometry-${wire.id}`, message: `${wire.id} has invalid or zero-length geometry.` });
    if (wire.diameterM / lambda > 0.01) issues.push({ severity: "warning", code: `thick-${wire.id}`, message: `${wire.id} is electrically thick for NEC-2's thin-wire approximation.` });
  }
  const spacings = [model.reflectorSpacingM, ...model.directors.map((director) => director.spacingFromPreviousM)];
  spacings.forEach((spacing, index) => {
    if (spacing / model.elementDiameterM < 4) issues.push({ severity: "error", code: `close-elements-${index}`, message: "Adjacent parallel elements are closer than four diameters; this geometry is outside the interactive safety policy." });
    if (spacing / lambda < 0.03) issues.push({ severity: "warning", code: `small-spacing-${index}`, message: "Adjacent element spacing is below 0.03 wavelength; run segmentation and geometry convergence studies." });
  });
  return issues;
}

export function generateYagiModel(model: YagiAntennaModel): GeneratedYagiModel {
  const wires = buildYagiWires(model);
  return { model, wires, issues: validateYagiModel(model, wires) };
}

export function yagiModelKey(model: YagiAntennaModel): string { return JSON.stringify({ model, conductor: useUIStore.getState().conductor }); }
export function hasYagiErrors(generated: GeneratedYagiModel): boolean { return generated.issues.some((issue) => issue.severity === "error"); }
