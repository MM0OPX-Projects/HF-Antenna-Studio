import type { FrequencyResult, PatternData, SegmentCurrent, SimulationResult } from "../../api/nec";
import { computeSwr } from "../../engine/parsers/nec-output";
import { calculateYagiDirectionalMetrics } from "../yagi-beams/result";
import type { AdaptedLoopBeamNec } from "./nec-adapter";
import { loopBeamModelKey } from "./model";
import type { LoopBeamCurrentPoint, LoopBeamModel, LoopBeamPatternPoint, LoopBeamSolverResult } from "./schema";

function normalize(points: Array<{ angleDeg: number; gainDbi: number }>): LoopBeamPatternPoint[] {
  const finite = points.filter((point) => Number.isFinite(point.gainDbi) && point.gainDbi > -999);
  if (!finite.length) return [];
  const maximum = Math.max(...finite.map((point) => point.gainDbi));
  return finite.map((point) => ({ ...point, normalizedDb: Math.max(-40, point.gainDbi - maximum) }));
}

function globalMetrics(pattern: PatternData) {
  let bestTheta = -1; let bestPhi = -1; let maximumGainDbi = -Infinity;
  for (let ti = 0; ti < pattern.theta_count; ti += 1) for (let pi = 0; pi < pattern.phi_count; pi += 1) {
    const gain = pattern.gain_dbi[ti]?.[pi] ?? -999.99;
    if (gain > maximumGainDbi) { maximumGainDbi = gain; bestTheta = ti; bestPhi = pi; }
  }
  if (bestTheta < 0 || maximumGainDbi <= -999) throw new Error("The radiation grid contains no valid samples.");
  return {
    maximumGainDbi,
    takeOffAngleDeg: Math.max(0, Math.min(90, 90 - (pattern.theta_start + bestTheta * pattern.theta_step))),
    azimuthPattern: normalize(Array.from({ length: pattern.phi_count }, (_, pi) => ({ angleDeg: pattern.phi_start + pi * pattern.phi_step, gainDbi: pattern.gain_dbi[bestTheta]?.[pi] ?? -999.99 }))),
    elevationPattern: normalize(Array.from({ length: pattern.theta_count }, (_, ti) => ({ angleDeg: 90 - (pattern.theta_start + ti * pattern.theta_step), gainDbi: pattern.gain_dbi[ti]?.[bestPhi] ?? -999.99 })).sort((a, b) => a.angleDeg - b.angleDeg)),
  };
}

function mapCurrents(currents: SegmentCurrent[] | null, adapted: AdaptedLoopBeamNec): LoopBeamCurrentPoint[] {
  if (!currents?.length) throw new Error("The solver result does not contain element-current data.");
  const maximum = Math.max(...currents.map((point) => point.current_magnitude));
  if (!Number.isFinite(maximum) || maximum <= 0) throw new Error("The current table contains no positive finite magnitude.");
  return currents.map((point) => {
    const wireIndex = adapted.segmentation.wires.findIndex((wire) => wire.tag === point.tag);
    const wire = adapted.segmentation.wires[wireIndex];
    if (!wire) throw new Error(`Current table references unknown wire tag ${point.tag}.`);
    const firstAbsolute = adapted.segmentation.wires.slice(0, wireIndex).reduce((sum, candidate) => sum + candidate.segments, 0) + 1;
    const local = point.segment - firstAbsolute + 1;
    if (local < 1 || local > wire.segments) throw new Error(`Current segment ${point.segment} lies outside wire tag ${point.tag}.`);
    return { wireId: wire.id, family: wire.family, tag: point.tag, segment: point.segment, fractionAlongWire: (local - 0.5) / wire.segments, magnitudeA: point.current_magnitude, normalizedMagnitude: point.current_magnitude / maximum, phaseDeg: point.current_phase_deg, positionM: { x: point.x, y: point.y, z: point.z } };
  });
}

export function validateLoopBeamResult(model: LoopBeamModel, adapted: AdaptedLoopBeamNec, simulation: SimulationResult): LoopBeamSolverResult {
  if (simulation.frequency_data.length !== 1) throw new Error(`Expected one solved frequency, received ${simulation.frequency_data.length}.`);
  const data: FrequencyResult = simulation.frequency_data[0]!;
  if (![data.impedance.real, data.impedance.imag].every(Number.isFinite)) throw new Error("The solver returned invalid feed impedance.");
  if (!data.pattern) throw new Error("The solver result does not contain a radiation pattern.");
  const global = globalMetrics(data.pattern);
  const directional = model.kind === "cubical-quad" || model.kind === "hexbeam" ? calculateYagiDirectionalMetrics(data.pattern) : null;
  return {
    modelKey: loopBeamModelKey(model), resistanceOhm: data.impedance.real, reactanceOhm: data.impedance.imag,
    swr: computeSwr(data.impedance.real, data.impedance.imag, model.referenceImpedanceOhm), maximumGainDbi: global.maximumGainDbi,
    takeOffAngleDeg: directional?.takeOffAngleDeg ?? global.takeOffAngleDeg, forwardGainDbi: directional?.forwardGainDbi ?? null,
    rearGainDbi: directional?.rearGainDbi ?? null, frontToBackDb: directional?.frontToBackDb ?? null,
    frontToRearDb: directional?.frontToRearDb ?? null, beamwidthDeg: directional?.beamwidthDeg ?? null,
    azimuthPattern: directional?.azimuthPattern ?? global.azimuthPattern, elevationPattern: directional?.elevationPattern ?? global.elevationPattern,
    radiationPattern: data.pattern, currentDistribution: mapCurrents(data.currents, adapted), generatedNec: adapted.deck,
    engine: simulation.engine, computedInMs: simulation.computed_in_ms,
    warnings: [...adapted.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message), ...simulation.warnings],
  };
}
