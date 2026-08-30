import { HF_AMATEUR_BANDS } from "../antenna-templates/bands";
import { defaultNearSurfaceClearanceM, validateNearSurfaceRadialPlane } from "../ground-radials/model";
import { SPEED_OF_LIGHT_M_PER_S } from "../verified-dipole/model";
import type {
  GeneratedVerticalModel,
  VerticalAntennaModel,
  VerticalConfiguration,
  VerticalGround,
  VerticalIssue,
  VerticalWire,
} from "./schema";

export { HF_AMATEUR_BANDS as VERTICAL_BAND_PRESETS };

export function wavelengthM(frequencyHz: number): number {
  return SPEED_OF_LIGHT_M_PER_S / frequencyHz;
}

export function startingVerticalModel(
  frequencyHz = 14_100_000,
  configuration: VerticalConfiguration = "elevated-explicit-radials",
): VerticalAntennaModel {
  const lambda = wavelengthM(frequencyHz);
  const elevated = configuration === "elevated-explicit-radials";
  const nearSurface = configuration === "ground-mounted-explicit-radials";
  const approximation = configuration === "nec-radial-screen-approximation";
  return {
    schemaVersion: 1,
    kind: "quarter-wave-vertical-system",
    configuration,
    frequencyHz,
    radiatorLengthM: lambda * 0.2375,
    radiatorDiameterM: 0.001,
    baseHeightM: elevated ? lambda * 0.12 : nearSurface ? defaultNearSurfaceClearanceM(0.001) : 0,
    radials: {
      representation: elevated || nearSurface ? "explicit-wires" : approximation ? "nec-ground-screen" : "none",
      count: elevated ? 4 : nearSurface ? 16 : approximation ? 16 : 0,
      lengthM: lambda * 0.25,
      droopAngleRad: elevated ? 25 * Math.PI / 180 : 0,
      diameterM: 0.001,
    },
    ground: approximation
      ? { kind: "reflection-coefficient", conductivitySPerM: 0.005, relativePermittivity: 13 }
      : nearSurface
        ? { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 }
      : { kind: "perfect" },
    referenceImpedanceOhm: 50,
    provenance: { dimensionsAreStartingPoints: true, manualDimensions: false },
  };
}

export function regenerateVerticalStartingDimensions(model: VerticalAntennaModel, frequencyHz: number): VerticalAntennaModel {
  const lambda = wavelengthM(frequencyHz);
  return {
    ...model,
    frequencyHz,
    radiatorLengthM: lambda * 0.2375,
    baseHeightM: model.configuration === "elevated-explicit-radials"
      ? lambda * 0.12
      : model.configuration === "ground-mounted-explicit-radials"
        ? defaultNearSurfaceClearanceM(model.radials.diameterM)
        : 0,
    radials: { ...model.radials, lengthM: lambda * 0.25 },
    provenance: { ...model.provenance, manualDimensions: false },
  };
}

export function switchVerticalConfiguration(model: VerticalAntennaModel, configuration: VerticalConfiguration): VerticalAntennaModel {
  const next = startingVerticalModel(model.frequencyHz, configuration);
  const radialDiameterM = model.radials.diameterM;
  return {
    ...next,
    radiatorDiameterM: model.radiatorDiameterM,
    baseHeightM: configuration === "ground-mounted-explicit-radials"
      ? defaultNearSurfaceClearanceM(radialDiameterM)
      : next.baseHeightM,
    radials: { ...next.radials, diameterM: radialDiameterM },
    referenceImpedanceOhm: model.referenceImpedanceOhm,
  };
}

export function buildVerticalWires(model: VerticalAntennaModel): VerticalWire[] {
  const base = { x: 0, y: 0, z: model.baseHeightM };
  const wires: VerticalWire[] = [{
    id: "radiator",
    family: "radiator",
    startM: base,
    endM: { x: 0, y: 0, z: model.baseHeightM + model.radiatorLengthM },
    diameterM: model.radiatorDiameterM,
  }];
  if (model.radials.representation !== "explicit-wires") return wires;
  const horizontalLength = model.radials.lengthM * Math.cos(model.radials.droopAngleRad);
  const drop = model.radials.lengthM * Math.sin(model.radials.droopAngleRad);
  for (let index = 0; index < model.radials.count; index += 1) {
    const azimuth = index * 2 * Math.PI / model.radials.count;
    wires.push({
      id: `radial-${index + 1}`,
      family: "radial",
      startM: { ...base },
      endM: {
        x: Math.cos(azimuth) * horizontalLength,
        y: Math.sin(azimuth) * horizontalLength,
        z: model.baseHeightM - drop,
      },
      diameterM: model.radials.diameterM,
    });
  }
  return wires;
}

function rangeIssue(value: number, min: number, max: number, code: string, label: string): VerticalIssue[] {
  if (!Number.isFinite(value)) return [{ severity: "error", code, message: `${label} must be finite.` }];
  return value < min || value > max
    ? [{ severity: "error", code, message: `${label} must be between ${min} and ${max}.` }]
    : [];
}

export function validateVerticalModel(model: VerticalAntennaModel, wires = buildVerticalWires(model)): VerticalIssue[] {
  const issues: VerticalIssue[] = [
    ...rangeIssue(model.frequencyHz, 1_800_000, 54_000_000, "frequency-range", "Frequency (Hz)"),
    ...rangeIssue(model.radiatorLengthM, 0.2, 60, "radiator-length-range", "Radiator length (m)"),
    ...rangeIssue(model.radiatorDiameterM, 0.0002, 0.1, "radiator-diameter-range", "Radiator diameter (m)"),
    ...rangeIssue(model.baseHeightM, 0, 60, "base-height-range", "Base height (m)"),
    ...rangeIssue(model.radials.lengthM, 0.2, 100, "radial-length-range", "Radial length (m)"),
    ...rangeIssue(model.radials.diameterM, 0.0002, 0.1, "radial-diameter-range", "Radial diameter (m)"),
    ...rangeIssue(model.radials.droopAngleRad, 0, Math.PI / 3, "radial-angle-range", "Radial droop angle"),
  ];
  if (!Number.isInteger(model.radials.count) || model.radials.count < 0 || model.radials.count > 128) {
    issues.push({ severity: "error", code: "radial-count-range", message: "Radial count must be an integer from 0 to 128." });
  }
  if (model.ground.kind !== "perfect") {
    issues.push(...rangeIssue(model.ground.conductivitySPerM, 0.00001, 10, "ground-conductivity-range", "Ground conductivity (S/m)"));
    issues.push(...rangeIssue(model.ground.relativePermittivity, 1, 100, "ground-permittivity-range", "Ground relative permittivity"));
  }

  if (model.configuration === "ground-mounted-ideal") {
    if (model.ground.kind !== "perfect") issues.push({ severity: "error", code: "ideal-requires-perfect", message: "The ground-contact ideal monopole is valid here only with perfect ground." });
    if (model.baseHeightM !== 0) issues.push({ severity: "error", code: "ideal-base-height", message: "The ideal ground-mounted radiator base must be exactly at z = 0." });
    if (model.radials.representation !== "none" || model.radials.count !== 0) issues.push({ severity: "error", code: "ideal-radials", message: "The ideal infinite ground plane does not contain explicit radial wires." });
  }
  if (model.configuration === "ground-mounted-explicit-radials") {
    if (model.ground.kind !== "sommerfeld-norton") issues.push({ severity: "error", code: "surface-requires-sommerfeld", message: "The near-surface explicit radial model requires Sommerfeld/Norton real ground." });
    if (model.radials.representation !== "explicit-wires") issues.push({ severity: "error", code: "surface-representation", message: "The near-surface model requires explicit current-carrying radial wires." });
    if (model.radials.count < 4) issues.push({ severity: "error", code: "surface-radial-count", message: "The near-surface radial field requires at least four explicit radial wires." });
    if (Math.abs(model.radials.droopAngleRad) > 1e-12) issues.push({ severity: "error", code: "surface-radial-plane", message: "Near-surface radial wires must remain in one horizontal plane; use the elevated mode for drooping radials." });
    issues.push(...validateNearSurfaceRadialPlane({ wireAxisHeightM: model.baseHeightM, wireDiameterM: model.radials.diameterM, wavelengthM: wavelengthM(model.frequencyHz) }));
    if (model.radials.count > 64) issues.push({ severity: "warning", code: "surface-large-junction", message: "More than 64 radial wires meet at one feed junction; verify the NEC segment-count and junction convergence." });
  }
  if (model.configuration === "elevated-explicit-radials") {
    if (model.radials.representation !== "explicit-wires") issues.push({ severity: "error", code: "explicit-representation", message: "The elevated ground plane requires explicit radial wires." });
    if (model.radials.count < 2) issues.push({ severity: "error", code: "explicit-radial-count", message: "An elevated ground plane requires at least two radial wires; three or more are normally appropriate." });
    const lowestZ = Math.min(...wires.flatMap((wire) => [wire.startM.z, wire.endM.z]));
    if (lowestZ <= 0) issues.push({ severity: "error", code: "radial-ground-intersection", message: "Explicit elevated radial wires must remain above z = 0; raise the base, shorten the radials, or reduce droop." });
    const lambda = wavelengthM(model.frequencyHz);
    if (model.ground.kind === "sommerfeld-norton" && lowestZ < lambda / 1000) {
      issues.push({ severity: "warning", code: "sommerfeld-clearance", message: `The lowest wire is below 0.001λ (${(lambda / 1000).toFixed(4)} m); run a height/segmentation sensitivity study.` });
    }
    if (model.radials.count > 16) issues.push({ severity: "warning", code: "large-junction", message: "More than 16 explicit wires meet at the feed junction; check segment convergence and compare a simplified screen model." });
  }
  if (model.configuration === "nec-radial-screen-approximation") {
    if (model.ground.kind !== "reflection-coefficient") issues.push({ severity: "error", code: "screen-requires-rca-ground", message: "NEC-2's radial-screen approximation requires its finite-ground reflection-coefficient mode; it cannot be combined with Sommerfeld/Norton." });
    if (model.radials.representation !== "nec-ground-screen") issues.push({ severity: "error", code: "screen-representation", message: "The simplified model must use the NEC radial-screen representation, not explicit wires." });
    if (model.baseHeightM !== 0) issues.push({ severity: "error", code: "screen-base-height", message: "The NEC radial-screen approximation is centred at the origin with the radiator base at z = 0." });
    if (model.radials.count < 4) issues.push({ severity: "error", code: "screen-radial-count", message: "The NEC radial-screen approximation requires at least four radials in this application." });
    issues.push({ severity: "warning", code: "screen-simplification", message: "The NEC radial-screen card is an impedance/reflection approximation. Its radials are not explicit current-carrying wires and edge diffraction is omitted." });
  }

  const lambda = wavelengthM(model.frequencyHz);
  for (const wire of wires) {
    const length = Math.hypot(wire.endM.x - wire.startM.x, wire.endM.y - wire.startM.y, wire.endM.z - wire.startM.z);
    if (![length, wire.diameterM, wire.startM.x, wire.startM.y, wire.startM.z, wire.endM.x, wire.endM.y, wire.endM.z].every(Number.isFinite) || length <= 0) {
      issues.push({ severity: "error", code: `wire-${wire.id}-geometry`, message: `${wire.id} has invalid or zero-length geometry.` });
    }
    if (wire.diameterM / lambda > 0.01) issues.push({ severity: "warning", code: `wire-${wire.id}-thick`, message: `${wire.id} is electrically thick for a thin-wire NEC model.` });
  }
  return issues;
}

export function generateVerticalModel(model: VerticalAntennaModel): GeneratedVerticalModel {
  const wires = buildVerticalWires(model);
  return { model, wires, issues: validateVerticalModel(model, wires) };
}

export function verticalModelKey(model: VerticalAntennaModel): string {
  return JSON.stringify(model);
}

export function hasVerticalErrors(generated: GeneratedVerticalModel): boolean {
  return generated.issues.some((issue) => issue.severity === "error");
}

export function withVerticalGround(model: VerticalAntennaModel, ground: VerticalGround): VerticalAntennaModel {
  return { ...model, ground };
}
