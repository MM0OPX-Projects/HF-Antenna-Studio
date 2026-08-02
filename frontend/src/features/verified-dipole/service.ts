import type { SimulationResult } from "../../api/nec";
import { WasmEngine } from "../../engine/wasm";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import type { HorizontalDipoleModel } from "./model";
import { adaptDipoleToNec, type AdaptedDipoleNec } from "./nec-adapter";
import { validateDipoleResult, type VerifiedDipoleResult } from "./result";

export type ExactDeckSolver = (request: NecDeckRunRequest, signal?: AbortSignal) => Promise<SimulationResult>;

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
const defaultSolver: ExactDeckSolver = (request, signal) => defaultEngine.runDeck(request, 120_000, signal);

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("Solver timeout must be a positive finite duration.");
  }
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortCleanup: () => void = () => undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Solver timed out after ${timeoutMs / 1000} seconds.`)),
      timeoutMs,
    );
  });
  const cancelled = new Promise<never>((_, reject) => {
    if (!signal) return;
    const handleAbort = () => reject(new Error("Solver calculation cancelled."));
    if (signal.aborted) handleAbort();
    else signal.addEventListener("abort", handleAbort, { once: true });
    abortCleanup = () => signal.removeEventListener("abort", handleAbort);
  });
  try {
    return await Promise.race([promise, timeout, cancelled]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    abortCleanup();
  }
}

export async function runVerifiedDipole(
  model: HorizontalDipoleModel,
  options: { solver?: ExactDeckSolver; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<VerifiedDipoleRun> {
  const adapted = adaptDipoleToNec(model);
  try {
    const simulation = await withDeadline(
      (options.solver ?? defaultSolver)(adapted.runRequest, options.signal),
      options.timeoutMs ?? 120_000,
      options.signal,
    );
    return { adapted, result: validateDipoleResult(model, adapted, simulation) };
  } catch (error) {
    if (error instanceof RangeError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new VerifiedDipoleSolverError(`Verified dipole calculation failed: ${message}`, error);
  }
}
