import type { FrequencyResult, PatternData, SegmentCurrent, SimulationResult } from "../../api/nec";
import { computeSwr } from "../../engine/parsers/nec-output";
import type { HorizontalDipoleModel } from "./model";
import type { AdaptedDipoleNec } from "./nec-adapter";

export interface NormalizedPatternPoint {
  angleDeg: number;
  gainDbi: number;
  normalizedDb: number;
}
export interface VerifiedCurrentPoint {
  segment: number;
  positionM: number;
  magnitudeA: number;
  normalizedMagnitude: number;
  phaseDeg: number;
}

export interface VerifiedDipoleResult {
  frequencyHz: number;
  resistanceOhm: number;
  reactanceOhm: number;
  complexImpedance: { realOhm: number; imaginaryOhm: number };
  referenceImpedanceOhm: 50 | 75;
  swr: number;
  maximumGainDbi: number;
  takeOffAngleDeg: number | null;
  azimuthPattern: NormalizedPatternPoint[];
  elevationPattern: NormalizedPatternPoint[];
  currentDistribution: VerifiedCurrentPoint[];
  radiationPattern: PatternData;
  generatedNec: string;
  engine: string;
  computedInMs: number;
  warnings: string[];
}

function normalize(points: Array<{ angleDeg: number; gainDbi: number }>): NormalizedPatternPoint[] {
  const finite = points.filter((point) => Number.isFinite(point.gainDbi) && point.gainDbi > -999);
  if (finite.length === 0) return [];
  const maximum = Math.max(...finite.map((point) => point.gainDbi));
  return finite.map((point) => ({
    ...point,
    normalizedDb: Math.max(-40, point.gainDbi - maximum),
  }));
}

function extractPatterns(data: FrequencyResult): {
  azimuth: NormalizedPatternPoint[];
  elevation: NormalizedPatternPoint[];
} {
  const pattern = data.pattern;
  if (!pattern) throw new Error("The solver result does not contain a radiation pattern.");

  let bestThetaIndex = 0;
  let bestPhiIndex = 0;
  let bestGain = -Infinity;
  for (let ti = 0; ti < pattern.theta_count; ti += 1) {
    for (let pi = 0; pi < pattern.phi_count; pi += 1) {
      const gain = pattern.gain_dbi[ti]?.[pi] ?? -999.99;
      if (gain > bestGain) {
        bestGain = gain;
        bestThetaIndex = ti;
        bestPhiIndex = pi;
      }
    }
  }
  if (!Number.isFinite(bestGain) || bestGain <= -999) {
    throw new Error("The radiation-pattern grid contains no valid gain values.");
  }

  const azimuth = normalize(
    Array.from({ length: pattern.phi_count }, (_, pi) => ({
      angleDeg: pattern.phi_start + pi * pattern.phi_step,
      gainDbi: pattern.gain_dbi[bestThetaIndex]?.[pi] ?? -999.99,
    })),
  );
  const elevation = normalize(
    Array.from({ length: pattern.theta_count }, (_, ti) => ({
      // NEC theta is measured down from zenith. Display elevation is measured
      // up from the horizon, hence 90-theta (and -90..+90 in free space).
      angleDeg: 90 - (pattern.theta_start + ti * pattern.theta_step),
      gainDbi: pattern.gain_dbi[ti]?.[bestPhiIndex] ?? -999.99,
    })).sort((a, b) => a.angleDeg - b.angleDeg),
  );
  return { azimuth, elevation };
}

function mapCurrents(currents: SegmentCurrent[] | null, totalLengthM: number): VerifiedCurrentPoint[] {
  if (!currents || currents.length === 0) {
    throw new Error("The solver result does not contain element-current data.");
  }
  const ordered = [...currents].sort((a, b) => a.segment - b.segment);
  const maximum = Math.max(...ordered.map((point) => point.current_magnitude));
  if (!Number.isFinite(maximum) || maximum <= 0) {
    throw new Error("The element-current data contains no positive current magnitude.");
  }
  return ordered.map((point, index) => ({
    segment: point.segment,
    positionM: Number.isFinite(point.x)
      ? point.x
      : -totalLengthM / 2 + ((index + 0.5) / ordered.length) * totalLengthM,
    magnitudeA: point.current_magnitude,
    normalizedMagnitude: point.current_magnitude / maximum,
    phaseDeg: point.current_phase_deg,
  }));
}

export function validateDipoleResult(
  model: HorizontalDipoleModel,
  adapted: AdaptedDipoleNec,
  simulation: SimulationResult,
): VerifiedDipoleResult {
  if (simulation.frequency_data.length !== 1) {
    throw new Error(`Expected one solved frequency, received ${simulation.frequency_data.length}.`);
  }
  const data = simulation.frequency_data[0]!;
  const values = [
    data.impedance.real,
    data.impedance.imag,
    data.gain_max_dbi,
    data.gain_max_theta,
  ];
  if (!values.every(Number.isFinite) || data.gain_max_dbi <= -999) {
    throw new Error("The solver returned invalid impedance or gain values.");
  }
  const patterns = extractPatterns(data);
  const currents = mapCurrents(data.currents, model.totalLengthM);
  const takeOffAngleDeg = model.ground.kind === "free-space"
    ? null
    : Math.max(0, Math.min(90, 90 - data.gain_max_theta));

  return {
    frequencyHz: model.frequencyHz,
    resistanceOhm: data.impedance.real,
    reactanceOhm: data.impedance.imag,
    complexImpedance: {
      realOhm: data.impedance.real,
      imaginaryOhm: data.impedance.imag,
    },
    referenceImpedanceOhm: model.referenceImpedanceOhm,
    swr: computeSwr(data.impedance.real, data.impedance.imag, model.referenceImpedanceOhm),
    maximumGainDbi: data.gain_max_dbi,
    takeOffAngleDeg,
    azimuthPattern: patterns.azimuth,
    elevationPattern: patterns.elevation,
    currentDistribution: currents,
    radiationPattern: data.pattern!,
    generatedNec: adapted.deck,
    engine: simulation.engine,
    computedInMs: simulation.computed_in_ms,
    warnings: [...adapted.warnings, ...simulation.warnings],
  };
}
