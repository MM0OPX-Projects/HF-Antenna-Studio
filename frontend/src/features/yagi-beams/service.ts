import type { SimulationResult } from "../../api/nec";
import { WasmEngine } from "../../engine/wasm";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { adaptYagiToNec } from "./nec-adapter";
import { validateYagiResult } from "./result";
import type { GeneratedYagiModel, YagiSolverResult } from "./schema";

export type YagiDeckSolver = (request: NecDeckRunRequest, signal?: AbortSignal) => Promise<SimulationResult>;
const engine = new WasmEngine();
const defaultSolver: YagiDeckSolver = (request, signal) => engine.runDeck(request, 120_000, signal);

export async function runYagiModel(generated: GeneratedYagiModel, options: { solver?: YagiDeckSolver; signal?: AbortSignal } = {}): Promise<YagiSolverResult> {
  const adapted = adaptYagiToNec(generated);
  const simulation = await (options.solver ?? defaultSolver)(adapted.runRequest, options.signal);
  return validateYagiResult(generated.model, adapted, simulation);
}
