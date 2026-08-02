import type { SimulationResult } from "../../api/nec";
import { WasmEngine } from "../../engine/wasm";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import {
  adaptIdealCalibrationToNec,
  adaptIdealFinalToNec,
  adaptPhysicalNetworkToNec,
} from "./nec-adapter";
import { complexMagnitude, idealCalibrationKey, phaseComplex } from "./model";
import { extractFeedCurrentComplexes, validatePhasedResult } from "./result";
import type { ComplexValue, GeneratedPhasedArray, PhasedArraySolverResult } from "./schema";

export type PhasedDeckSolver = (request: NecDeckRunRequest, signal?: AbortSignal) => Promise<SimulationResult>;

interface CalibrationEntry {
  admittance: [[ComplexValue, ComplexValue], [ComplexValue, ComplexValue]];
  decks: [string, string];
  computedInMs: number;
}

const engine = new WasmEngine();
const defaultSolver: PhasedDeckSolver = (request, signal) => engine.runDeck(request, 120_000, signal);
const calibrationCache = new Map<string, CalibrationEntry>();

function subtract(a: ComplexValue, b: ComplexValue): ComplexValue { return { real: a.real - b.real, imag: a.imag - b.imag }; }
function multiply(a: ComplexValue, b: ComplexValue): ComplexValue { return { real: a.real * b.real - a.imag * b.imag, imag: a.real * b.imag + a.imag * b.real }; }
function divide(a: ComplexValue, b: ComplexValue): ComplexValue {
  const denominator = b.real * b.real + b.imag * b.imag;
  if (!Number.isFinite(denominator) || denominator < 1e-20) throw new Error("The complex calibration matrix is singular or ill-conditioned.");
  return { real: (a.real * b.real + a.imag * b.imag) / denominator, imag: (a.imag * b.real - a.real * b.imag) / denominator };
}

export function solveTwoPortVoltages(
  admittance: [[ComplexValue, ComplexValue], [ComplexValue, ComplexValue]],
  targetCurrents: [ComplexValue, ComplexValue],
): [ComplexValue, ComplexValue] {
  const [[y11, y12], [y21, y22]] = admittance;
  const determinant = subtract(multiply(y11, y22), multiply(y12, y21));
  if (complexMagnitude(determinant) < 1e-10) throw new Error("The two-port calibration matrix is singular; target currents cannot be enforced safely.");
  return [
    divide(subtract(multiply(targetCurrents[0], y22), multiply(y12, targetCurrents[1])), determinant),
    divide(subtract(multiply(y11, targetCurrents[1]), multiply(targetCurrents[0], y21)), determinant),
  ];
}

function targetCurrents(generated: GeneratedPhasedArray): [ComplexValue, ComplexValue] {
  const ideal = generated.model.ideal;
  const scale = Math.max(ideal.amplitude1, ideal.amplitude2);
  if (!(scale > 0)) throw new RangeError("At least one ideal target-current amplitude must be positive.");
  return [phaseComplex(ideal.amplitude1 / scale, ideal.phase1Deg), phaseComplex(ideal.amplitude2 / scale, ideal.phase2Deg)];
}

function relativeComplexError(actual: ComplexValue, target: ComplexValue): number {
  const difference = complexMagnitude(subtract(actual, target));
  return difference / Math.max(complexMagnitude(target), 1);
}

async function calibrate(
  generated: GeneratedPhasedArray,
  solver: PhasedDeckSolver,
  signal: AbortSignal | undefined,
  useSharedCache: boolean,
): Promise<CalibrationEntry> {
  const key = idealCalibrationKey(generated.model);
  if (useSharedCache) {
    const cached = calibrationCache.get(key);
    if (cached) return { ...cached, computedInMs: 0 };
  }
  const first = adaptIdealCalibrationToNec(generated, 1);
  const second = adaptIdealCalibrationToNec(generated, 2);
  const firstSimulation = await solver(first.runRequest, signal);
  const firstCurrents = extractFeedCurrentComplexes(firstSimulation, first);
  const secondSimulation = await solver(second.runRequest, signal);
  const secondCurrents = extractFeedCurrentComplexes(secondSimulation, second);
  const entry: CalibrationEntry = {
    admittance: [[firstCurrents[0], secondCurrents[0]], [firstCurrents[1], secondCurrents[1]]],
    decks: [first.deck, second.deck],
    computedInMs: firstSimulation.computed_in_ms + secondSimulation.computed_in_ms,
  };
  if (useSharedCache) {
    calibrationCache.set(key, entry);
    if (calibrationCache.size > 32) calibrationCache.delete(calibrationCache.keys().next().value!);
  }
  return entry;
}

export function clearPhasedCalibrationCache(): void { calibrationCache.clear(); }
export function phasedCalibrationCacheSize(): number { return calibrationCache.size; }

export async function runPhasedArrayModel(
  generated: GeneratedPhasedArray,
  options: { solver?: PhasedDeckSolver; signal?: AbortSignal } = {},
): Promise<PhasedArraySolverResult> {
  const solver = options.solver ?? defaultSolver;
  if (generated.model.mode === "physical-feed-network") {
    const adapted = adaptPhysicalNetworkToNec(generated);
    const simulation = await solver(adapted.runRequest, options.signal);
    return validatePhasedResult(generated.model, adapted, simulation, { requiredSourceVoltages: null, calibrationDecks: null });
  }

  const calibration = await calibrate(generated, solver, options.signal, options.solver === undefined);
  const target = targetCurrents(generated);
  const voltages = solveTwoPortVoltages(calibration.admittance, target);
  const adapted = adaptIdealFinalToNec(generated, voltages);
  const simulation = await solver(adapted.runRequest, options.signal);
  const actual = extractFeedCurrentComplexes(simulation, adapted);
  const maximumError = Math.max(relativeComplexError(actual[0], target[0]), relativeComplexError(actual[1], target[1]));
  if (!Number.isFinite(maximumError) || maximumError > 0.03) {
    throw new Error(`The enforced-current verification failed (${(maximumError * 100).toFixed(2)}% complex error). No pattern is accepted for display.`);
  }
  const warning = maximumError > 0.005
    ? [`The final feed currents differ from their calibrated targets by ${(maximumError * 100).toFixed(2)}%; inspect segmentation and convergence.`]
    : [];
  return validatePhasedResult(generated.model, adapted, simulation, {
    requiredSourceVoltages: voltages,
    calibrationDecks: calibration.decks,
    calibrationComputedInMs: calibration.computedInMs,
    extraWarnings: warning,
  });
}
