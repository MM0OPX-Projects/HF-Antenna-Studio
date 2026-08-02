import type { PatternData, SimulationResult } from "../../api/nec";
import { computeSwr } from "../../engine/parsers/nec-output";
import { WasmEngine } from "../../engine/wasm";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import type { AntennaTemplateDefinition, TemplateAntennaModel } from "./schema";
import { adaptTemplateToNec } from "./nec-adapter";

export interface TemplateSolverResult {
  resistanceOhm: number;
  reactanceOhm: number;
  swr50: number;
  maximumGainDbi: number;
  takeOffAngleDeg: number;
  pattern: PatternData;
  generatedNec: string;
  engine: string;
  computedInMs: number;
  warnings: string[];
}

export type TemplateDeckSolver = (request: NecDeckRunRequest, signal?: AbortSignal) => Promise<SimulationResult>;
const engine = new WasmEngine();
const defaultSolver: TemplateDeckSolver = (request, signal) => engine.runDeck(request, 120_000, signal);

export async function runTemplateModel(
  model: TemplateAntennaModel,
  definition: AntennaTemplateDefinition,
  options: { solver?: TemplateDeckSolver; signal?: AbortSignal } = {},
): Promise<TemplateSolverResult> {
  const adapted = adaptTemplateToNec(model, definition);
  const simulation = await (options.solver ?? defaultSolver)(adapted.runRequest, options.signal);
  if (simulation.frequency_data.length !== 1) throw new Error(`Expected one solved frequency, received ${simulation.frequency_data.length}.`);
  const data = simulation.frequency_data[0]!;
  if (!data.pattern) throw new Error("The solver result does not contain a radiation pattern.");
  if (![data.impedance.real, data.impedance.imag, data.gain_max_dbi, data.gain_max_theta].every(Number.isFinite) || data.gain_max_dbi <= -999) throw new Error("The solver returned invalid impedance or gain values.");
  return {
    resistanceOhm: data.impedance.real,
    reactanceOhm: data.impedance.imag,
    swr50: computeSwr(data.impedance.real, data.impedance.imag, 50),
    maximumGainDbi: data.gain_max_dbi,
    takeOffAngleDeg: Math.max(0, Math.min(90, 90 - data.gain_max_theta)),
    pattern: data.pattern,
    generatedNec: adapted.deck,
    engine: simulation.engine,
    computedInMs: simulation.computed_in_ms,
    warnings: [...adapted.issues.map((issue) => issue.message), ...simulation.warnings],
  };
}
