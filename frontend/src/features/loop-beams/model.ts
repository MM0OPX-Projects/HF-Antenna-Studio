import { SPEED_OF_LIGHT_M_PER_S } from "../verified-dipole/model";
import { buildG3txqBroadbandHexbeam, g3txqFeedGapM } from "../../engine/g3txq-hexbeam";
import { useUIStore } from "../../stores/uiStore";
import type { CubicalQuadModel, DeltaFeedLocation, DeltaLoopModel, DiamondLoopModel, GeneratedLoopBeamModel, HexBand, HexbeamBandDimensions, HexbeamModel, LoopBeamIssue, LoopBeamModel, LoopBeamPoint3M, LoopBeamSupport, LoopBeamWire, MultibandHexbeamModel, SquareLoopModel } from "./schema";

export const LOOP_BEAM_BANDS: ReadonlyArray<{ id: HexBand; label: string; frequencyHz: number }> = [
  { id: "20m", label: "20 m", frequencyHz: 14_175_000 }, { id: "17m", label: "17 m", frequencyHz: 18_118_000 },
  { id: "15m", label: "15 m", frequencyHz: 21_225_000 }, { id: "12m", label: "12 m", frequencyHz: 24_940_000 },
  { id: "10m", label: "10 m", frequencyHz: 28_500_000 }, { id: "6m", label: "6 m", frequencyHz: 50_300_000 },
];

const HEX_REFERENCE_INCHES: Record<HexBand, { driverHalf: number; reflector: number; endSpacing: number }> = {
  "20m": { driverHalf: 218, reflector: 412, endSpacing: 24 },
  "17m": { driverHalf: 169.5, reflector: 321, endSpacing: 18.5 },
  "15m": { driverHalf: 144.5, reflector: 274.4, endSpacing: 16 },
  "12m": { driverHalf: 121.7, reflector: 232, endSpacing: 13.5 },
  "10m": { driverHalf: 106.8, reflector: 204.4, endSpacing: 12 },
  "6m": { driverHalf: 58, reflector: 111.4, endSpacing: 6.5 },
};
// The multiband mode uses the published K4KIO assembly table.  Keep the
// legacy single-band values above unchanged so existing saved models and
// regression fixtures retain their original geometry.
const MULTIBAND_HEX_REFERENCE_INCHES: Record<HexBand, { driverHalf: number; reflector: number; endSpacing: number }> = {
  "20m": { driverHalf: 214, reflector: 404, endSpacing: 24 },
  "17m": { driverHalf: 166, reflector: 314.5, endSpacing: 18.5 },
  "15m": { driverHalf: 142.9, reflector: 271.8, endSpacing: 16 },
  "12m": { driverHalf: 119.3, reflector: 227.3, endSpacing: 13.5 },
  "10m": { driverHalf: 104.5, reflector: 200.3, endSpacing: 12 },
  "6m": { driverHalf: 58, reflector: 111.4, endSpacing: 6.5 },
};
const inches = (value: number) => value * 0.0254;
export function loopBeamWavelengthM(frequencyHz: number): number { return SPEED_OF_LIGHT_M_PER_S / frequencyHz; }
const common = (frequencyHz: number) => ({ schemaVersion: 1 as const, frequencyHz, elementDiameterM: 0.001, ground: { kind: "sommerfeld-norton" as const, conductivitySPerM: 0.005, relativePermittivity: 13 }, referenceImpedanceOhm: 50 as const, provenance: { dimensionsAreStartingPoints: true as const, manualDimensions: false } });

export function startingSquareLoopModel(frequencyHz = 14_175_000): SquareLoopModel {
  const lambda = loopBeamWavelengthM(frequencyHz); return { ...common(frequencyHz), kind: "square-loop", sideLengthM: lambda * 1.02 / 4, bottomHeightM: lambda * 0.25 };
}
export function startingDeltaLoopModel(frequencyHz = 14_175_000, feedLocation: DeltaFeedLocation = "bottom"): DeltaLoopModel {
  const lambda = loopBeamWavelengthM(frequencyHz); const side = lambda * 1.02 / 3; return { ...common(frequencyHz), kind: "delta-loop", baseWidthM: side, loopHeightM: side * Math.sqrt(3) / 2, apexOffsetM: 0, bottomHeightM: lambda * 0.25, feedLocation };
}
export function startingDiamondLoopModel(frequencyHz = 14_175_000): DiamondLoopModel {
  const lambda = loopBeamWavelengthM(frequencyHz); const side = lambda * 1.02 / 4; return { ...common(frequencyHz), kind: "diamond-loop", widthM: side * Math.sqrt(2), loopHeightM: side * Math.sqrt(2), bottomHeightM: lambda * 0.25 };
}
export function startingCubicalQuadModel(frequencyHz = 14_175_000, loopCount: 2 | 3 | 4 = 2): CubicalQuadModel {
  const lambda = loopBeamWavelengthM(frequencyHz); return { ...common(frequencyHz), kind: "cubical-quad", loopCount, drivenPerimeterM: lambda * 1.02, reflectorPerimeterM: lambda * 1.05, directorPerimetersM: [lambda * 0.97, lambda * 0.95].slice(0, loopCount - 2), reflectorSpacingM: lambda * 0.2, directorSpacingsM: [lambda * 0.2, lambda * 0.22].slice(0, loopCount - 2), centreHeightM: lambda * 0.75 };
}
export function startingHexbeamModel(band: HexBand = "20m", frequencyHz?: number): HexbeamModel {
  const bandInfo = LOOP_BEAM_BANDS.find((item) => item.id === band)!; const ref = HEX_REFERENCE_INCHES[band]; const requestedFrequency = frequencyHz ?? bandInfo.frequencyHz; const scale = bandInfo.frequencyHz / requestedFrequency;
  return { ...common(requestedFrequency), kind: "hexbeam", band, drivenHalfLengthM: inches(ref.driverHalf) * scale, reflectorTotalLengthM: inches(ref.reflector) * scale, endSpacingM: inches(ref.endSpacing) * scale, heightM: loopBeamWavelengthM(requestedFrequency) * 0.5, provenance: { dimensionsAreStartingPoints: true, manualDimensions: false, reference: "Steve Hunt G3TXQ broadband Hexbeam bare-wire dimensions" } };
}

function startingMultibandHexbeamBandDimensions(band: HexBand, frequencyHz = LOOP_BEAM_BANDS.find((item) => item.id === band)!.frequencyHz): HexbeamBandDimensions {
  const bandInfo = LOOP_BEAM_BANDS.find((item) => item.id === band)!; const ref = MULTIBAND_HEX_REFERENCE_INCHES[band]; const scale = bandInfo.frequencyHz / frequencyHz;
  return { drivenHalfLengthM: inches(ref.driverHalf) * scale, reflectorTotalLengthM: inches(ref.reflector) * scale, endSpacingM: inches(ref.endSpacing) * scale };
}

export const ALL_HEX_BANDS: readonly HexBand[] = LOOP_BEAM_BANDS.map((item) => item.id);

export function startingMultibandHexbeamModel(bands: readonly HexBand[] = ALL_HEX_BANDS, frequencyHz = 14_175_000): MultibandHexbeamModel {
  const selected = [...new Set(bands)].filter((band): band is HexBand => ALL_HEX_BANDS.includes(band));
  const safeBands = selected.length > 0 ? selected : ["20m", "17m"] as HexBand[];
  return {
    ...common(frequencyHz), kind: "multiband-hexbeam", bands: safeBands, activeBand: "auto",
    bandDimensions: Object.fromEntries(safeBands.map((band) => [band, startingMultibandHexbeamBandDimensions(band)])),
    heightM: loopBeamWavelengthM(frequencyHz) * 0.5, stackSpacingM: 0.1, longestBandExtraSpacingM: 0.1,
    provenance: { dimensionsAreStartingPoints: true, manualDimensions: false, reference: "K4KIO/G3TXQ multiband Hexbeam band table" },
  };
}

export function activeMultibandHexbeamBand(model: MultibandHexbeamModel): HexBand {
  if (model.activeBand !== "auto" && model.bands.includes(model.activeBand)) return model.activeBand;
  if (model.bands.length === 0) return "20m";
  return model.bands.reduce((best, candidate) => {
    const bestFrequency = LOOP_BEAM_BANDS.find((item) => item.id === best)!.frequencyHz;
    const candidateFrequency = LOOP_BEAM_BANDS.find((item) => item.id === candidate)!.frequencyHz;
    return Math.abs(candidateFrequency - model.frequencyHz) < Math.abs(bestFrequency - model.frequencyHz) ? candidate : best;
  }, model.bands[0]!);
}

export function multibandStackSpacingM(model: MultibandHexbeamModel): number {
  return Number.isFinite(model.stackSpacingM) && model.stackSpacingM! > 0 ? model.stackSpacingM! : 0.1;
}

export function multibandLongestBandExtraSpacingM(model: MultibandHexbeamModel): number {
  return Number.isFinite(model.longestBandExtraSpacingM) && model.longestBandExtraSpacingM! >= 0 ? model.longestBandExtraSpacingM! : 0.1;
}
export function startingLoopBeamModel(kind: LoopBeamModel["kind"]): LoopBeamModel {
  if (kind === "square-loop") return startingSquareLoopModel(); if (kind === "delta-loop") return startingDeltaLoopModel(); if (kind === "diamond-loop") return startingDiamondLoopModel(); if (kind === "cubical-quad") return startingCubicalQuadModel(); if (kind === "hexbeam") return startingHexbeamModel(); return startingMultibandHexbeamModel();
}

function distance(a: LoopBeamPoint3M, b: LoopBeamPoint3M): number { return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }
function pointOn(a: LoopBeamPoint3M, b: LoopBeamPoint3M, fraction: number): LoopBeamPoint3M { return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction, z: a.z + (b.z - a.z) * fraction }; }
function feedEdge(wires: LoopBeamWire[], id: string, family: LoopBeamWire["family"], a: LoopBeamPoint3M, b: LoopBeamPoint3M, diameterM: number, fraction: number, lambda: number): string {
  const length = distance(a, b); const bridge = Math.min(length * 0.12, Math.max(lambda * 0.002, diameterM * 6)); const halfFraction = bridge / length / 2;
  const before = pointOn(a, b, fraction - halfFraction); const after = pointOn(a, b, fraction + halfFraction);
  if (distance(a, before) > diameterM * 2) wires.push({ id: `${id}-a`, family, startM: a, endM: before, diameterM });
  const feedId = `${id}-feed`; wires.push({ id: feedId, family, startM: before, endM: after, diameterM, source: true });
  if (distance(after, b) > diameterM * 2) wires.push({ id: `${id}-b`, family, startM: after, endM: b, diameterM }); return feedId;
}
function wire(wires: LoopBeamWire[], id: string, family: LoopBeamWire["family"], startM: LoopBeamPoint3M, endM: LoopBeamPoint3M, diameterM: number) { wires.push({ id, family, startM, endM, diameterM }); }
function orientation(wireValue: LoopBeamWire): GeneratedLoopBeamModel["feedConductorOrientation"] { const horizontal = Math.hypot(wireValue.endM.x - wireValue.startM.x, wireValue.endM.y - wireValue.startM.y); const vertical = Math.abs(wireValue.endM.z - wireValue.startM.z); return vertical < horizontal * 0.05 ? "horizontal" : horizontal < vertical * 0.05 ? "vertical" : "sloping"; }

function squareWires(model: SquareLoopModel) {
  const wires: LoopBeamWire[] = []; const h = model.bottomHeightM; const s = model.sideLengthM; const d = model.elementDiameterM; const l = loopBeamWavelengthM(model.frequencyHz);
  const bl = { x: -s / 2, y: 0, z: h }, br = { x: s / 2, y: 0, z: h }, tr = { x: s / 2, y: 0, z: h + s }, tl = { x: -s / 2, y: 0, z: h + s };
  const feedWireId = feedEdge(wires, "driven-bottom", "driven", bl, br, d, 0.5, l); wire(wires, "driven-right", "driven", br, tr, d); wire(wires, "driven-top", "driven", tr, tl, d); wire(wires, "driven-left", "driven", tl, bl, d); return { wires, supports: [] as LoopBeamSupport[], feedWireId };
}
function deltaWires(model: DeltaLoopModel) {
  const wires: LoopBeamWire[] = []; const d = model.elementDiameterM; const l = loopBeamWavelengthM(model.frequencyHz); const left = { x: -model.baseWidthM / 2, y: 0, z: model.bottomHeightM }; const right = { x: model.baseWidthM / 2, y: 0, z: model.bottomHeightM }; const apex = { x: model.apexOffsetM, y: 0, z: model.bottomHeightM + model.loopHeightM }; let feedWireId: string;
  if (model.feedLocation === "bottom") { feedWireId = feedEdge(wires, "driven-bottom", "driven", left, right, d, 0.5, l); wire(wires, "driven-right", "driven", right, apex, d); wire(wires, "driven-left", "driven", apex, left, d); }
  else { wire(wires, "driven-bottom", "driven", left, right, d); wire(wires, "driven-right", "driven", right, apex, d); const fractionFromApex = model.feedLocation === "lower-corner" ? 0.88 : 0.5; feedWireId = feedEdge(wires, "driven-left", "driven", apex, left, d, fractionFromApex, l); }
  return { wires, supports: [] as LoopBeamSupport[], feedWireId };
}
function diamondWires(model: DiamondLoopModel) {
  const wires: LoopBeamWire[] = []; const d = model.elementDiameterM; const l = loopBeamWavelengthM(model.frequencyHz); const bottom = { x: 0, y: 0, z: model.bottomHeightM }; const left = { x: -model.widthM / 2, y: 0, z: model.bottomHeightM + model.loopHeightM / 2 }; const top = { x: 0, y: 0, z: model.bottomHeightM + model.loopHeightM }; const right = { x: model.widthM / 2, y: 0, z: model.bottomHeightM + model.loopHeightM / 2 };
  const feedWireId = feedEdge(wires, "driven-lower-left", "driven", bottom, left, d, 0.5, l); wire(wires, "driven-upper-left", "driven", left, top, d); wire(wires, "driven-upper-right", "driven", top, right, d); wire(wires, "driven-lower-right", "driven", right, bottom, d); return { wires, supports: [] as LoopBeamSupport[], feedWireId };
}
function addQuadLoop(wires: LoopBeamWire[], prefix: string, family: LoopBeamWire["family"], perimeter: number, y: number, centreHeight: number, diameter: number, lambda: number, driven: boolean): string | null {
  const s = perimeter / 4; const bottom = centreHeight - s / 2; const bl = { x: -s / 2, y, z: bottom }, br = { x: s / 2, y, z: bottom }, tr = { x: s / 2, y, z: bottom + s }, tl = { x: -s / 2, y, z: bottom + s }; let feed: string | null = null;
  if (driven) feed = feedEdge(wires, `${prefix}-bottom`, family, bl, br, diameter, 0.5, lambda); else wire(wires, `${prefix}-bottom`, family, bl, br, diameter); wire(wires, `${prefix}-right`, family, br, tr, diameter); wire(wires, `${prefix}-top`, family, tr, tl, diameter); wire(wires, `${prefix}-left`, family, tl, bl, diameter); return feed;
}
function quadWires(model: CubicalQuadModel) {
  const wires: LoopBeamWire[] = []; const lambda = loopBeamWavelengthM(model.frequencyHz); addQuadLoop(wires, "reflector", "reflector", model.reflectorPerimeterM, -model.reflectorSpacingM, model.centreHeightM, model.elementDiameterM, lambda, false); const feedWireId = addQuadLoop(wires, "driven", "driven", model.drivenPerimeterM, 0, model.centreHeightM, model.elementDiameterM, lambda, true)!; let y = 0;
  for (let index = 0; index < model.loopCount - 2; index += 1) { y += model.directorSpacingsM[index]!; addQuadLoop(wires, `director-${index + 1}`, "director", model.directorPerimetersM[index]!, y, model.centreHeightM, model.elementDiameterM, lambda, false); } return { wires, supports: [] as LoopBeamSupport[], feedWireId };
}
function hexWires(model: HexbeamModel) {
  const lambda = loopBeamWavelengthM(model.frequencyHz); const d = model.elementDiameterM;
  const geometry = buildG3txqBroadbandHexbeam({ drivenHalfLengthM: model.drivenHalfLengthM, reflectorTotalLengthM: model.reflectorTotalLengthM, endSpacingM: model.endSpacingM, feedGapM: g3txqFeedGapM(lambda, d), heightM: model.heightM });
  const wires: LoopBeamWire[] = geometry.sections.map((section) => ({ ...section, diameterM: d }));
  return { wires, supports: geometry.supports as LoopBeamSupport[], feedWireId: "driven-feed" };
}

function multibandHexWires(model: MultibandHexbeamModel) {
  const activeBand = activeMultibandHexbeamBand(model); const selected = [...new Set(model.bands)].filter((band): band is HexBand => ALL_HEX_BANDS.includes(band));
  // K4KIO-style band sets are physically separated along the common centre
  // post.  Keep the shortest-wavelength band at the base and stack longer
  // wavelength bands upward in deterministic order.
  const stack = [...selected].sort((a, b) => LOOP_BEAM_BANDS.find((item) => item.id === b)!.frequencyHz - LOOP_BEAM_BANDS.find((item) => item.id === a)!.frequencyHz);
  const stackIndexByBand = new Map(stack.map((band, index) => [band, index] as const)); const stackHeights = new Map<HexBand, number>(); const normalSpacingM = multibandStackSpacingM(model); const extra17To20M = multibandLongestBandExtraSpacingM(model); let nextHeightM = model.heightM;
  for (let index = 0; index < stack.length; index += 1) { const band = stack[index]!; stackHeights.set(band, nextHeightM); const nextBand = stack[index + 1]; if (nextBand) nextHeightM += normalSpacingM + (band === "17m" && nextBand === "20m" ? extra17To20M : 0); }
  const allWires: LoopBeamWire[] = []; const supports: LoopBeamSupport[] = [];
  // Keep the user's selected-band order for stable wire/source tags while
  // deriving each band's physical height from the sorted stack order.
  for (const band of selected) {
    const stackIndex = stackIndexByBand.get(band) ?? 0;
    const dimensions = model.bandDimensions[band]; if (!dimensions) continue;
    const bandFrequency = LOOP_BEAM_BANDS.find((item) => item.id === band)!.frequencyHz;
    const heightM = stackHeights.get(band) ?? model.heightM + stackIndex * normalSpacingM;
    const layout = buildG3txqBroadbandHexbeam({ ...dimensions, feedGapM: g3txqFeedGapM(loopBeamWavelengthM(bandFrequency), model.elementDiameterM), heightM, includeFeedBridge: band === activeBand });
    supports.push(...layout.supports.map((support) => ({ ...support, id: `${band}-${support.id}` })));
    allWires.push(...layout.sections.map((section) => ({ ...section, id: `${band}-${section.id}`, band, diameterM: model.elementDiameterM })));
  }
  for (let index = 0; index < stack.length - 1; index += 1) supports.push({ id: `mast-${index + 1}`, startM: { x: 0, y: 0, z: stackHeights.get(stack[index]!) ?? model.heightM }, endM: { x: 0, y: 0, z: stackHeights.get(stack[index + 1]!) ?? model.heightM } });
  return { wires: allWires, supports, feedWireId: `${activeBand}-driven-feed`, activeBand };
}

function range(value: number, min: number, max: number, code: string, label: string): LoopBeamIssue[] { return !Number.isFinite(value) || value < min || value > max ? [{ severity: "error", code, message: `${label} must be between ${min} and ${max}.` }] : []; }
export function validateLoopBeamModel(model: LoopBeamModel, wires: LoopBeamWire[], feedWireId: string): LoopBeamIssue[] {
  const lambda = loopBeamWavelengthM(model.frequencyHz); const issues: LoopBeamIssue[] = [...range(model.frequencyHz, 1_800_000, 54_000_000, "frequency", "Frequency (Hz)"), ...range(model.elementDiameterM, 0.0002, 0.1, "diameter", "Wire diameter (m)")];
  if (model.ground.kind === "sommerfeld-norton") issues.push(...range(model.ground.conductivitySPerM, 0.00001, 10, "conductivity", "Ground conductivity (S/m)"), ...range(model.ground.relativePermittivity, 1, 100, "permittivity", "Ground relative permittivity"));
  if (model.kind === "square-loop") issues.push(...range(model.sideLengthM, 0.2, 50, "side", "Side length (m)"), ...range(model.bottomHeightM, 0.05, 80, "height", "Bottom height (m)"));
  if (model.kind === "delta-loop") { issues.push(...range(model.baseWidthM, 0.2, 80, "base", "Base width (m)"), ...range(model.loopHeightM, 0.2, 80, "loop-height", "Loop height (m)"), ...range(model.bottomHeightM, 0.05, 80, "height", "Bottom height (m)")); if (Math.abs(model.apexOffsetM) > model.baseWidthM) issues.push({ severity: "error", code: "apex-offset", message: "Apex offset must remain within one base width of the loop centre." }); }
  if (model.kind === "diamond-loop") issues.push(...range(model.widthM, 0.2, 80, "width", "Loop width (m)"), ...range(model.loopHeightM, 0.2, 80, "loop-height", "Loop height (m)"), ...range(model.bottomHeightM, 0.05, 80, "height", "Bottom height (m)"));
  if (model.kind === "cubical-quad") { issues.push(...range(model.drivenPerimeterM, 1, 200, "driven-perimeter", "Driven perimeter (m)"), ...range(model.reflectorPerimeterM, 1, 200, "reflector-perimeter", "Reflector perimeter (m)"), ...range(model.reflectorSpacingM, 0.05, 40, "reflector-spacing", "Reflector spacing (m)"), ...range(model.centreHeightM, 0.2, 100, "centre-height", "Loop centre height (m)")); if (model.directorPerimetersM.length !== model.loopCount - 2 || model.directorSpacingsM.length !== model.loopCount - 2) issues.push({ severity: "error", code: "quad-array-shape", message: "Director dimensions and spacings must match the selected loop count." }); const largestHalf = Math.max(model.reflectorPerimeterM, model.drivenPerimeterM, ...model.directorPerimetersM) / 8; if (model.centreHeightM <= largestHalf) issues.push({ severity: "error", code: "quad-ground-contact", message: "Every quad loop must remain strictly above the ground plane." }); }
  if (model.kind === "hexbeam") { issues.push(...range(model.drivenHalfLengthM, 0.5, 50, "driver-length", "Driven half-wire length (m)"), ...range(model.reflectorTotalLengthM, 1, 100, "reflector-length", "Reflector length (m)"), ...range(model.endSpacingM, 0.02, 10, "end-spacing", "End spacing (m)"), ...range(model.heightM, 0.2, 100, "height", "Height (m)")); const layout = buildG3txqBroadbandHexbeam({ drivenHalfLengthM: model.drivenHalfLengthM, reflectorTotalLengthM: model.reflectorTotalLengthM, endSpacingM: model.endSpacingM, feedGapM: g3txqFeedGapM(lambda, model.elementDiameterM), heightM: model.heightM }); if (layout.drivenOuterLegM <= 0) issues.push({ severity: "error", code: "hex-driver-fit", message: "Each driven half-wire must be long enough to reach the front spreader and continue along the frame perimeter." }); if (layout.reflectorTipOffsetM >= layout.frameRadiusM) issues.push({ severity: "error", code: "hex-reflector-fit", message: "The selected lengths and tip spacing do not fit the G3TXQ broadband reflector path on the hexagonal frame." }); if (!layout.canonical || wires.some((item) => ![item.startM.x, item.startM.y, item.startM.z, item.endM.x, item.endM.y, item.endM.z].every(Number.isFinite))) issues.push({ severity: "error", code: "hex-canonical-geometry", message: "The selected dimensions cannot form the canonical G3TXQ broadband Hexbeam geometry." }); issues.push({ severity: "warning", code: "hex-topology", message: "This is a single-band G3TXQ broadband Hexbeam wire path. Support sag, insulation, mast/feed-line coupling, and multiband interaction are not modelled." }); }
  if (model.kind === "multiband-hexbeam") {
    const selected = [...new Set(model.bands)];
    if (selected.length < 2 || selected.length > ALL_HEX_BANDS.length) issues.push({ severity: "error", code: "multiband-band-count", message: "Select between two and six Hexbeam bands." });
    if (selected.length !== model.bands.length) issues.push({ severity: "error", code: "multiband-band-duplicate", message: "Each Hexbeam band may be selected only once." });
    if (selected.some((band) => !ALL_HEX_BANDS.includes(band))) issues.push({ severity: "error", code: "multiband-band-id", message: "The selected Hexbeam band list contains an unknown band." });
    issues.push(...range(model.heightM, 0.2, 100, "height", "Lowest-band height (m)"), ...range(multibandStackSpacingM(model), 0.05, 2, "stack-spacing", "Band stack spacing (m)"), ...range(multibandLongestBandExtraSpacingM(model), 0, 2, "long-band-spacing", "17–20 m additional spacing (m)"));
    for (const band of selected) {
      const dimensions = model.bandDimensions[band];
      if (!dimensions) { issues.push({ severity: "error", code: `multiband-dimensions-${band}`, message: `Starting dimensions for ${band} are missing.` }); continue; }
      issues.push(...range(dimensions.drivenHalfLengthM, 0.5, 50, `driver-length-${band}`, `${band} driven half-wire length (m)`), ...range(dimensions.reflectorTotalLengthM, 1, 100, `reflector-length-${band}`, `${band} reflector length (m)`), ...range(dimensions.endSpacingM, 0.02, 10, `end-spacing-${band}`, `${band} end spacing (m)`));
    }
    const active = activeMultibandHexbeamBand(model); if (!selected.includes(active)) issues.push({ severity: "error", code: "multiband-active-band", message: "The active Hexbeam band must be one of the selected bands." });
    issues.push({ severity: "warning", code: "multiband-topology", message: "Selected bands share one visual six-arm frame; only the active band's driver is fed and the other driver gaps remain open. Mast, support, insulation, and feed-line coupling are not modelled." });
  }
  const ids = new Set<string>(); for (const item of wires) { if (ids.has(item.id)) issues.push({ severity: "error", code: `duplicate-${item.id}`, message: `Wire identifier ${item.id} is duplicated.` }); ids.add(item.id); const length = distance(item.startM, item.endM); if (!Number.isFinite(length) || length <= 0) issues.push({ severity: "error", code: `zero-${item.id}`, message: `${item.id} has invalid or zero length.` }); if (item.diameterM / lambda > 0.01) issues.push({ severity: "warning", code: `thick-${item.id}`, message: `${item.id} is electrically thick for NEC-2's thin-wire approximation.` }); if (Math.min(item.startM.z, item.endM.z) <= 0) issues.push({ severity: "error", code: `ground-${item.id}`, message: `${item.id} touches or crosses the ground plane.` }); }
  const sourceWires = wires.filter((item) => item.source); if (sourceWires.length !== 1 || sourceWires[0]?.id !== feedWireId) issues.push({ severity: "error", code: "feed-identity", message: "The generated geometry must contain exactly one explicit feed bridge." });
  const degree = new Map<string, number>(); const key = (p: LoopBeamPoint3M) => `${p.x.toFixed(8)}|${p.y.toFixed(8)}|${p.z.toFixed(8)}`; for (const item of wires) { degree.set(key(item.startM), (degree.get(key(item.startM)) ?? 0) + 1); degree.set(key(item.endM), (degree.get(key(item.endM)) ?? 0) + 1); } const openEnds = [...degree.values()].filter((value) => value === 1).length; const expectedOpenEnds = model.kind === "hexbeam" ? 4 : model.kind === "multiband-hexbeam" ? 4 + (new Set(model.bands).size - 1) * 6 : 0; if ((model.kind === "hexbeam" && openEnds !== expectedOpenEnds) || (model.kind === "multiband-hexbeam" && openEnds !== expectedOpenEnds) || (!["hexbeam", "multiband-hexbeam"].includes(model.kind) && openEnds !== 0)) issues.push({ severity: "error", code: "connectivity", message: model.kind === "multiband-hexbeam" ? "A multiband Hexbeam must keep each passive driver's feed gap open alongside the four active-band element tips." : model.kind === "hexbeam" ? "A hexbeam must have exactly two open driven-element tips and two open reflector tips." : "Every polygon loop must be electrically closed at its wire endpoints." });
  if (wires.reduce((sum, item) => sum + distance(item.startM, item.endM), 0) / lambda > 10) issues.push({ severity: "warning", code: "large-model", message: "The model contains more than ten wavelengths of wire; inspect segment count and solve time." }); return issues;
}
export function generateLoopBeamModel(model: LoopBeamModel): GeneratedLoopBeamModel {
  const built = model.kind === "square-loop" ? squareWires(model) : model.kind === "delta-loop" ? deltaWires(model) : model.kind === "diamond-loop" ? diamondWires(model) : model.kind === "cubical-quad" ? quadWires(model) : model.kind === "hexbeam" ? hexWires(model) : multibandHexWires(model); const feed = built.wires.find((item) => item.id === built.feedWireId);
  return { model, ...built, feedConductorOrientation: feed ? orientation(feed) : "horizontal", intendedForwardAxis: model.kind === "cubical-quad" || model.kind === "hexbeam" || model.kind === "multiband-hexbeam" ? "+Y" : null, issues: validateLoopBeamModel(model, built.wires, built.feedWireId) };
}
export function resizeCubicalQuad(model: CubicalQuadModel, loopCount: 2 | 3 | 4): CubicalQuadModel { const base = startingCubicalQuadModel(model.frequencyHz, loopCount); return { ...model, loopCount, directorPerimetersM: base.directorPerimetersM.map((value, i) => model.directorPerimetersM[i] ?? value), directorSpacingsM: base.directorSpacingsM.map((value, i) => model.directorSpacingsM[i] ?? value), provenance: { ...model.provenance, manualDimensions: true } }; }
export function loopBeamModelKey(model: LoopBeamModel): string { return JSON.stringify({ model, conductor: useUIStore.getState().conductor }); }
export function hasLoopBeamErrors(generated: GeneratedLoopBeamModel): boolean { return generated.issues.some((issue) => issue.severity === "error"); }
