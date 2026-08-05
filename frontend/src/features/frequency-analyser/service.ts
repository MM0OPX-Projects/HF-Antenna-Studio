import type { SimulationResult } from "../../api/nec";
import { WasmEngine } from "../../engine/wasm";
import { buildCardDeck } from "../../engine/parsers/nec-input";
import type { SimulateAdvancedRequest } from "../../engine/types";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { deriveAnalyserPoints, validateSweepConfig } from "./math";
import type { AnalyserSweep, SweepConfig } from "./types";

const engine = new WasmEngine();
const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#ef4444"];

export type AnalyserSolver = (request: NecDeckRunRequest, signal?: AbortSignal) => Promise<SimulationResult>;
const defaultSolver: AnalyserSolver = (request, signal) => engine.runDeck(request, 120_000, signal);

export function buildAnalyserDeckRequest(antenna: SimulateAdvancedRequest, config: SweepConfig): NecDeckRunRequest {
  const errors = validateSweepConfig(config);
  if (errors.length) throw new Error(errors.join(" "));
  const request: SimulateAdvancedRequest = {
    ...antenna,
    frequency: { start_mhz: config.startMhz, stop_mhz: config.stopMhz, steps: config.points },
    frequencySegments: undefined,
    compute_currents: false,
    compute_pattern: false,
    near_field: undefined,
    comment: "HF Antenna Studio impedance analyser sweep",
  };
  return {
    deck: buildCardDeck(request),
    parse: {
      nTheta: 1,
      nPhi: 1,
      thetaStart: 0,
      thetaStep: 1,
      phiStart: 0,
      phiStep: 1,
      computeCurrents: false,
      totalSegments: antenna.wires.reduce((sum, wire) => sum + wire.segments, 0),
    },
  };
}

export async function runAnalyserSweep(
  antenna: SimulateAdvancedRequest,
  config: SweepConfig,
  options: { signal?: AbortSignal; solver?: AnalyserSolver; label?: string; colorIndex?: number } = {},
): Promise<AnalyserSweep> {
  const request = buildAnalyserDeckRequest(antenna, config);
  const simulation = await (options.solver ?? defaultSolver)(request, options.signal);
  if (simulation.frequency_data.length !== config.points) {
    throw new Error(`Expected ${config.points} frequency points, received ${simulation.frequency_data.length}.`);
  }
  if (simulation.frequency_data.some((point) => !Number.isFinite(point.impedance.real) || !Number.isFinite(point.impedance.imag))) {
    throw new Error("The solver returned a non-finite impedance value.");
  }
  const stepMhz = (config.stopMhz - config.startMhz) / (config.points - 1);
  // nec2c's frequency header is printed to 0.001 MHz, so parsing can differ
  // from the exact FR request by up to half a displayed increment.
  const frequencyToleranceMhz = Math.max(0.00051, Math.abs(stepMhz) * 0.000001);
  simulation.frequency_data.forEach((point, index) => {
    const expected = config.startMhz + index * stepMhz;
    if (Math.abs(point.frequency_mhz - expected) > frequencyToleranceMhz) {
      throw new Error(`Solver frequency mismatch at point ${index + 1}: expected ${expected.toFixed(6)} MHz, received ${point.frequency_mhz.toFixed(6)} MHz.`);
    }
  });
  return {
    id: `sweep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    label: options.label ?? `${config.startMhz.toFixed(3)}–${config.stopMhz.toFixed(3)} MHz`,
    color: COLORS[(options.colorIndex ?? 0) % COLORS.length]!,
    config: { ...config },
    points: deriveAnalyserPoints(simulation.frequency_data, config.referenceOhms),
    rawFrequencyData: simulation.frequency_data,
    computedInMs: simulation.computed_in_ms,
    engine: simulation.engine,
    warnings: simulation.warnings,
    createdAt: new Date().toISOString(),
  };
}
