import type { PatternData, SimulationResult } from "../../api/nec";
import type { SimulateAdvancedRequest } from "../../engine/types";
import { buildCardDeck } from "../../engine/parsers/nec-input";
import { WasmEngine } from "../../engine/wasm";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { deriveAnalyserPoints, validateSweepConfig } from "../frequency-analyser/math";
import type { AnalyserSweep, SweepConfig } from "../frequency-analyser/types";
import { generatePhasedArray } from "../phased-arrays/model";
import { runPhasedArrayModel } from "../phased-arrays/service";
import { createWorkflowPhasedModel, createWorkflowVerticalModel } from "../ground-radials/workflow";
import { adaptDipoleToNec } from "../verified-dipole/nec-adapter";
import { SPEED_OF_LIGHT_M_PER_S, type HorizontalDipoleModel } from "../verified-dipole/model";
import { runVerifiedDipole } from "../verified-dipole/service";
import { adaptVerticalToNec } from "../vertical-antennas/nec-adapter";
import { generateVerticalModel } from "../vertical-antennas/model";
import { runVerticalModel } from "../vertical-antennas/service";
import { adaptYagiToNec } from "../yagi-beams/nec-adapter";
import { generateYagiModel, startingYagiModel } from "../yagi-beams/model";
import { runYagiModel } from "../yagi-beams/service";
import { migrateProjectFile, type ProjectFile } from "../../utils/project-file";
import { getTemplate, templateMap } from "../../templates";
import { adaptIdealFinalToNec, adaptPhysicalNetworkToNec } from "../phased-arrays/nec-adapter";
import type { PhasedArrayModel } from "../phased-arrays/schema";
import type { VerticalAntennaModel } from "../vertical-antennas/schema";
import type { YagiAntennaModel } from "../yagi-beams/schema";
import { adaptLoopBeamToNec } from "../loop-beams/nec-adapter";
import { generateLoopBeamModel } from "../loop-beams/model";
import type { LoopBeamModel } from "../loop-beams/schema";
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

function comparisonGround(conditions: ComparisonConditions): SimulateAdvancedRequest["ground"] {
  return conditions.ground.kind === "perfect" ? { type: "perfect" } : { type: "custom", custom_conductivity: conditions.ground.conductivitySPerM, custom_permittivity: conditions.ground.relativePermittivity };
}

function parseForRequest(request: SimulateAdvancedRequest): NecDeckRunRequest {
  const step = request.pattern_step ?? 2;
  const free = request.ground.type === "free_space";
  return { deck: buildCardDeck(request), parse: { nTheta: Math.floor((free ? 360 : 180) / step) + 1, nPhi: Math.floor(360 / step), thetaStart: free ? -180 : -90, thetaStep: step, phiStart: 0, phiStep: step, computeCurrents: false, totalSegments: request.wires.reduce((sum, wire) => sum + wire.segments, 0) } };
}

export function createSavedProjectComparisonRequest(project: ProjectFile, conditions: ComparisonConditions): { run: NecDeckRunRequest; portCount: number; warnings: string[] } {
  const frequency = { start_mhz: conditions.frequencyMhz, stop_mhz: conditions.frequencyMhz, steps: 1 };
  if (project.mode === "simulator" && project.simulator) {
    if (!templateMap.has(project.simulator.templateId)) throw new Error(`Saved project template "${project.simulator.templateId}" is not installed.`);
    const template = getTemplate(project.simulator.templateId); const params = { ...project.simulator.params, frequency: conditions.frequencyMhz };
    const wires = template.generateGeometry(params); const raw = template.generateExcitation(params, wires); const excitations = Array.isArray(raw) ? raw : [raw];
    const request: SimulateAdvancedRequest = { wires, excitations, loads: template.generateLoads?.(params, wires) ?? [], transmission_lines: template.generateTransmissionLines?.(params, wires) ?? [], ground: comparisonGround(conditions), frequency, compute_currents: false, compute_pattern: true, pattern_step: 2, comment: `Saved project: ${project.simulator.templateId}` };
    return { run: parseForRequest(request), portCount: excitations.length, warnings: [] };
  }
  if (project.mode === "editor" && project.editor) {
    const report = project.editor.necImport?.document;
    if (report && (!report.structured_editable || report.cards.some((card) => card.disposition === "blocking" || card.disposition === "preserved_only"))) throw new Error("This imported NEC project contains cards that cannot be safely regenerated under common comparison conditions. It has not been modified or solved approximately.");
    const request: SimulateAdvancedRequest = { wires: project.editor.wires, excitations: project.editor.excitations, loads: project.editor.loads, transmission_lines: project.editor.transmissionLines, ground: comparisonGround(conditions), frequency, compute_currents: false, compute_pattern: true, pattern_step: 2, comment: "Saved Wire Editor project" };
    return { run: parseForRequest(request), portCount: request.excitations.length, warnings: [] };
  }
  if (project.mode === "module" && project.module) {
    const state = project.module.state as Record<string, unknown>; const ground = conditions.ground.kind === "perfect" ? { kind: "perfect" as const } : { kind: "sommerfeld-norton" as const, ...realGround(conditions)! };
    if (project.module.moduleId === "verified-dipole" || project.module.moduleId === "dipole-height-lab") {
      const lambda = SPEED_OF_LIGHT_M_PER_S / (conditions.frequencyMhz * 1e6); const lab = project.module.moduleId === "dipole-height-lab";
      const model: HorizontalDipoleModel = { schemaVersion: 1, kind: "center-fed-horizontal-dipole", frequencyHz: conditions.frequencyMhz * 1e6, totalLengthM: lab ? lambda * 0.477 : Number(state.length), wireDiameterM: lab ? 0.001 : Number(state.diameter), heightM: lab ? Number(state.heightWavelengths) * lambda : Number(state.height), ground: conditions.ground.kind === "perfect" ? { kind: "perfect" } : { kind: "real", ...realGround(conditions)! }, referenceImpedanceOhm: conditions.referenceImpedanceOhm, orientation: "x" };
      const adapted = adaptDipoleToNec(model); return { run: adapted.runRequest, portCount: 1, warnings: [] };
    }
    if (project.module.moduleId === "vertical-antennas") { const model = structuredClone(state.model) as VerticalAntennaModel; model.frequencyHz = conditions.frequencyMhz * 1e6; model.referenceImpedanceOhm = conditions.referenceImpedanceOhm; model.ground = ground; const adapted = adaptVerticalToNec(generateVerticalModel(model)); return { run: adapted.runRequest, portCount: 1, warnings: [] }; }
    if (project.module.moduleId === "yagi-beams") { const model = structuredClone(state.model) as YagiAntennaModel; model.frequencyHz = conditions.frequencyMhz * 1e6; model.referenceImpedanceOhm = conditions.referenceImpedanceOhm; model.ground = ground; const adapted = adaptYagiToNec(generateYagiModel(model)); return { run: adapted.runRequest, portCount: 1, warnings: [] }; }
    if (project.module.moduleId === "loop-beams") { const model = structuredClone(state.model) as LoopBeamModel; model.frequencyHz = conditions.frequencyMhz * 1e6; model.referenceImpedanceOhm = conditions.referenceImpedanceOhm; model.ground = ground; const adapted = adaptLoopBeamToNec(generateLoopBeamModel(model)); return { run: adapted.runRequest, portCount: 1, warnings: [] }; }
    if (project.module.moduleId === "phased-arrays") { const model = structuredClone(state.model) as PhasedArrayModel; model.frequencyHz = conditions.frequencyMhz * 1e6; model.ground = ground; const generated = generatePhasedArray(model); if (model.mode === "ideal-current-phase") { const adapted = adaptIdealFinalToNec(generated, [{ real: 1, imag: 0 }, { real: Math.cos(model.ideal.phase2Deg * Math.PI / 180) * model.ideal.amplitude2, imag: Math.sin(model.ideal.phase2Deg * Math.PI / 180) * model.ideal.amplitude2 }]); return { run: adapted.runRequest, portCount: 2, warnings: [] }; } const adapted = adaptPhysicalNetworkToNec(generated); return { run: adapted.runRequest, portCount: 1, warnings: [] }; }
    if (["antenna-templates", "frequency-analyser", "measurement-comparison"].includes(project.module.moduleId)) {
      const templateId = String(state.templateId ?? ""); if (!templateMap.has(templateId)) throw new Error(`Saved module template "${templateId}" is not installed.`); const template = getTemplate(templateId); const params = { ...((state.params ?? state.parametersSI) as Record<string, number>), frequency: conditions.frequencyMhz }; const wires = template.generateGeometry(params); const raw = template.generateExcitation(params, wires); const excitations = Array.isArray(raw) ? raw : [raw]; const request: SimulateAdvancedRequest = { wires, excitations, loads: template.generateLoads?.(params, wires) ?? [], transmission_lines: template.generateTransmissionLines?.(params, wires) ?? [], ground: comparisonGround(conditions), frequency, compute_currents: false, compute_pattern: true, pattern_step: 2, comment: `Saved module: ${project.module.moduleId}` }; return { run: parseForRequest(request), portCount: excitations.length, warnings: [] };
    }
    throw new Error(`Saved ${project.module.title} projects are not yet safely convertible to the controlled comparison solver.`);
  }
  throw new Error("Only saved Simulator, Wire Editor, and supported antenna-module projects can be compared.");
}

async function runSavedProject(definition: ComparisonSlotDefinition, conditions: ComparisonConditions, options: { signal?: AbortSignal; solver?: (request: NecDeckRunRequest, signal?: AbortSignal) => Promise<SimulationResult> }) {
  const migrated = migrateProjectFile(definition.savedProject!.project).project;
  const prepared = createSavedProjectComparisonRequest(migrated, conditions);
  const simulation = await (options.solver ?? ((request, signal) => sweepEngine.runDeck(request, 120_000, signal)))(prepared.run, options.signal);
  const data = simulation.frequency_data[0]; if (!data?.pattern) throw new Error("The saved project did not return a radiation pattern.");
  const cuts = extractComparisonCuts(data.pattern, conditions.azimuthElevationDeg, conditions.elevationBearingDeg); const direction = baseMetrics(cuts.azimuth);
  const z = data.impedance; const rho = Math.hypot(z.real - conditions.referenceImpedanceOhm, z.imag) / Math.hypot(z.real + conditions.referenceImpedanceOhm, z.imag); const singlePort = prepared.portCount === 1;
  return { prepared, simulation, data, cuts, metrics: { gainDbi: data.gain_max_dbi, takeOffAngleDeg: data.gain_max_theta, frontToBackDb: direction.frontToBackDb, beamwidthDeg: direction.beamwidthDeg, resistanceOhm: singlePort ? z.real : null, reactanceOhm: singlePort ? z.imag : null, swr: singlePort ? (rho >= 1 ? Infinity : (1 + rho) / (1 - rho)) : null } satisfies ComparisonMetrics };
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

  if (definition.source === "saved-project") {
    const project = migrateProjectFile(definition.savedProject!.project).project;
    if (project.mode === "module" && project.module?.moduleId === "phased-arrays") {
      const state = project.module.state as Record<string, unknown>; const model = structuredClone(state.model) as PhasedArrayModel; model.frequencyHz = frequencyHz; model.ground = conditions.ground.kind === "perfect" ? { kind: "perfect" } : { kind: "sommerfeld-norton", ...realGround(conditions)! };
      const generated = generatePhasedArray(model); const result = await runPhasedArrayModel(generated, { signal: options.signal }); const direction = baseMetrics(result.azimuthPattern);
      const z = result.networkInputImpedance; const rho = z ? Math.hypot(z.real - conditions.referenceImpedanceOhm, z.imag) / Math.hypot(z.real + conditions.referenceImpedanceOhm, z.imag) : null;
      metrics = { gainDbi: result.forwardGainDbi, takeOffAngleDeg: result.takeOffAngleDeg, frontToBackDb: result.frontToBackDb, beamwidthDeg: direction.beamwidthDeg, resistanceOhm: z?.real ?? null, reactanceOhm: z?.imag ?? null, swr: rho === null ? null : rho >= 1 ? Infinity : (1 + rho) / (1 - rho) };
      radiationPattern = result.radiationPattern; generatedNec = result.generatedNec; engine = result.engine; warnings = result.warnings;
      if (model.mode === "ideal-current-phase") sweepUnavailableReason = "Ideal current/phase mode uses calibrated multiple sources and has no single physical input impedance; R, X, SWR and the impedance sweep are intentionally not reported.";
      else totalSegments = adaptPhysicalNetworkToNec(generated).segmentation.totalSegments;
    } else {
      const saved = await runSavedProject(definition, conditions, { signal: options.signal });
      metrics = saved.metrics; radiationPattern = saved.data.pattern!; generatedNec = saved.prepared.run.deck; engine = saved.simulation.engine; warnings = [...saved.prepared.warnings, ...saved.simulation.warnings]; totalSegments = saved.prepared.run.parse.totalSegments;
      if (saved.prepared.portCount !== 1) sweepUnavailableReason = "This saved model has multiple enforced sources and no unambiguous single physical input port; R, X, SWR and the impedance sweep are intentionally not reported.";
    }
  } else if (definition.family === "dipole") {
    const lambda = SPEED_OF_LIGHT_M_PER_S / frequencyHz;
    const model: HorizontalDipoleModel = {
      schemaVersion: 1, kind: "center-fed-horizontal-dipole", frequencyHz, totalLengthM: lambda * 0.477,
      wireDiameterM: 0.001, heightM: definition.parameterValue,
      ground: conditions.ground.kind === "perfect" ? { kind: "perfect" } : { kind: "real", ...realGround(conditions)! },
      referenceImpedanceOhm: conditions.referenceImpedanceOhm, orientation: "x",
    };
    const run = await runVerifiedDipole(model, { signal: options.signal });
    const direction = baseMetrics(run.result.azimuthPattern);
    metrics = { gainDbi: run.result.maximumGainDbi, takeOffAngleDeg: run.result.takeOffAngleDeg, frontToBackDb: direction.frontToBackDb, beamwidthDeg: direction.beamwidthDeg, resistanceOhm: run.result.resistanceOhm, reactanceOhm: run.result.reactanceOhm, swr: run.result.swr };
    radiationPattern = run.result.radiationPattern; generatedNec = run.result.generatedNec; engine = run.result.engine; warnings = run.result.warnings; totalSegments = run.adapted.segmentation.segments;
  } else if (definition.family === "vertical") {
    const model = createWorkflowVerticalModel(frequencyHz, conditions.ground, conditions.radialSystems, definition.parameterValue, conditions.referenceImpedanceOhm);
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
    const model = createWorkflowPhasedModel(frequencyHz, conditions.ground, conditions.radialSystems);
    model.ideal.phase2Deg = definition.parameterValue;
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
    slotId: definition.id, label, color, family: definition.source === "saved-project" ? "saved-project" : definition.family, definitionKey: comparisonDefinitionKey(definition), conditionKey: comparisonConditionKey(conditions, sweepConfig),
    conditions: structuredClone(conditions), sweepConfig: { ...sweepConfig }, metrics, azimuthPattern: cuts.azimuth, elevationPattern: cuts.elevation,
    radiationPattern, sweep, sweepUnavailableReason, generatedNec, engine, warnings: [...new Set([...warnings, ...(sweep?.warnings ?? [])])],
  };
}

export function createDipoleSweepPlanForTest(definition: ComparisonSlotDefinition, conditions: ComparisonConditions) {
  const lambda = SPEED_OF_LIGHT_M_PER_S / (conditions.frequencyMhz * 1_000_000);
  const model: HorizontalDipoleModel = { schemaVersion: 1, kind: "center-fed-horizontal-dipole", frequencyHz: conditions.frequencyMhz * 1_000_000, totalLengthM: lambda * 0.477, wireDiameterM: 0.001, heightM: definition.parameterValue, ground: { kind: "perfect" }, referenceImpedanceOhm: conditions.referenceImpedanceOhm, orientation: "x" };
  return adaptDipoleToNec(model);
}
