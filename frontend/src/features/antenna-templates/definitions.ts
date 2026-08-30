import { SPEED_OF_LIGHT_M_PER_S } from "../verified-dipole/model";
import { validateNearSurfaceRadialPlane } from "../ground-radials/model";
import { HF_AMATEUR_BANDS } from "./bands";
import type {
  AntennaTemplateDefinition,
  Point3M,
  TemplateParameterDefinition,
  TemplateValidationIssue,
  TemplateWire,
} from "./schema";

const SEGMENTATION = {
  maximumSegmentLengthWavelengths: 0.025,
  minimumSegmentsPerWire: 3,
  maximumSegmentsPerWire: 199,
  rationale: "Target at most 0.025 wavelength per segment; use odd counts so midpoint feeds land on a centre segment.",
} as const;

const frequencyParameter: TemplateParameterDefinition = {
  key: "frequencyHz", label: "Design frequency", description: "Frequency used to generate starting dimensions and run NEC.",
  quantity: "frequency", internalUnit: "Hz", metricUnit: "MHz", imperialUnit: "MHz",
  minSI: 1_800_000, maxSI: 54_000_000, stepSI: 10_000, defaultSI: 14_100_000, decimals: 3,
  slider: true, dimensional: false,
};

function lengthParameter(key: string, label: string, description: string, minimum = 0.05, maximum = 250, defaultSI = 10, stepSI = 0.05): TemplateParameterDefinition {
  return { key, label, description, quantity: "length", internalUnit: "m", metricUnit: "m", imperialUnit: "ft", minSI: minimum, maxSI: maximum, stepSI, defaultSI, decimals: stepSI < 0.01 ? 3 : 2, slider: true, dimensional: true };
}

const diameterParameter: TemplateParameterDefinition = {
  key: "wireDiameterM", label: "Wire diameter", description: "Physical conductor diameter used by NEC's thin-wire model.",
  quantity: "diameter", internalUnit: "m", metricUnit: "mm", imperialUnit: "in",
  minSI: 0.0005, maxSI: 0.025, stepSI: 0.0001, defaultSI: 0.001, decimals: 2,
  slider: true, dimensional: true,
};

function angleParameter(key: string, label: string, description: string, minDeg: number, maxDeg: number, defaultDeg: number): TemplateParameterDefinition {
  return { key, label, description, quantity: "angle", internalUnit: "rad", metricUnit: "deg", imperialUnit: "deg", minSI: minDeg * Math.PI / 180, maxSI: maxDeg * Math.PI / 180, stepSI: Math.PI / 180, defaultSI: defaultDeg * Math.PI / 180, decimals: 0, slider: true, dimensional: true };
}

function integerParameter(key: string, label: string, description: string, min: number, max: number, value: number): TemplateParameterDefinition {
  return { key, label, description, quantity: "integer", internalUnit: "count", metricUnit: "count", imperialUnit: "count", minSI: min, maxSI: max, stepSI: 1, defaultSI: value, decimals: 0, slider: true, dimensional: true };
}

function wire(id: string, startM: Point3M, endM: Point3M, diameterM: number): TemplateWire {
  return { id, startM, endM, diameterM };
}

function commonRules(model: Parameters<AntennaTemplateDefinition["validationRules"][number]>[0]): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];
  const radius = Math.max(...model.wires.map((item) => item.diameterM / 2));
  const lambda = SPEED_OF_LIGHT_M_PER_S / model.frequencyHz;
  const minimumZ = Math.min(...model.wires.flatMap((item) => [item.startM.z, item.endM.z]));
  if (model.groundConnection === "touching") {
    if (minimumZ < -1e-10 || !model.wires.some((item) => Math.abs(item.startM.z) < 1e-10 || Math.abs(item.endM.z) < 1e-10)) {
      issues.push({ severity: "error", code: "ground-contact", message: "This template must touch, but not penetrate, the ground plane." });
    }
  } else if (minimumZ <= radius) {
    issues.push({ severity: "error", code: "ground-clearance", message: "Every wire surface must remain above the ground plane." });
  }
  if (radius / lambda > 0.01) {
    issues.push({ severity: "warning", code: "thin-wire", message: "Wire radius exceeds 0.01 wavelength; NEC thin-wire validity may be suspect." });
  }
  return issues;
}

function surfaceRadialRules(model: Parameters<AntennaTemplateDefinition["validationRules"][number]>[0]): TemplateValidationIssue[] {
  if (model.ground.kind !== "real") {
    return [{ severity: "error", code: "surface-radial-real-ground", message: "The ground-mounted explicit-radial template requires real Sommerfeld/Norton ground. Use the Vertical Antennas lab for an ideal perfect-ground monopole." }];
  }
  return validateNearSurfaceRadialPlane({
    wireAxisHeightM: model.parametersSI.surfaceClearanceM!,
    wireDiameterM: model.parametersSI.wireDiameterM!,
    wavelengthM: SPEED_OF_LIGHT_M_PER_S / model.frequencyHz,
  });
}

type TemplateBaseInput = Omit<AntennaTemplateDefinition, "version" | "presets" | "segmentation" | "loads"> & {
  segmentation?: AntennaTemplateDefinition["segmentation"];
};

function templateBase(definition: TemplateBaseInput): AntennaTemplateDefinition {
  return { ...definition, version: 1, presets: HF_AMATEUR_BANDS, segmentation: definition.segmentation ?? SEGMENTATION, loads: () => [] };
}

export const antennaTemplateDefinitions: AntennaTemplateDefinition[] = [
  templateBase({
    id: "horizontal-dipole", name: "Horizontal dipole", shortDescription: "Centre-fed straight dipole above ground.", defaultBandId: "20m", groundRequirement: "recommended",
    rfNotes: ["The 0.475λ generated length is a starting estimate, not a resonance claim.", "Height and nearby conductors can materially change impedance."],
    parameters: [frequencyParameter, lengthParameter("totalLengthM", "Total length", "Tip-to-tip conductor length."), lengthParameter("heightM", "Height", "Wire height above ground.", 0.25, 120), diameterParameter],
    startingParameters: (frequencyHz) => { const l = SPEED_OF_LIGHT_M_PER_S / frequencyHz; return { frequencyHz, totalLengthM: l * 0.475, heightM: Math.min(100, l * 0.5), wireDiameterM: 0.001 }; },
    geometryGenerator: (p) => [wire("radiator", { x: -p.totalLengthM! / 2, y: 0, z: p.heightM! }, { x: p.totalLengthM! / 2, y: 0, z: p.heightM! }, p.wireDiameterM!)],
    feedPoint: (_p, wires) => ({ wireId: wires[0]!.id, position: 0.5, voltage: { realV: 1, imaginaryV: 0 } }), validationRules: [commonRules],
  }),
  templateBase({
    id: "inverted-v", name: "Inverted-V", shortDescription: "Centre-fed dipole with two drooping arms.", defaultBandId: "40m", groundRequirement: "recommended",
    rfNotes: ["Included angle changes both feed impedance and end clearance.", "The starting length includes only a generic end-effect allowance."],
    parameters: [frequencyParameter, lengthParameter("totalLengthM", "Total wire length", "Combined length of both arms."), lengthParameter("apexHeightM", "Apex height", "Height of the centre feed.", 1, 120), angleParameter("includedAngleRad", "Included angle", "Angle between the two arms.", 70, 180, 120), diameterParameter],
    startingParameters: (frequencyHz) => { const l = SPEED_OF_LIGHT_M_PER_S / frequencyHz; return { frequencyHz, totalLengthM: l * 0.47, apexHeightM: Math.min(100, l * 0.35), includedAngleRad: 120 * Math.PI / 180, wireDiameterM: 0.001 }; },
    geometryGenerator: (p) => { const arm = p.totalLengthM! / 2; const half = p.includedAngleRad! / 2; const dx = arm * Math.sin(half); const dz = arm * Math.cos(half); return [wire("left-arm", { x: -dx, y: 0, z: p.apexHeightM! - dz }, { x: 0, y: 0, z: p.apexHeightM! }, p.wireDiameterM!), wire("right-arm", { x: 0, y: 0, z: p.apexHeightM! }, { x: dx, y: 0, z: p.apexHeightM! - dz }, p.wireDiameterM!)]; },
    feedPoint: (_p, wires) => ({ wireId: wires[0]!.id, position: 1, voltage: { realV: 1, imaginaryV: 0 } }), validationRules: [commonRules],
  }),
  templateBase({
    id: "sloper", name: "Sloper", shortDescription: "Centre-fed straight dipole tilted from horizontal.", defaultBandId: "40m", groundRequirement: "recommended",
    rfNotes: ["This template is a centre-fed sloping dipole, not an end-fed half-sloper.", "Unequal surroundings can make measured behavior asymmetric."],
    parameters: [frequencyParameter, lengthParameter("totalLengthM", "Total length", "Tip-to-tip conductor length."), lengthParameter("centreHeightM", "Centre height", "Feed-point height.", 1, 120), angleParameter("slopeAngleRad", "Slope angle", "Tilt below horizontal toward the right endpoint.", 5, 70, 30), diameterParameter],
    startingParameters: (frequencyHz) => { const l = SPEED_OF_LIGHT_M_PER_S / frequencyHz; return { frequencyHz, totalLengthM: l * 0.47, centreHeightM: Math.min(100, l * 0.4), slopeAngleRad: 30 * Math.PI / 180, wireDiameterM: 0.001 }; },
    geometryGenerator: (p) => { const half = p.totalLengthM! / 2; const dx = half * Math.cos(p.slopeAngleRad!); const dz = half * Math.sin(p.slopeAngleRad!); return [wire("radiator", { x: -dx, y: 0, z: p.centreHeightM! + dz }, { x: dx, y: 0, z: p.centreHeightM! - dz }, p.wireDiameterM!)]; },
    feedPoint: (_p, wires) => ({ wireId: wires[0]!.id, position: 0.5, voltage: { realV: 1, imaginaryV: 0 } }), validationRules: [commonRules],
  }),
  templateBase({
    id: "quarter-wave-vertical", name: "Quarter-wave vertical", shortDescription: "Ground-mounted vertical with explicit near-surface radial wires over real soil.", defaultBandId: "20m", groundRequirement: "required",
    defaultGround: { kind: "real", conductivitySPerM: 0.005, relativePermittivity: 13 },
    segmentation: { ...SEGMENTATION, maximumSegmentLengthWavelengths: 0.02, rationale: "Target at most 0.02 wavelength per wire segment to match the validated specialist vertical-radial adapter." },
    rfNotes: ["Radials are current-carrying NEC wires raised slightly above real ground; they are not buried-wire geometry.", "0.2375λ radiator and 0.25λ radials are starting dimensions and must be tuned for the installation."],
    parameters: [frequencyParameter, lengthParameter("radiatorLengthM", "Radiator length", "Vertical conductor length."), lengthParameter("radialLengthM", "Radial length", "Length of every horizontal ground radial."), lengthParameter("surfaceClearanceM", "NEC radial clearance", "Wire-axis height above soil; not burial depth.", 0.001, 0.1, 0.01, 0.001), integerParameter("radialCount", "Radial count", "Number of explicit current-carrying radial wires.", 4, 64, 16), diameterParameter],
    startingParameters: (frequencyHz) => { const l = SPEED_OF_LIGHT_M_PER_S / frequencyHz; return { frequencyHz, radiatorLengthM: l * 0.2375, radialLengthM: l * 0.25, surfaceClearanceM: 0.01, radialCount: 16, wireDiameterM: 0.001 }; },
    geometryGenerator: (p) => { const base = { x: 0, y: 0, z: p.surfaceClearanceM! }; const wires = [wire("radiator", base, { ...base, z: base.z + p.radiatorLengthM! }, p.wireDiameterM!)]; const count = Math.round(p.radialCount!); for (let index = 0; index < count; index += 1) { const angle = index * 2 * Math.PI / count; wires.push(wire(`radial-${index + 1}`, { ...base }, { x: p.radialLengthM! * Math.cos(angle), y: p.radialLengthM! * Math.sin(angle), z: base.z }, p.wireDiameterM!)); } return wires; },
    feedPoint: (_p, wires) => ({ wireId: wires[0]!.id, position: 0, voltage: { realV: 1, imaginaryV: 0 } }), validationRules: [commonRules, surfaceRadialRules],
  }),
  templateBase({
    id: "ground-plane-vertical", name: "Ground-plane vertical", shortDescription: "Elevated vertical with configurable drooping radials.", defaultBandId: "20m", groundRequirement: "recommended",
    rfNotes: ["Radial droop can change feed impedance; no 50-ohm match is promised.", "Four generated radials are a starting geometry, not a universal efficiency optimum."],
    parameters: [frequencyParameter, lengthParameter("radiatorLengthM", "Radiator length", "Length of the vertical element."), lengthParameter("radialLengthM", "Radial length", "Length of each radial."), lengthParameter("baseHeightM", "Junction height", "Height of the radial junction.", 0.25, 80), integerParameter("radialCount", "Radial count", "Number of evenly spaced radial wires.", 3, 16, 4), angleParameter("radialDroopRad", "Radial droop", "Angle below horizontal.", 0, 45, 30), diameterParameter],
    startingParameters: (frequencyHz) => { const l = SPEED_OF_LIGHT_M_PER_S / frequencyHz; const radial = l * 0.24; return { frequencyHz, radiatorLengthM: l * 0.2375, radialLengthM: radial, baseHeightM: Math.min(60, Math.max(1, radial * 0.55)), radialCount: 4, radialDroopRad: 30 * Math.PI / 180, wireDiameterM: 0.001 }; },
    geometryGenerator: (p) => { const wires = [wire("radiator", { x: 0, y: 0, z: p.baseHeightM! }, { x: 0, y: 0, z: p.baseHeightM! + p.radiatorLengthM! }, p.wireDiameterM!)]; const count = Math.round(p.radialCount!); const horizontal = p.radialLengthM! * Math.cos(p.radialDroopRad!); const drop = p.radialLengthM! * Math.sin(p.radialDroopRad!); for (let i = 0; i < count; i += 1) { const a = 2 * Math.PI * i / count; wires.push(wire(`radial-${i + 1}`, { x: 0, y: 0, z: p.baseHeightM! }, { x: horizontal * Math.cos(a), y: horizontal * Math.sin(a), z: p.baseHeightM! - drop }, p.wireDiameterM!)); } return wires; },
    feedPoint: (_p, wires) => ({ wireId: wires[0]!.id, position: 0, voltage: { realV: 1, imaginaryV: 0 } }), validationRules: [commonRules],
  }),
  templateBase({
    id: "full-wave-loop", name: "Full-wave loop", shortDescription: "Polygonal approximation of a vertical circular full-wave loop.", defaultBandId: "20m", groundRequirement: "recommended",
    rfNotes: ["The perimeter starts at 1.02λ; shape, height and feed location shift resonance.", "Sixteen straight wires approximate the circle and are visible in the generated NEC deck."],
    parameters: [frequencyParameter, lengthParameter("perimeterM", "Loop perimeter", "Total conductor length around the loop."), lengthParameter("bottomHeightM", "Bottom height", "Clearance below the loop.", 0.25, 80), diameterParameter],
    startingParameters: (frequencyHz) => ({ frequencyHz, perimeterM: SPEED_OF_LIGHT_M_PER_S / frequencyHz * 1.02, bottomHeightM: 2, wireDiameterM: 0.001 }),
    geometryGenerator: (p) => { const count = 16; const halfStep = Math.PI / count; const radius = p.perimeterM! / (2 * count * Math.sin(halfStep)); const centerZ = p.bottomHeightM! + radius * Math.cos(halfStep); const points = Array.from({ length: count }, (_, i) => { const a = -Math.PI / 2 - halfStep + 2 * Math.PI * i / count; return { x: radius * Math.cos(a), y: 0, z: centerZ + radius * Math.sin(a) }; }); return points.map((point, i) => wire(`loop-${i + 1}`, point, points[(i + 1) % count]!, p.wireDiameterM!)); },
    feedPoint: (_p, wires) => ({ wireId: wires[0]!.id, position: 0.5, voltage: { realV: 1, imaginaryV: 0 } }), validationRules: [commonRules],
  }),
  templateBase({
    id: "delta-loop", name: "Delta loop", shortDescription: "Vertical equilateral full-wave triangular loop.", defaultBandId: "40m", groundRequirement: "recommended",
    rfNotes: ["The 1.02λ perimeter is only a construction starting point.", "This bottom-centre feed produces a horizontally oriented broadside case."],
    parameters: [frequencyParameter, lengthParameter("perimeterM", "Loop perimeter", "Total triangular loop conductor length."), lengthParameter("baseHeightM", "Base height", "Height of the bottom side.", 0.25, 80), diameterParameter],
    startingParameters: (frequencyHz) => ({ frequencyHz, perimeterM: SPEED_OF_LIGHT_M_PER_S / frequencyHz * 1.02, baseHeightM: 2, wireDiameterM: 0.001 }),
    geometryGenerator: (p) => { const side = p.perimeterM! / 3; const h = side * Math.sqrt(3) / 2; const left = { x: -side / 2, y: 0, z: p.baseHeightM! }; const right = { x: side / 2, y: 0, z: p.baseHeightM! }; const top = { x: 0, y: 0, z: p.baseHeightM! + h }; return [wire("base", left, right, p.wireDiameterM!), wire("right-side", right, top, p.wireDiameterM!), wire("left-side", top, left, p.wireDiameterM!)]; },
    feedPoint: (_p, wires) => ({ wireId: wires[0]!.id, position: 0.5, voltage: { realV: 1, imaginaryV: 0 } }), validationRules: [commonRules],
  }),
  templateBase({
    id: "square-loop", name: "Square loop", shortDescription: "Vertical full-wave square loop fed at the bottom centre.", defaultBandId: "20m", groundRequirement: "recommended",
    rfNotes: ["The 1.02λ perimeter is intentionally labelled a starting point.", "Feed impedance depends strongly on height, shape and environment."],
    parameters: [frequencyParameter, lengthParameter("perimeterM", "Loop perimeter", "Total conductor length around all four sides."), lengthParameter("bottomHeightM", "Bottom height", "Height of the lower side.", 0.25, 80), diameterParameter],
    startingParameters: (frequencyHz) => ({ frequencyHz, perimeterM: SPEED_OF_LIGHT_M_PER_S / frequencyHz * 1.02, bottomHeightM: 2, wireDiameterM: 0.001 }),
    geometryGenerator: (p) => { const side = p.perimeterM! / 4; const leftBottom = { x: -side / 2, y: 0, z: p.bottomHeightM! }; const rightBottom = { x: side / 2, y: 0, z: p.bottomHeightM! }; const rightTop = { x: side / 2, y: 0, z: p.bottomHeightM! + side }; const leftTop = { x: -side / 2, y: 0, z: p.bottomHeightM! + side }; return [wire("bottom", leftBottom, rightBottom, p.wireDiameterM!), wire("right", rightBottom, rightTop, p.wireDiameterM!), wire("top", rightTop, leftTop, p.wireDiameterM!), wire("left", leftTop, leftBottom, p.wireDiameterM!)]; },
    feedPoint: (_p, wires) => ({ wireId: wires[0]!.id, position: 0.5, voltage: { realV: 1, imaginaryV: 0 } }), validationRules: [commonRules],
  }),
];

export function getTemplateDefinition(id: AntennaTemplateDefinition["id"]): AntennaTemplateDefinition {
  const definition = antennaTemplateDefinitions.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown antenna template: ${id}`);
  return definition;
}
