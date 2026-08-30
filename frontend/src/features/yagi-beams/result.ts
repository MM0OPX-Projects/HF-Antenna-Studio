import type { FrequencyResult, PatternData, SegmentCurrent, SimulationResult } from "../../api/nec";
import { computeSwr } from "../../engine/parsers/nec-output";
import type { AdaptedYagiNec } from "./nec-adapter";
import { yagiModelKey } from "./model";
import type { YagiAntennaModel, YagiCurrentPoint, YagiPatternPoint, YagiSolverResult } from "./schema";
import { extractFullElevationCut } from "../../components/results/full-elevation-cut";

function angularDistance(a: number, b: number): number {
  const difference = Math.abs(((a - b + 540) % 360) - 180);
  return difference;
}

function normalize(points: Array<{ angleDeg: number; gainDbi: number }>): YagiPatternPoint[] {
  const finite = points.filter((point) => Number.isFinite(point.gainDbi) && point.gainDbi > -999);
  if (finite.length === 0) return [];
  const maximum = Math.max(...finite.map((point) => point.gainDbi));
  return finite.map((point) => ({ ...point, normalizedDb: Math.max(-40, point.gainDbi - maximum) }));
}

function circularBeamwidth(points: YagiPatternPoint[], peakIndex: number): number | null {
  if (points.length < 8) return null;
  const threshold = points[peakIndex]!.gainDbi - 3;
  const step = 360 / points.length;
  const crossing = (direction: -1 | 1): number | null => {
    let previous = points[peakIndex]!.gainDbi;
    for (let distance = 1; distance <= Math.floor(points.length / 2); distance += 1) {
      const index = (peakIndex + direction * distance + points.length) % points.length;
      const gain = points[index]!.gainDbi;
      if (gain < threshold && previous >= threshold) {
        const fraction = Math.abs(previous - threshold) / Math.max(Math.abs(previous - gain), 1e-12);
        return (distance - 1 + fraction) * step;
      }
      previous = gain;
    }
    return null;
  };
  const left = crossing(-1);
  const right = crossing(1);
  return left === null || right === null ? null : Math.round((left + right) * 10) / 10;
}

export interface YagiDirectionalMetrics {
  forwardGainDbi: number;
  rearGainDbi: number;
  maximumRearGainDbi: number;
  frontToBackDb: number;
  frontToRearDb: number;
  beamwidthDeg: number | null;
  takeOffAngleDeg: number;
  forwardBearingDeg: number;
  azimuthPattern: YagiPatternPoint[];
  elevationPattern: YagiPatternPoint[];
}

export function calculateYagiDirectionalMetrics(pattern: PatternData): YagiDirectionalMetrics {
  let bestTheta = -1;
  let bestPhi = -1;
  let forwardGain = -Infinity;
  for (let ti = 0; ti < pattern.theta_count; ti += 1) {
    for (let pi = 0; pi < pattern.phi_count; pi += 1) {
      const phi = pattern.phi_start + pi * pattern.phi_step;
      const gain = pattern.gain_dbi[ti]?.[pi] ?? -999.99;
      if (angularDistance(phi, 90) <= 90 && gain > forwardGain) {
        forwardGain = gain;
        bestTheta = ti;
        bestPhi = pi;
      }
    }
  }
  if (bestTheta < 0 || !Number.isFinite(forwardGain) || forwardGain <= -999) throw new Error("The radiation grid contains no valid forward-hemisphere samples.");
  const forwardBearing = pattern.phi_start + bestPhi * pattern.phi_step;
  const rearBearing = (forwardBearing + 180) % 360;
  const rearIndex = Math.round((rearBearing - pattern.phi_start) / pattern.phi_step + pattern.phi_count) % pattern.phi_count;
  const rearGain = pattern.gain_dbi[bestTheta]?.[rearIndex] ?? -999.99;
  let maximumRearGain = -Infinity;
  for (let ti = 0; ti < pattern.theta_count; ti += 1) {
    for (let pi = 0; pi < pattern.phi_count; pi += 1) {
      const phi = pattern.phi_start + pi * pattern.phi_step;
      if (angularDistance(phi, 90) > 90) maximumRearGain = Math.max(maximumRearGain, pattern.gain_dbi[ti]?.[pi] ?? -999.99);
    }
  }
  if (rearGain <= -999 || maximumRearGain <= -999) throw new Error("The radiation grid does not contain usable rear-hemisphere samples.");
  const azimuthPattern = normalize(Array.from({ length: pattern.phi_count }, (_, pi) => ({
    angleDeg: pattern.phi_start + pi * pattern.phi_step,
    gainDbi: pattern.gain_dbi[bestTheta]?.[pi] ?? -999.99,
  })));
  const elevationPattern = normalize(extractFullElevationCut(pattern, forwardBearing));
  const azimuthPeakIndex = azimuthPattern.findIndex((point) => Math.abs(point.angleDeg - forwardBearing) < pattern.phi_step * 0.6);
  return {
    forwardGainDbi: forwardGain,
    rearGainDbi: rearGain,
    maximumRearGainDbi: maximumRearGain,
    frontToBackDb: forwardGain - rearGain,
    frontToRearDb: forwardGain - maximumRearGain,
    beamwidthDeg: azimuthPeakIndex < 0 ? null : circularBeamwidth(azimuthPattern, azimuthPeakIndex),
    takeOffAngleDeg: Math.max(0, Math.min(90, 90 - (pattern.theta_start + bestTheta * pattern.theta_step))),
    forwardBearingDeg: forwardBearing,
    azimuthPattern,
    elevationPattern,
  };
}

function mapCurrents(currents: SegmentCurrent[] | null, adapted: AdaptedYagiNec): YagiCurrentPoint[] {
  if (!currents?.length) throw new Error("The solver result does not contain element-current data.");
  const maximum = Math.max(...currents.map((point) => point.current_magnitude));
  if (!Number.isFinite(maximum) || maximum <= 0) throw new Error("The current table contains no positive finite magnitude.");
  return currents.map((point) => {
    const wireIndex = adapted.segmentation.wires.findIndex((wire) => wire.tag === point.tag);
    const wire = adapted.segmentation.wires[wireIndex];
    if (!wire) throw new Error(`Current table references unknown wire tag ${point.tag}.`);
    const firstAbsoluteSegment = adapted.segmentation.wires.slice(0, wireIndex).reduce((sum, candidate) => sum + candidate.segments, 0) + 1;
    const localSegment = point.segment - firstAbsoluteSegment + 1;
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

export function validateYagiResult(model: YagiAntennaModel, adapted: AdaptedYagiNec, simulation: SimulationResult): YagiSolverResult {
  if (simulation.frequency_data.length !== 1) throw new Error(`Expected one solved frequency, received ${simulation.frequency_data.length}.`);
  const data: FrequencyResult = simulation.frequency_data[0]!;
  if (![data.impedance.real, data.impedance.imag].every(Number.isFinite)) throw new Error("The solver returned invalid feed impedance.");
  if (!data.pattern) throw new Error("The solver result does not contain a radiation pattern.");
  const metrics = calculateYagiDirectionalMetrics(data.pattern);
  const directionWarnings = metrics.frontToRearDb < 0
    ? ["The strongest rear-hemisphere radiation exceeds the intended +Y forward peak; verify element order, dimensions, and current phases."]
    : [];
  return {
    modelKey: yagiModelKey(model),
    resistanceOhm: data.impedance.real,
    reactanceOhm: data.impedance.imag,
    swr: computeSwr(data.impedance.real, data.impedance.imag, model.referenceImpedanceOhm),
    ...metrics,
    radiationPattern: data.pattern,
    currentDistribution: mapCurrents(data.currents, adapted),
    generatedNec: adapted.deck,
    engine: simulation.engine,
    computedInMs: simulation.computed_in_ms,
    warnings: [...adapted.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message), ...directionWarnings, ...simulation.warnings],
  };
}
