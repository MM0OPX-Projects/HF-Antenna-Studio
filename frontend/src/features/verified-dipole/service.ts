import type { SimulationResult } from "../../api/nec";
import { WasmEngine } from "../../engine/wasm";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import type { HorizontalDipoleModel } from "./model";
import { adaptDipoleToNec, type AdaptedDipoleNec } from "./nec-adapter";
import { validateDipoleResult, type VerifiedDipoleResult } from "./result";

export type ExactDeckSolver = (request: NecDeckRunRequest) => Promise<SimulationResult>;

export interface VerifiedDipoleRun {
  adapted: AdaptedDipoleNec;
  result: VerifiedDipoleResult;
}

export class VerifiedDipoleSolverError extends Error {
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = "VerifiedDipoleSolverError";
    this.originalError = originalError;
  }
}

const defaultEngine = new WasmEngine();
const defaultSolver: ExactDeckSolver = (request) => defaultEngine.runDeck(request);

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("Solver timeout must be a positive finite duration.");
  }
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Solver timed out after ${timeoutMs / 1000} seconds.`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function runVerifiedDipole(
  model: HorizontalDipoleModel,
  options: { solver?: ExactDeckSolver; timeoutMs?: number } = {},
): Promise<VerifiedDipoleRun> {
  const adapted = adaptDipoleToNec(model);
  try {
    const simulation = await withTimeout(
      (options.solver ?? defaultSolver)(adapted.runRequest),
      options.timeoutMs ?? 120_000,
    );
    return { adapted, result: validateDipoleResult(model, adapted, simulation) };
  } catch (error) {
    if (error instanceof RangeError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new VerifiedDipoleSolverError(`Verified dipole calculation failed: ${message}`, error);
  }
}
