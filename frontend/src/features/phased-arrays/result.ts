import type { FrequencyResult, PatternData, SegmentCurrent, SimulationResult } from "../../api/nec";
import type { AdaptedPhasedNec } from "./nec-adapter";
import { absoluteSegmentNumber } from "./nec-adapter";
import { complexMagnitude, complexPhaseDeg, lineMetrics, normalizeBearingDeg, phasedArrayModelKey } from "./model";
import type {
  ComplexValue,
  ElementFeedCurrent,
  PhasedArrayModel,
  PhasedArraySolverResult,
  PhasedCurrentPoint,
  PhasedPatternPoint,
} from "./schema";

function angularDistanceDeg(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function necPhiToCompass(phiDeg: number): number {
  return normalizeBearingDeg(90 - phiDeg);
}

function compassToNecPhi(bearingDeg: number): number {
  return normalizeBearingDeg(90 - bearingDeg);
}

function nearestCircularIndex(start: number, step: number, count: number, angle: number): number {
  let best = 0;
  let distance = Infinity;
  for (let index = 0; index < count; index += 1) {
    const candidate = start + index * step;
    const candidateDistance = angularDistanceDeg(candidate, angle);
    if (candidateDistance < distance) { best = index; distance = candidateDistance; }
  }
  return best;
}

function plateauCentrePhi(pattern: PatternData, thetaIndex: number, peak: number): { phiDeg: number; groupCount: number } {
  const selected = Array.from({ length: pattern.phi_count }, (_, index) => index)
    .filter((index) => (pattern.gain_dbi[thetaIndex]?.[index] ?? -999.99) >= peak - 0.005);
  if (selected.length === 0) throw new Error("The peak-bearing plateau could not be resolved.");
  const groups: number[][] = [];
  for (const index of selected) {
    const previous = groups[groups.length - 1];
    if (previous && index === previous[previous.length - 1]! + 1) previous.push(index);
    else groups.push([index]);
  }
  const lastGroup = groups[groups.length - 1]!;
  if (groups.length > 1 && groups[0]![0] === 0 && lastGroup[lastGroup.length - 1] === pattern.phi_count - 1) {
    groups[0] = [...lastGroup, ...groups[0]!];
    groups.pop();
  }
  const centres = groups.map((group) => {
    const vectors = group.map((index) => (pattern.phi_start + index * pattern.phi_step) * Math.PI / 180);
    const radians = Math.atan2(vectors.reduce((sum, angle) => sum + Math.sin(angle), 0), vectors.reduce((sum, angle) => sum + Math.cos(angle), 0));
    return normalizeBearingDeg(radians * 180 / Math.PI);
  });
  // A bidirectional pattern has two equal plateaus. A stable lowest-compass
  // representative prevents the reported axis from jumping to the first
  // rounded grid sample while preserving the explicit ambiguity flag.
  return { phiDeg: centres.sort((a, b) => necPhiToCompass(a) - necPhiToCompass(b))[0]!, groupCount: centres.length };
}

function normalize(points: Array<{ angleDeg: number; gainDbi: number }>): PhasedPatternPoint[] {
  const finite = points.filter((point) => Number.isFinite(point.gainDbi) && point.gainDbi > -999);
  if (finite.length === 0) return [];
  const peak = Math.max(...finite.map((point) => point.gainDbi));
  return finite.map((point) => ({ ...point, normalizedDb: Math.max(-40, point.gainDbi - peak) }));
}

export interface PhasedDirectionalMetrics {
  forwardGainDbi: number;
  reverseGainDbi: number;
  maximumRearGainDbi: number;
  frontToBackDb: number;
  frontToRearDb: number;
  beamHeadingDeg: number;
  beamHeadingAmbiguous: boolean;
  takeOffAngleDeg: number;
  azimuthPattern: PhasedPatternPoint[];
  elevationPattern: PhasedPatternPoint[];
}

export function calculatePhasedDirectionalMetrics(pattern: PatternData): PhasedDirectionalMetrics {
  let peakThetaIndex = -1;
  let peak = -Infinity;
  for (let ti = 0; ti < pattern.theta_count; ti += 1) {
    for (let pi = 0; pi < pattern.phi_count; pi += 1) {
      const gain = pattern.gain_dbi[ti]?.[pi] ?? -999.99;
      if (Number.isFinite(gain) && gain > peak) { peak = gain; peakThetaIndex = ti; }
    }
  }
  if (peakThetaIndex < 0 || peak <= -999) throw new Error("The radiation grid contains no valid samples.");
  const plateau = plateauCentrePhi(pattern, peakThetaIndex, peak);
  const peakPhi = plateau.phiDeg;
  const heading = necPhiToCompass(peakPhi);
  const reversePhi = normalizeBearingDeg(peakPhi + 180);
  const reverseIndex = nearestCircularIndex(pattern.phi_start, pattern.phi_step, pattern.phi_count, reversePhi);
  const reverseGain = pattern.gain_dbi[peakThetaIndex]?.[reverseIndex] ?? -999.99;
  let rearPeak = -Infinity;
  for (let ti = 0; ti < pattern.theta_count; ti += 1) {
    for (let pi = 0; pi < pattern.phi_count; pi += 1) {
      const compass = necPhiToCompass(pattern.phi_start + pi * pattern.phi_step);
      if (angularDistanceDeg(compass, heading) > 90) rearPeak = Math.max(rearPeak, pattern.gain_dbi[ti]?.[pi] ?? -999.99);
    }
  }
  if (reverseGain <= -999 || rearPeak <= -999) throw new Error("The radiation grid does not contain usable reverse-hemisphere samples.");
  const azimuthPattern = normalize(Array.from({ length: pattern.phi_count }, (_, pi) => ({
    angleDeg: necPhiToCompass(pattern.phi_start + pi * pattern.phi_step),
    gainDbi: pattern.gain_dbi[peakThetaIndex]?.[pi] ?? -999.99,
  })).sort((a, b) => a.angleDeg - b.angleDeg));
  const headingPhiIndex = nearestCircularIndex(pattern.phi_start, pattern.phi_step, pattern.phi_count, compassToNecPhi(heading));
  const elevationPattern = normalize(Array.from({ length: pattern.theta_count }, (_, ti) => ({
    angleDeg: 90 - (pattern.theta_start + ti * pattern.theta_step),
    gainDbi: pattern.gain_dbi[ti]?.[headingPhiIndex] ?? -999.99,
  })).sort((a, b) => a.angleDeg - b.angleDeg));
  return {
    forwardGainDbi: peak,
    reverseGainDbi: reverseGain,
    maximumRearGainDbi: rearPeak,
    frontToBackDb: peak - reverseGain,
    frontToRearDb: peak - rearPeak,
    beamHeadingDeg: heading,
    beamHeadingAmbiguous: plateau.groupCount > 1 || Math.abs(peak - reverseGain) <= 0.1,
    takeOffAngleDeg: Math.max(0, Math.min(90, 90 - (pattern.theta_start + peakThetaIndex * pattern.theta_step))),
    azimuthPattern,
    elevationPattern,
  };
}

function currentForFeed(currents: SegmentCurrent[] | null, adapted: AdaptedPhasedNec, element: 1 | 2): SegmentCurrent {
  if (!currents?.length) throw new Error("The solver result does not contain element-current data.");
  const feed = adapted.segmentation.feeds[element - 1]!;
  const absolute = absoluteSegmentNumber(adapted.segmentation, feed.tag, feed.segment);
  const current = currents.find((point) => point.tag === feed.tag && point.segment === absolute);
  if (!current) throw new Error(`The solver current table does not contain element ${element}'s feed segment.`);
  return current;
}

function asComplex(current: SegmentCurrent): ComplexValue {
  return { real: current.current_real, imag: current.current_imag };
}

export function extractFeedCurrentComplexes(simulation: SimulationResult, adapted: AdaptedPhasedNec): [ComplexValue, ComplexValue] {
  if (simulation.frequency_data.length !== 1) throw new Error(`Expected one solved frequency, received ${simulation.frequency_data.length}.`);
  const currents = simulation.frequency_data[0]!.currents;
  return [asComplex(currentForFeed(currents, adapted, 1)), asComplex(currentForFeed(currents, adapted, 2))];
}

function mapCurrents(currents: SegmentCurrent[] | null, adapted: AdaptedPhasedNec): PhasedCurrentPoint[] {
  if (!currents?.length) throw new Error("The solver result does not contain element-current data.");
  const maximum = Math.max(...currents.map((point) => point.current_magnitude));
  if (!Number.isFinite(maximum) || maximum <= 0) throw new Error("The current table contains no positive finite magnitude.");
  return currents.map((point) => {
    const wireIndex = adapted.segmentation.wires.findIndex((wire) => wire.tag === point.tag);
    const wire = adapted.segmentation.wires[wireIndex];
    if (!wire) throw new Error(`Current table references unknown wire tag ${point.tag}.`);
    const firstAbsolute = adapted.segmentation.wires.slice(0, wireIndex).reduce((sum, candidate) => sum + candidate.segments, 0) + 1;
    const localSegment = point.segment - firstAbsolute + 1;
    if (localSegment < 1 || localSegment > wire.segments) throw new Error(`Current segment ${point.segment} lies outside wire tag ${point.tag}.`);
    return {
      wireId: wire.id,
      family: wire.family,
      tag: point.tag,
      segment: point.segment,
      fractionAlongWire: (localSegment - 0.5) / wire.segments,
      magnitudeA: point.current_magnitude,
      normalizedMagnitude: point.current_magnitude / maximum,
      phaseDeg: point.current_phase_deg,
      positionM: { x: point.x, y: point.y, z: point.z },
    };
  });
}

function elementFeedCurrent(element: 1 | 2, value: ComplexValue): ElementFeedCurrent {
  return { element, magnitudeA: complexMagnitude(value), phaseDeg: complexPhaseDeg(value), complex: value };
}

export interface PhasedValidationContext {
  requiredSourceVoltages: [ComplexValue, ComplexValue] | null;
  calibrationDecks: [string, string] | null;
  calibrationComputedInMs?: number;
  extraWarnings?: string[];
}

export function validatePhasedResult(
  model: PhasedArrayModel,
  adapted: AdaptedPhasedNec,
  simulation: SimulationResult,
  context: PhasedValidationContext,
): PhasedArraySolverResult {
  if (simulation.frequency_data.length !== 1) throw new Error(`Expected one solved frequency, received ${simulation.frequency_data.length}.`);
  const data: FrequencyResult = simulation.frequency_data[0]!;
  if (!data.pattern) throw new Error("The solver result does not contain a radiation pattern.");
  const metrics = calculatePhasedDirectionalMetrics(data.pattern);
  const feeds = extractFeedCurrentComplexes(simulation, adapted);
  const warnings = [
    ...adapted.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
    ...(context.extraWarnings ?? []),
    ...(metrics.beamHeadingAmbiguous ? ["The grid contains multiple tied peak directions or an opposite axial response within 0.1 dB. The displayed heading is a representative axis, not a unique forward direction."] : []),
    ...simulation.warnings,
  ];
  return {
    modelKey: phasedArrayModelKey(model),
    ...metrics,
    radiationPattern: data.pattern,
    currentDistribution: mapCurrents(data.currents, adapted),
    elementFeedCurrents: [elementFeedCurrent(1, feeds[0]), elementFeedCurrent(2, feeds[1])],
    requiredSourceVoltages: context.requiredSourceVoltages,
    networkInputImpedance: model.mode === "physical-feed-network"
      ? { real: data.impedance.real, imag: data.impedance.imag }
      : null,
    lineMetrics: model.mode === "physical-feed-network" ? [lineMetrics(model, 1), lineMetrics(model, 2)] : null,
    generatedNec: adapted.deck,
    calibrationDecks: context.calibrationDecks,
    engine: simulation.engine,
    computedInMs: simulation.computed_in_ms + (context.calibrationComputedInMs ?? 0),
    warnings: [...new Set(warnings)],
  };
}
