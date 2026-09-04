import type {
  AntennaTemplateDefinition,
  GeneratedTemplateModel,
  TemplateAntennaModel,
  TemplateGround,
  TemplateValidationIssue,
  TemplateWire,
} from "./schema";
import { useUIStore } from "../../stores/uiStore";

function finitePoint(wire: TemplateWire): boolean {
  return [wire.startM.x, wire.startM.y, wire.startM.z, wire.endM.x, wire.endM.y, wire.endM.z].every(Number.isFinite);
}

function wireLength(wire: TemplateWire): number {
  return Math.hypot(
    wire.endM.x - wire.startM.x,
    wire.endM.y - wire.startM.y,
    wire.endM.z - wire.startM.z,
  );
}

export function initialTemplateParameters(definition: AntennaTemplateDefinition): Record<string, number> {
  const band = definition.presets.find((item) => item.id === definition.defaultBandId) ?? definition.presets[0]!;
  return startingParametersForFrequency(definition, band.frequencyHz);
}

export function startingParametersForFrequency(definition: AntennaTemplateDefinition, frequencyHz: number): Record<string, number> {
  const raw = definition.startingParameters(frequencyHz);
  return Object.fromEntries(definition.parameters.map((parameter) => {
    const value = raw[parameter.key] ?? parameter.defaultSI;
    const steps = Math.round((value - parameter.minSI) / parameter.stepSI);
    const quantized = parameter.minSI + steps * parameter.stepSI;
    const bounded = Math.max(parameter.minSI, Math.min(parameter.maxSI, quantized));
    return [parameter.key, parameter.quantity === "integer" ? Math.round(bounded) : Number(bounded.toPrecision(12))];
  }));
}

export function generateTemplateModel(
  definition: AntennaTemplateDefinition,
  suppliedParametersSI: Readonly<Record<string, number>>,
  ground: TemplateGround,
  manualDimensions: boolean,
): GeneratedTemplateModel {
  const parametersSI: Record<string, number> = {};
  const issues: TemplateValidationIssue[] = [];
  for (const parameter of definition.parameters) {
    const value = suppliedParametersSI[parameter.key] ?? parameter.defaultSI;
    parametersSI[parameter.key] = value;
    if (!Number.isFinite(value)) {
      issues.push({ severity: "error", code: `parameter-${parameter.key}-finite`, message: `${parameter.label} must be finite.` });
    } else if (value < parameter.minSI || value > parameter.maxSI) {
      issues.push({ severity: "error", code: `parameter-${parameter.key}-range`, message: `${parameter.label} is outside its allowed range.` });
    } else if (parameter.quantity === "integer" && !Number.isInteger(value)) {
      issues.push({ severity: "error", code: `parameter-${parameter.key}-integer`, message: `${parameter.label} must be a whole number.` });
    }
  }
  const wires = definition.geometryGenerator(parametersSI);
  const feed = definition.feedPoint(parametersSI, wires);
  const loads = definition.loads(parametersSI, wires);
  const model: TemplateAntennaModel = {
    schemaVersion: 1,
    kind: "parametric-wire-antenna",
    template: { id: definition.id, version: definition.version },
    name: definition.name,
    frequencyHz: parametersSI.frequencyHz!,
    parametersSI,
    wires,
    feed,
    loads,
    ground,
    groundConnection: definition.groundConnection === "touching" ? "touching" : "none",
    referenceImpedanceOhm: 50,
    provenance: { dimensionsAreStartingPoints: true, manualDimensions },
  };

  if (wires.length === 0) issues.push({ severity: "error", code: "geometry-empty", message: "The template generated no wires." });
  const ids = new Set<string>();
  for (const item of wires) {
    if (ids.has(item.id)) issues.push({ severity: "error", code: "wire-id-duplicate", message: `Wire ID ${item.id} is duplicated.` });
    ids.add(item.id);
    if (!finitePoint(item) || !Number.isFinite(item.diameterM)) {
      issues.push({ severity: "error", code: "wire-finite", message: `Wire ${item.id} contains a non-finite coordinate or diameter.` });
    } else {
      if (wireLength(item) <= 0) issues.push({ severity: "error", code: "wire-length", message: `Wire ${item.id} has zero length.` });
      if (item.diameterM <= 0) issues.push({ severity: "error", code: "wire-diameter", message: `Wire ${item.id} has a non-positive diameter.` });
    }
  }
  if (!ids.has(feed.wireId)) issues.push({ severity: "error", code: "feed-wire", message: "The feed references a wire that does not exist." });
  if (!Number.isFinite(feed.position) || feed.position < 0 || feed.position > 1) issues.push({ severity: "error", code: "feed-position", message: "The feed position must lie on its wire." });
  if (ground.kind === "real") {
    if (!Number.isFinite(ground.conductivitySPerM) || ground.conductivitySPerM < 0) issues.push({ severity: "error", code: "ground-conductivity", message: "Ground conductivity must be zero or greater." });
    if (!Number.isFinite(ground.relativePermittivity) || ground.relativePermittivity < 1) issues.push({ severity: "error", code: "ground-permittivity", message: "Relative permittivity must be at least 1." });
  }
  for (const rule of definition.validationRules) issues.push(...rule(model));
  return { model, issues };
}

export function templateModelKey(model: TemplateAntennaModel): string {
  return JSON.stringify({ model, conductor: useUIStore.getState().conductor });
}

export function feedPointCoordinates(model: TemplateAntennaModel) {
  const feedWire = model.wires.find((wire) => wire.id === model.feed.wireId);
  if (!feedWire) throw new Error("Feed wire does not exist.");
  const t = model.feed.position;
  return {
    x: feedWire.startM.x + (feedWire.endM.x - feedWire.startM.x) * t,
    y: feedWire.startM.y + (feedWire.endM.y - feedWire.startM.y) * t,
    z: feedWire.startM.z + (feedWire.endM.z - feedWire.startM.z) * t,
  };
}

export function hasTemplateErrors(generated: GeneratedTemplateModel): boolean {
  return generated.issues.some((issue) => issue.severity === "error");
}
