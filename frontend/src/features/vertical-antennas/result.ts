import type { FrequencyResult, SegmentCurrent, SimulationResult } from "../../api/nec";
import { computeSwr } from "../../engine/parsers/nec-output";
import type { AdaptedVerticalNec } from "./nec-adapter";
import type { VerticalAntennaModel, VerticalCurrentPoint, VerticalPatternPoint, VerticalSolverResult } from "./schema";
import { extractFullElevationCut } from "../../components/results/full-elevation-cut";

function normalize(points: Array<{ angleDeg: number; gainDbi: number }>): VerticalPatternPoint[] {
  const finite = points.filter((point) => Number.isFinite(point.gainDbi) && point.gainDbi > -999);
  if (finite.length === 0) return [];
  const maximum = Math.max(...finite.map((point) => point.gainDbi));
  return finite.map((point) => ({ ...point, normalizedDb: Math.max(-40, point.gainDbi - maximum) }));
}

function extractPatterns(data: FrequencyResult): { azimuth: VerticalPatternPoint[]; elevation: VerticalPatternPoint[]; variationDb: number } {
  const pattern = data.pattern;
  if (!pattern) throw new Error("The solver result does not contain a radiation pattern.");
  let bestTheta = 0;
  let bestPhi = 0;
  let maximum = -Infinity;
  for (let thetaIndex = 0; thetaIndex < pattern.theta_count; thetaIndex += 1) {
    for (let phiIndex = 0; phiIndex < pattern.phi_count; phiIndex += 1) {
      const gain = pattern.gain_dbi[thetaIndex]?.[phiIndex] ?? -999.99;
      if (gain > maximum) { maximum = gain; bestTheta = thetaIndex; bestPhi = phiIndex; }
    }
  }
  if (!Number.isFinite(maximum) || maximum <= -999) throw new Error("The radiation grid contains no valid gain samples.");
  const azimuthRaw = Array.from({ length: pattern.phi_count }, (_, index) => ({
    angleDeg: pattern.phi_start + index * pattern.phi_step,
    gainDbi: pattern.gain_dbi[bestTheta]?.[index] ?? -999.99,
  }));
  const elevationRaw = extractFullElevationCut(pattern, pattern.phi_start + bestPhi * pattern.phi_step);
  const finiteAzimuth = azimuthRaw.filter((point) => point.gainDbi > -999);
  const variationDb = Math.max(...finiteAzimuth.map((point) => point.gainDbi)) - Math.min(...finiteAzimuth.map((point) => point.gainDbi));
  return { azimuth: normalize(azimuthRaw), elevation: normalize(elevationRaw), variationDb };
}

function mapCurrents(currents: SegmentCurrent[] | null, adapted: AdaptedVerticalNec): VerticalCurrentPoint[] {
  if (!currents || currents.length === 0) throw new Error("The solver result does not contain element-current data.");
  const maximum = Math.max(...currents.map((point) => point.current_magnitude));
  if (!Number.isFinite(maximum) || maximum <= 0) throw new Error("The current table contains no positive finite magnitude.");
  return currents.map((point) => {
    const wireIndex = adapted.segmentation.wires.findIndex((candidate) => candidate.tag === point.tag);
    const wire = adapted.segmentation.wires[wireIndex];
    if (!wire) throw new Error(`Current table references unknown wire tag ${point.tag}.`);
    const firstAbsoluteSegment = adapted.segmentation.wires.slice(0, wireIndex).reduce((total, candidate) => total + candidate.segments, 0) + 1;
    const localSegment = point.segment - firstAbsoluteSegment + 1;
    if (localSegment < 1 || localSegment > wire.segments) throw new Error(`Current segment ${point.segment} lies outside wire tag ${point.tag}.`);
    const fraction = (localSegment - 0.5) / wire.segments;
    const wireLength = wire.segmentLengthM * wire.segments;
    return {
      wireId: wire.id,
      family: wire.family,
      tag: point.tag,
      segment: point.segment,
      fractionAlongWire: fraction,
      distanceFromFeedM: fraction * wireLength,
      magnitudeA: point.current_magnitude,
      normalizedMagnitude: point.current_magnitude / maximum,
      phaseDeg: point.current_phase_deg,
      positionM: { x: point.x, y: point.y, z: point.z },
    };
  });
}

export function validateVerticalResult(model: VerticalAntennaModel, adapted: AdaptedVerticalNec, simulation: SimulationResult): VerticalSolverResult {
  if (simulation.frequency_data.length !== 1) throw new Error(`Expected one solved frequency, received ${simulation.frequency_data.length}.`);
  const data = simulation.frequency_data[0]!;
  if (![data.impedance.real, data.impedance.imag, data.gain_max_dbi, data.gain_max_theta].every(Number.isFinite) || data.gain_max_dbi <= -999) {
    throw new Error("The solver returned invalid impedance or gain values.");
  }
  const patterns = extractPatterns(data);
  return {
    resistanceOhm: data.impedance.real,
    reactanceOhm: data.impedance.imag,
    swr: computeSwr(data.impedance.real, data.impedance.imag, model.referenceImpedanceOhm),
    maximumGainDbi: data.gain_max_dbi,
    takeOffAngleDeg: Math.max(0, Math.min(90, 90 - data.gain_max_theta)),
    azimuthVariationDb: patterns.variationDb,
    azimuthPattern: patterns.azimuth,
    elevationPattern: patterns.elevation,
    radiationPattern: data.pattern!,
    currentDistribution: mapCurrents(data.currents, adapted),
    generatedNec: adapted.deck,
    engine: simulation.engine,
    computedInMs: simulation.computed_in_ms,
    warnings: [...adapted.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message), ...simulation.warnings],
  };
}
