import type { SimulationResult } from "../../api/nec";
import { WasmEngine } from "../../engine/wasm";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { adaptVerticalToNec } from "./nec-adapter";
import { validateVerticalResult } from "./result";
import type { GeneratedVerticalModel, VerticalSolverResult } from "./schema";

export type VerticalDeckSolver = (request: NecDeckRunRequest, signal?: AbortSignal) => Promise<SimulationResult>;
const engine = new WasmEngine();
const defaultSolver: VerticalDeckSolver = (request, signal) => engine.runDeck(request, 120_000, signal);

export async function runVerticalModel(
  generated: GeneratedVerticalModel,
  options: { solver?: VerticalDeckSolver; signal?: AbortSignal } = {},
): Promise<VerticalSolverResult> {
  const adapted = adaptVerticalToNec(generated);
  const simulation = await (options.solver ?? defaultSolver)(adapted.runRequest, options.signal);
  return validateVerticalResult(generated.model, adapted, simulation);
}
