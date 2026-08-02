import type { SimulationResult } from "../../api/nec";
import { WasmEngine } from "../../engine/wasm";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { adaptLoopBeamToNec } from "./nec-adapter";
import { validateLoopBeamResult } from "./result";
import type { GeneratedLoopBeamModel, LoopBeamSolverResult } from "./schema";
export type LoopBeamDeckSolver = (request: NecDeckRunRequest, signal?: AbortSignal) => Promise<SimulationResult>;
const engine = new WasmEngine(); const defaultSolver: LoopBeamDeckSolver = (request, signal) => engine.runDeck(request, 120_000, signal);
export async function runLoopBeamModel(generated: GeneratedLoopBeamModel, options: { solver?: LoopBeamDeckSolver; signal?: AbortSignal } = {}): Promise<LoopBeamSolverResult> { const adapted = adaptLoopBeamToNec(generated); const simulation = await (options.solver ?? defaultSolver)(adapted.runRequest, options.signal); return validateLoopBeamResult(generated.model, adapted, simulation); }
