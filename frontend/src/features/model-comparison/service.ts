import type { PatternData, SimulationResult } from "../../api/nec";
import { WasmEngine } from "../../engine/wasm";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { deriveAnalyserPoints, validateSweepConfig } from "../frequency-analyser/math";
import type { AnalyserSweep, SweepConfig } from "../frequency-analyser/types";
import { generatePhasedArray, phasedWavelengthM, startingPhasedArrayModel } from "../phased-arrays/model";
import { runPhasedArrayModel } from "../phased-arrays/service";
import { adaptDipoleToNec } from "../verified-dipole/nec-adapter";
import { SPEED_OF_LIGHT_M_PER_S, type HorizontalDipoleModel } from "../verified-dipole/model";
import { runVerifiedDipole } from "../verified-dipole/service";
import { adaptVerticalToNec } from "../vertical-antennas/nec-adapter";
import { generateVerticalModel, startingVerticalModel } from "../vertical-antennas/model";
import { runVerticalModel } from "../vertical-antennas/service";
import { adaptYagiToNec } from "../yagi-beams/nec-adapter";
import { generateYagiModel, startingYagiModel } from "../yagi-beams/model";
import { runYagiModel } from "../yagi-beams/service";
import { COMPARISON_COLORS, comparisonConditionKey, comparisonDefinitionKey, comparisonLabel, validateComparisonDefinition } from "./model";
import { circularPatternMetrics, extractComparisonCuts } from "./patterns";
import type { ComparisonConditions, ComparisonMetrics, ComparisonResult, ComparisonSlotDefinition } from "./types";

const sweepEngine = new WasmEngine();

function format(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Sweep deck values must be finite.");
  return Number(value.toPrecision(10)).toString();
}

export function buildComparisonSweepRequest(deck: string, totalSegments: number, config: SweepConfig): NecDeckRunRequest {
  const errors = validateSweepConfig(config);
  if (errors.length) throw new Error(errors.join(" "));
  if (!Number.isInteger(totalSegments) || totalSegments < 1) throw new Error("A positive segment count is required for a comparison sweep.");
  const sourceLines = deck.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  if (!sourceLines.some((line) => /^FR\s/i.test(line)) || !sourceLines.some((line) => /^EN\s*$/i.test(line))) throw new Error("The pattern deck does not contain the expected FR and EN cards.");
  const lines = sourceLines.filter((line) => !/^(FR|RP|XQ|EN)(\s|$)/i.test(line));
  const step = (config.stopMhz - config.startMhz) / (config.points - 1);
  lines.push(`FR 0 ${config.points} 0 0 ${format(config.startMhz)} ${format(step)}`, "XQ 0", "EN");
  return { deck: `${lines.join("\n")}\n`, parse: { nTheta: 1, nPhi: 1, thetaStart: 0, thetaStep: 1, phiStart: 0, phiStep: 1, computeCurrents: false, totalSegments } };
}

export function maximumSegmentWavelengthsAtFrequency(deck: string, frequencyMhz: number): number {
  if (!Number.isFinite(frequencyMhz) || frequencyMhz <= 0) throw new Error("Frequency must be positive and finite.");
  const segmentRatios = deck.split("\n").filter((line) => /^GW\s/i.test(line)).flatMap((line) => {
    const fields = line.trim().split(/\s+/).map(Number);
    if (fields.length < 10 || !fields.slice(1).every(Number.isFinite) || fields[2]! < 1) return [];
    const lengthM = Math.hypot(fields[6]! - fields[3]!, fields[7]! - fields[4]!, fields[8]! - fields[5]!);
    return [(lengthM / fields[2]!) / (SPEED_OF_LIGHT_M_PER_S / (frequencyMhz * 1_000_000))];
  });
  return Math.max(0, ...segmentRatios);
}

async function runSweep(deck: string, totalSegments: number, config: SweepConfig, label: string, color: string, signal?: AbortSignal, solver?: (request: NecDeckRunRequest, signal?: AbortSignal) => Promise<SimulationResult>): Promise<AnalyserSweep> {
  const request = buildComparisonSweepRequest(deck, totalSegments, config);
  const simulation = await (solver ?? ((candidate, abortSignal) => sweepEngine.runDeck(candidate, 120_000, abortSignal)))(request, signal);
  if (simulation.frequency_data.length !== config.points) throw new Error(`Expected ${config.points} sweep points, received ${simulation.frequency_data.length}.`);
  if (simulation.frequency_data.some((point) => !Number.isFinite(point.impedance.real) || !Number.isFinite(point.impedance.imag))) throw new Error("The comparison sweep contains non-finite impedance values.");
  const maximumSegmentWavelengths = maximumSegmentWavelengthsAtFrequency(request.deck, config.stopMhz);
  const segmentationWarnings = maximumSegmentWavelengths > 0.1 ? [`At the sweep stop frequency, the longest segment is ${maximumSegmentWavelengths.toFixed(3)}λ; results require re-segmentation and a convergence check.`] : [];
  return {
    id: `comparison-${label.replace(/\W+/g, "-").toLowerCase()}`,
    label,
    color,
    config: { ...config },
    points: deriveAnalyserPoints(simulation.frequency_data, config.referenceOhms),
    rawFrequencyData: simulation.frequency_data,
    computedInMs: simulation.computed_in_ms,
    engine: simulation.engine,
    warnings: [...segmentationWarnings, ...simulation.warnings],
    createdAt: new Date().toISOString(),
  };
}

function realGround(conditions: ComparisonConditions): { conductivitySPerM: number; relativePermittivity: number } | null {
  return conditions.ground.kind === "sommerfeld-norton" ? { conductivitySPerM: conditions.ground.conductivitySPerM, relativePermittivity: conditions.ground.relativePermittivity } : null;
}

function baseMetrics(pattern: Array<{ angleDeg: number; gainDbi: number; normalizedDb: number }>): ReturnType<typeof circularPatternMetrics> {
  return circularPatternMetrics(pattern);
}

export async function runComparisonSlot(
  definition: ComparisonSlotDefinition,
  conditions: ComparisonConditions,
  sweepConfig: SweepConfig,
  options: { signal?: AbortSignal; colorIndex?: number; sweepSolver?: (request: NecDeckRunRequest, signal?: AbortSignal) => Promise<SimulationResult> } = {},
): Promise<ComparisonResult> {
  const definitionErrors = validateComparisonDefinition(definition);
  if (definitionErrors.length) throw new Error(definitionErrors.join(" "));
  const frequencyHz = conditions.frequencyMhz * 1_000_000;
  if (!Number.isFinite(frequencyHz) || frequencyHz < 1_800_000 || frequencyHz > 54_000_000) throw new Error("Comparison frequency must be from 1.8 to 54 MHz.");
  const color = COMPARISON_COLORS[(options.colorIndex ?? 0) % COMPARISON_COLORS.length]!;
  const label = comparisonLabel(definition);
  let metrics: ComparisonMetrics;
  let radiationPattern: PatternData;
  let generatedNec: string;
  let engine: string;
  let warnings: string[];
  let totalSegments = 0;
  let sweepUnavailableReason: string | null = null;

  if (definition.family === "dipole") {
    const lambda = SPEED_OF_LIGHT_M_PER_S / frequencyHz;
    const model: HorizontalDipoleModel = {
      schemaVersion: 1, kind: "center-fed-horizontal-dipole", frequencyHz, totalLengthM: lambda * 0.477,
      wireDiameterM: 0.002, heightM: definition.parameterValue,
      ground: conditions.ground.kind === "perfect" ? { kind: "perfect" } : { kind: "real", ...realGround(conditions)! },
      referenceImpedanceOhm: conditions.referenceImpedanceOhm, orientation: "x", conductor: { kind: "perfect" },
    };
    const run = await runVerifiedDipole(model, { signal: options.signal });
    const direction = baseMetrics(run.result.azimuthPattern);
    metrics = { gainDbi: run.result.maximumGainDbi, takeOffAngleDeg: run.result.takeOffAngleDeg, frontToBackDb: direction.frontToBackDb, beamwidthDeg: direction.beamwidthDeg, resistanceOhm: run.result.resistanceOhm, reactanceOhm: run.result.reactanceOhm, swr: run.result.swr };
    radiationPattern = run.result.radiationPattern; generatedNec = run.result.generatedNec; engine = run.result.engine; warnings = run.result.warnings; totalSegments = run.adapted.segmentation.segments;
  } else if (definition.family === "vertical") {
    const model = startingVerticalModel(frequencyHz, "elevated-explicit-radials");
    model.radials.count = Math.round(definition.parameterValue);
    model.referenceImpedanceOhm = conditions.referenceImpedanceOhm;
    model.ground = conditions.ground.kind === "perfect" ? { kind: "perfect" } : { kind: "sommerfeld-norton", ...realGround(conditions)! };
    const generated = generateVerticalModel(model); const adapted = adaptVerticalToNec(generated); const result = await runVerticalModel(generated, { signal: options.signal });
    const direction = baseMetrics(result.azimuthPattern);
    metrics = { gainDbi: result.maximumGainDbi, takeOffAngleDeg: result.takeOffAngleDeg, frontToBackDb: direction.frontToBackDb, beamwidthDeg: direction.beamwidthDeg, resistanceOhm: result.resistanceOhm, reactanceOhm: result.reactanceOhm, swr: result.swr };
    radiationPattern = result.radiationPattern; generatedNec = result.generatedNec; engine = result.engine; warnings = result.warnings; totalSegments = adapted.segmentation.totalSegments;
  } else if (definition.family === "yagi") {
    const model = startingYagiModel(frequencyHz, 1);
    model.boomHeightM = definition.parameterValue;
    model.referenceImpedanceOhm = conditions.referenceImpedanceOhm;
    model.ground = conditions.ground.kind === "perfect" ? { kind: "perfect" } : { kind: "sommerfeld-norton", ...realGround(conditions)! };
    const generated = generateYagiModel(model); const adapted = adaptYagiToNec(generated); const result = await runYagiModel(generated, { signal: options.signal });
    metrics = { gainDbi: result.forwardGainDbi, takeOffAngleDeg: result.takeOffAngleDeg, frontToBackDb: result.frontToBackDb, beamwidthDeg: result.beamwidthDeg, resistanceOhm: result.resistanceOhm, reactanceOhm: result.reactanceOhm, swr: result.swr };
    radiationPattern = result.radiationPattern; generatedNec = result.generatedNec; engine = result.engine; warnings = result.warnings; totalSegments = adapted.segmentation.totalSegments;
  } else {
    const model = startingPhasedArrayModel(frequencyHz);
    model.ideal.phase2Deg = definition.parameterValue;
    model.ground = conditions.ground.kind === "perfect" ? { kind: "perfect" } : { kind: "sommerfeld-norton", ...realGround(conditions)! };
    if (conditions.ground.kind === "sommerfeld-norton") {
      const lambda = phasedWavelengthM(frequencyHz);
      model.elementBaseHeightM = lambda * 0.12;
      model.radials = { ...model.radials, representation: "elevated-explicit-wires", topology: "independent-per-element", count: 4, lengthM: lambda * 0.25, droopAngleRad: 20 * Math.PI / 180 };
    }
    const result = await runPhasedArrayModel(generatePhasedArray(model), { signal: options.signal });
    const direction = baseMetrics(result.azimuthPattern);
    metrics = { gainDbi: result.forwardGainDbi, takeOffAngleDeg: result.takeOffAngleDeg, frontToBackDb: result.frontToBackDb, beamwidthDeg: direction.beamwidthDeg, resistanceOhm: null, reactanceOhm: null, swr: null };
    radiationPattern = result.radiationPattern; generatedNec = result.generatedNec; engine = result.engine; warnings = result.warnings;
    sweepUnavailableReason = "Ideal current/phase mode has two enforced ports and no single physical input impedance; R, X, SWR and an impedance sweep are intentionally not reported.";
  }

  const cuts = extractComparisonCuts(radiationPattern, conditions.azimuthElevationDeg, conditions.elevationBearingDeg);
  if (Math.abs(cuts.actualAzimuthElevationDeg - conditions.azimuthElevationDeg) > 0.001) warnings = [...warnings, `Azimuth comparison uses the nearest solved elevation (${cuts.actualAzimuthElevationDeg.toFixed(1)}°).`];
  if (Math.abs(cuts.actualElevationBearingDeg - conditions.elevationBearingDeg) > 0.001) warnings = [...warnings, `Elevation comparison uses the nearest solved compass bearing (${cuts.actualElevationBearingDeg.toFixed(1)}°).`];
  const sweep = sweepUnavailableReason ? null : await runSweep(generatedNec, totalSegments, sweepConfig, label, color, options.signal, options.sweepSolver);
  return {
    slotId: definition.id, label, color, family: definition.family, definitionKey: comparisonDefinitionKey(definition), conditionKey: comparisonConditionKey(conditions, sweepConfig),
    conditions: structuredClone(conditions), sweepConfig: { ...sweepConfig }, metrics, azimuthPattern: cuts.azimuth, elevationPattern: cuts.elevation,
    radiationPattern, sweep, sweepUnavailableReason, generatedNec, engine, warnings: [...new Set([...warnings, ...(sweep?.warnings ?? [])])],
  };
}

export function createDipoleSweepPlanForTest(definition: ComparisonSlotDefinition, conditions: ComparisonConditions) {
  const lambda = SPEED_OF_LIGHT_M_PER_S / (conditions.frequencyMhz * 1_000_000);
  const model: HorizontalDipoleModel = { schemaVersion: 1, kind: "center-fed-horizontal-dipole", frequencyHz: conditions.frequencyMhz * 1_000_000, totalLengthM: lambda * 0.477, wireDiameterM: 0.002, heightM: definition.parameterValue, ground: { kind: "perfect" }, referenceImpedanceOhm: conditions.referenceImpedanceOhm, orientation: "x", conductor: { kind: "perfect" } };
  return adaptDipoleToNec(model);
}
