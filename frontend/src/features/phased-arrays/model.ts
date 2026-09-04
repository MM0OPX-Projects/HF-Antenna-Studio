import { defaultNearSurfaceClearanceM, validateNearSurfaceRadialPlane } from "../ground-radials/model";
import { SPEED_OF_LIGHT_M_PER_S } from "../verified-dipole/model";
import { useUIStore } from "../../stores/uiStore";
import type {
  GeneratedPhasedArray,
  LineMetrics,
  PhasedArrayModel,
  PhasedIssue,
  PhasedNetworkPath,
  PhasedPoint3M,
  PhasedRadialTopology,
  PhasedWire,
  RadialRepresentation,
} from "./schema";

export function phasedWavelengthM(frequencyHz: number): number {
  return SPEED_OF_LIGHT_M_PER_S / frequencyHz;
}

export function normalizeBearingDeg(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function startingPhasedArrayModel(frequencyHz = 14_100_000): PhasedArrayModel {
  const lambda = phasedWavelengthM(frequencyHz);
  return {
    schemaVersion: 1,
    kind: "two-element-phased-vertical-array",
    mode: "ideal-current-phase",
    frequencyHz,
    elementLengthM: lambda * 0.2375,
    elementBaseHeightM: 0,
    elementDiameterM: 0.001,
    spacingM: lambda * 0.25,
    bearingDeg: 90,
    ideal: { amplitude1: 1, amplitude2: 1, phase1Deg: 0, phase2Deg: 0 },
    physical: {
      topology: "parallel-junction",
      characteristicImpedanceOhm: 50,
      velocityFactor: 0.66,
      lengthInput: "electrical",
      line1Value: 0,
      line2Value: 0,
      sourceTerminationOhm: null,
      port1TerminationOhm: null,
      port2TerminationOhm: null,
    },
    ground: { kind: "perfect" },
    radials: {
      representation: "perfect-ground-image",
      topology: "independent-per-element",
      count: 0,
      lengthM: lambda * 0.25,
      droopAngleRad: 20 * Math.PI / 180,
      diameterM: 0.001,
    },
    provenance: { dimensionsAreStartingPoints: true, manualDimensions: false },
  };
}

export function switchPhasedRadialRepresentation(
  model: PhasedArrayModel,
  representation: RadialRepresentation,
): PhasedArrayModel {
  if (representation === "perfect-ground-image") {
    return {
      ...model,
      elementBaseHeightM: 0,
      ground: { kind: "perfect" },
      radials: { ...model.radials, representation, topology: "independent-per-element", count: 0 },
    };
  }
  if (representation === "near-surface-explicit-wires") {
    return {
      ...model,
      elementBaseHeightM: defaultNearSurfaceClearanceM(model.radials.diameterM),
      ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 },
      radials: { ...model.radials, representation, topology: "shared-bonded-network", count: 16, droopAngleRad: 0 },
    };
  }
  return {
    ...model,
    elementBaseHeightM: Math.max(model.elementBaseHeightM, phasedWavelengthM(model.frequencyHz) * 0.1),
    radials: { ...model.radials, representation, topology: "independent-per-element", count: Math.max(4, model.radials.count) },
  };
}

export function switchPhasedRadialTopology(model: PhasedArrayModel, topology: PhasedRadialTopology): PhasedArrayModel {
  return { ...model, radials: { ...model.radials, topology } };
}

export function regeneratePhasedStartingDimensions(model: PhasedArrayModel, frequencyHz: number): PhasedArrayModel {
  const next = startingPhasedArrayModel(frequencyHz);
  return {
    ...model,
    frequencyHz,
    elementLengthM: next.elementLengthM,
    spacingM: next.spacingM,
    elementBaseHeightM: model.radials.representation === "near-surface-explicit-wires"
      ? defaultNearSurfaceClearanceM(model.radials.diameterM)
      : model.elementBaseHeightM,
    radials: { ...model.radials, lengthM: next.radials.lengthM },
    provenance: { ...model.provenance, manualDimensions: false },
  };
}

export function phaseComplex(amplitude: number, phaseDeg: number) {
  const radians = phaseDeg * Math.PI / 180;
  return { real: amplitude * Math.cos(radians), imag: amplitude * Math.sin(radians) };
}

export function complexMagnitude(value: { real: number; imag: number }): number {
  return Math.hypot(value.real, value.imag);
}

export function complexPhaseDeg(value: { real: number; imag: number }): number {
  const phaseDeg = Math.atan2(value.imag, value.real) * 180 / Math.PI;
  return Math.abs(phaseDeg) < 1e-9 ? 0 : phaseDeg;
}

export function lineMetrics(model: PhasedArrayModel, line: 1 | 2): LineMetrics {
  const value = line === 1 ? model.physical.line1Value : model.physical.line2Value;
  const lambda = phasedWavelengthM(model.frequencyHz);
  const vf = model.physical.velocityFactor;
  let physicalLengthM: number;
  let electricalLengthDeg: number;
  let delayS: number;
  if (model.physical.lengthInput === "physical") {
    physicalLengthM = value;
    delayS = physicalLengthM / (vf * SPEED_OF_LIGHT_M_PER_S);
    electricalLengthDeg = delayS * model.frequencyHz * 360;
  } else if (model.physical.lengthInput === "electrical") {
    electricalLengthDeg = value;
    delayS = electricalLengthDeg / 360 / model.frequencyHz;
    physicalLengthM = delayS * vf * SPEED_OF_LIGHT_M_PER_S;
  } else {
    delayS = value * 1e-9;
    physicalLengthM = delayS * vf * SPEED_OF_LIGHT_M_PER_S;
    electricalLengthDeg = delayS * model.frequencyHz * 360;
  }
  return { physicalLengthM, electricalLengthDeg, delayS, necEquivalentLengthM: lambda * electricalLengthDeg / 360 };
}

function pointAtBearing(origin: PhasedPoint3M, bearingDeg: number, distanceM: number): PhasedPoint3M {
  const radians = bearingDeg * Math.PI / 180;
  return { x: origin.x + Math.sin(radians) * distanceM, y: origin.y + Math.cos(radians) * distanceM, z: origin.z };
}

export function elementBases(model: PhasedArrayModel): [PhasedPoint3M, PhasedPoint3M] {
  const centre = { x: 0, y: 0, z: model.elementBaseHeightM };
  return [pointAtBearing(centre, model.bearingDeg + 180, model.spacingM / 2), pointAtBearing(centre, model.bearingDeg, model.spacingM / 2)];
}

function addIndependentRadials(model: PhasedArrayModel, wires: PhasedWire[], bases: [PhasedPoint3M, PhasedPoint3M]): void {
  const horizontal = model.radials.lengthM * Math.cos(model.radials.droopAngleRad);
  const drop = model.radials.lengthM * Math.sin(model.radials.droopAngleRad);
  for (const [element, base] of [[1, bases[0]], [2, bases[1]]] as const) {
    for (let index = 0; index < model.radials.count; index += 1) {
      const radialBearing = model.bearingDeg + 45 + index * 360 / model.radials.count;
      const end = pointAtBearing(base, radialBearing, horizontal);
      end.z = base.z - drop;
      wires.push({
        id: `element-${element}-radial-${index + 1}`,
        family: element === 1 ? "radial-1" : "radial-2",
        startM: { ...base },
        endM: end,
        diameterM: model.radials.diameterM,
      });
    }
  }
}

function addSharedBondedRadials(model: PhasedArrayModel, wires: PhasedWire[], bases: [PhasedPoint3M, PhasedPoint3M]): void {
  const centre = { x: 0, y: 0, z: model.elementBaseHeightM };
  wires.push(
    { id: "ground-bond-1", family: "ground-bond", startM: { ...bases[0] }, endM: { ...centre }, diameterM: model.radials.diameterM },
    { id: "ground-bond-2", family: "ground-bond", startM: { ...centre }, endM: { ...bases[1] }, diameterM: model.radials.diameterM },
  );
  const offsetDeg = 90 / model.radials.count;
  for (let index = 0; index < model.radials.count; index += 1) {
    const radialBearing = model.bearingDeg + offsetDeg + index * 360 / model.radials.count;
    wires.push({
      id: `shared-radial-${index + 1}`,
      family: "radial-shared",
      startM: { ...centre },
      endM: pointAtBearing(centre, radialBearing, model.radials.lengthM),
      diameterM: model.radials.diameterM,
    });
  }
}

export function buildPhasedWires(model: PhasedArrayModel): { wires: PhasedWire[]; networkPaths: PhasedNetworkPath[] } {
  const bases = elementBases(model);
  const wires: PhasedWire[] = [
    { id: "element-1", family: "element-1", startM: bases[0], endM: { ...bases[0], z: bases[0].z + model.elementLengthM }, diameterM: model.elementDiameterM },
    { id: "element-2", family: "element-2", startM: bases[1], endM: { ...bases[1], z: bases[1].z + model.elementLengthM }, diameterM: model.elementDiameterM },
  ];
  if (model.radials.representation !== "perfect-ground-image") {
    if (model.radials.topology === "shared-bonded-network") addSharedBondedRadials(model, wires, bases);
    else addIndependentRadials(model, wires, bases);
  }

  const networkPaths: PhasedNetworkPath[] = [];
  if (model.mode === "physical-feed-network") {
    const lambda = phasedWavelengthM(model.frequencyHz);
    const hubHeight = Math.max(model.elementBaseHeightM + lambda * 0.025, lambda * 0.025);
    const half = Math.max(lambda * 0.0015, model.elementDiameterM * 3);
    const perpendicular = normalizeBearingDeg(model.bearingDeg + 90);
    const hubCentre = { x: 0, y: 0, z: hubHeight };
    const start = pointAtBearing(hubCentre, perpendicular + 180, half);
    const end = pointAtBearing(hubCentre, perpendicular, half);
    wires.push({ id: "source-junction", family: "source-junction", startM: start, endM: end, diameterM: model.elementDiameterM });
    networkPaths.push(
      { id: "feed-line-1", kind: "transmission-line", fromM: hubCentre, toM: bases[0], line: 1 },
      { id: "feed-line-2", kind: "transmission-line", fromM: model.physical.topology === "parallel-junction" ? hubCentre : bases[0], toM: bases[1], line: 2 },
    );
  }
  return { wires, networkPaths };
}

function range(value: number, min: number, max: number, code: string, label: string): PhasedIssue[] {
  return !Number.isFinite(value) || value < min || value > max
    ? [{ severity: "error", code, message: `${label} must be between ${min} and ${max}.` }]
    : [];
}

function validateRadials(model: PhasedArrayModel, wires: PhasedWire[], lambda: number): PhasedIssue[] {
  const issues: PhasedIssue[] = [];
  if (model.radials.representation === "perfect-ground-image") {
    if (model.ground.kind !== "perfect") issues.push({ severity: "error", code: "image-ground", message: "The no-wire image-ground configuration requires infinite perfect ground." });
    if (model.elementBaseHeightM !== 0) issues.push({ severity: "error", code: "image-height", message: "Image-ground monopoles must start exactly at z = 0; select an explicit-radial mode for raised elements." });
    if (model.radials.count !== 0) issues.push({ severity: "error", code: "image-radials", message: "The image-ground configuration has no explicit radial wires." });
    return issues;
  }

  issues.push(
    ...range(model.radials.lengthM, 0.2, 100, "radial-length", "Radial length (m)"),
    ...range(model.radials.diameterM, 0.0002, 0.1, "radial-diameter", "Radial diameter (m)"),
    ...range(model.radials.droopAngleRad, 0, Math.PI / 3, "radial-droop", "Radial droop (radians)"),
  );
  const minimumCount = model.radials.topology === "shared-bonded-network" ? 4 : 2;
  if (!Number.isInteger(model.radials.count) || model.radials.count < minimumCount || model.radials.count > 64) {
    issues.push({ severity: "error", code: "radial-count", message: `The selected radial topology requires an integer radial count from ${minimumCount} to 64.` });
  }
  const minimumZ = Math.min(...wires.flatMap((wire) => [wire.startM.z, wire.endM.z]));
  if (minimumZ <= 0) issues.push({ severity: "error", code: "radial-clearance", message: "Every explicit radial must remain strictly above z = 0." });

  if (model.radials.representation === "near-surface-explicit-wires") {
    if (model.ground.kind !== "sommerfeld-norton") issues.push({ severity: "error", code: "surface-ground", message: "Near-surface explicit radials require Sommerfeld/Norton real ground." });
    if (Math.abs(model.radials.droopAngleRad) > 1e-12) issues.push({ severity: "error", code: "surface-droop", message: "Near-surface radial wires must remain horizontal; use elevated explicit radials for droop." });
    issues.push(...validateNearSurfaceRadialPlane({ wireAxisHeightM: model.elementBaseHeightM, wireDiameterM: model.radials.diameterM, wavelengthM: lambda }));
    if (model.radials.topology === "independent-per-element" && model.radials.lengthM * 2 >= model.spacingM) {
      issues.push({ severity: "error", code: "independent-radial-overlap", message: "Independent near-surface radial fields overlap. Shorten the radials, increase spacing, or select the connected shared radial network." });
    }
  } else {
    if (model.radials.topology !== "independent-per-element") issues.push({ severity: "error", code: "elevated-shared-topology", message: "Elevated radials currently support only independent per-element fields." });
    if (model.radials.lengthM * Math.cos(model.radials.droopAngleRad) > model.spacingM / 2) {
      issues.push({ severity: "warning", code: "radial-overlap", message: "The two elevated radial fields overlap in plan view. Inspect the 3D geometry for unintended crossings; automatic crossing junctions are not inserted." });
    }
  }
  return issues;
}

export function validatePhasedArrayModel(model: PhasedArrayModel, wires: PhasedWire[]): PhasedIssue[] {
  const lambda = phasedWavelengthM(model.frequencyHz);
  const issues: PhasedIssue[] = [
    ...range(model.frequencyHz, 1_800_000, 54_000_000, "frequency", "Frequency (Hz)"),
    ...range(model.elementLengthM, 0.2, 60, "element-length", "Element length (m)"),
    ...range(model.elementBaseHeightM, 0, 60, "element-height", "Element feed height (m)"),
    ...range(model.elementDiameterM, 0.0002, 0.1, "element-diameter", "Element diameter (m)"),
    ...range(model.spacingM, 0.05, 100, "spacing", "Element spacing (m)"),
    ...range(model.bearingDeg, 0, 360, "bearing", "Array bearing (degrees)"),
    ...range(model.ideal.amplitude1, 0, 10, "amplitude-1", "Element 1 relative amplitude"),
    ...range(model.ideal.amplitude2, 0, 10, "amplitude-2", "Element 2 relative amplitude"),
    ...range(model.ideal.phase1Deg, -360, 360, "phase-1", "Element 1 phase"),
    ...range(model.ideal.phase2Deg, -360, 360, "phase-2", "Element 2 phase"),
    ...validateRadials(model, wires, lambda),
  ];
  if (model.mode === "ideal-current-phase" && model.ideal.amplitude1 === 0 && model.ideal.amplitude2 === 0) {
    issues.push({ severity: "error", code: "zero-excitation", message: "At least one ideal target-current amplitude must be positive." });
  }
  if (model.ground.kind === "sommerfeld-norton") {
    issues.push(
      ...range(model.ground.conductivitySPerM, 0.00001, 10, "conductivity", "Ground conductivity (S/m)"),
      ...range(model.ground.relativePermittivity, 1, 100, "permittivity", "Ground relative permittivity"),
    );
  }
  if (model.spacingM / lambda < 0.05) issues.push({ severity: "warning", code: "close-spacing", message: "Spacing is below 0.05 wavelength; mutual coupling and segmentation sensitivity may be extreme." });
  if (model.spacingM / model.elementDiameterM < 4) issues.push({ severity: "error", code: "wire-spacing", message: "Vertical elements must be separated by at least four diameters." });

  if (model.mode === "physical-feed-network") {
    issues.push(
      ...range(model.physical.characteristicImpedanceOhm, 10, 1000, "line-z0", "Coax characteristic impedance (ohm)"),
      ...range(model.physical.velocityFactor, 0.3, 1, "velocity-factor", "Velocity factor"),
    );
    const max = model.physical.lengthInput === "physical" ? 300 : model.physical.lengthInput === "electrical" ? 1440 : 10_000;
    issues.push(
      ...range(model.physical.line1Value, 0, max, "line-1", "Line 1 length"),
      ...range(model.physical.line2Value, 0, max, "line-2", "Line 2 length"),
    );
    for (const [name, value] of [["Source", model.physical.sourceTerminationOhm], ["Port 1", model.physical.port1TerminationOhm], ["Port 2", model.physical.port2TerminationOhm]] as const) {
      if (value !== null) issues.push(...range(value, 1, 100_000, `termination-${name}`, `${name} shunt termination (ohm)`));
    }
    if (model.physical.topology === "series-cascade") issues.push({ severity: "warning", code: "cascade-not-series-current", message: "The cascade is a TL network tapped at element 1; NEC does not enforce identical series current through both radiators." });
    issues.push({ severity: "warning", code: "lossless-lines", message: "NEC TL cards are ideal non-radiating, lossless lines. Coax shield common-mode current, loss, connectors, and junction parasitics are not represented." });
  }

  for (const wire of wires) {
    const length = Math.hypot(wire.endM.x - wire.startM.x, wire.endM.y - wire.startM.y, wire.endM.z - wire.startM.z);
    if (![length, wire.diameterM, wire.startM.x, wire.startM.y, wire.startM.z, wire.endM.x, wire.endM.y, wire.endM.z].every(Number.isFinite) || length <= 0) {
      issues.push({ severity: "error", code: `wire-${wire.id}`, message: `${wire.id} has invalid or zero-length geometry.` });
    }
    if (wire.diameterM / lambda > 0.01) issues.push({ severity: "warning", code: `thick-${wire.id}`, message: `${wire.id} is electrically thick for NEC-2's thin-wire approximation.` });
  }
  return issues;
}

export function generatePhasedArray(model: PhasedArrayModel): GeneratedPhasedArray {
  const built = buildPhasedWires(model);
  return { model, ...built, issues: validatePhasedArrayModel(model, built.wires) };
}

export function phasedArrayModelKey(model: PhasedArrayModel): string {
  return JSON.stringify({ model, conductor: useUIStore.getState().conductor });
}

export function idealCalibrationKey(model: PhasedArrayModel): string {
  const { ideal: _ideal, physical: _physical, provenance: _provenance, ...geometry } = model;
  return JSON.stringify({ ...geometry, mode: "ideal-calibration" });
}

export function hasPhasedErrors(generated: GeneratedPhasedArray): boolean {
  return generated.issues.some((issue) => issue.severity === "error");
}
