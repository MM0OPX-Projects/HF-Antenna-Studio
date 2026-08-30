import type { PatternData } from "../../api/nec";
import { buildCardDeck } from "../../engine/parsers/nec-input";
import type { SimulateAdvancedRequest } from "../../engine/types";
import { WasmEngine } from "../../engine/wasm";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";

const engine = new WasmEngine();

export interface RadiationPatternResult {
  frequencyMhz: number;
  pattern: PatternData;
  engine: string;
  computedInMs: number;
  warnings: string[];
}

export function buildRadiationPatternRequest(
  antenna: SimulateAdvancedRequest,
  frequencyMhz: number,
  patternStep = 5,
): NecDeckRunRequest {
  if (!Number.isFinite(frequencyMhz) || frequencyMhz < 1.8 || frequencyMhz > 54) {
    throw new RangeError("Radiation-cut frequency must be from 1.8 to 54 MHz.");
  }
  if (![1, 2, 5, 10].includes(patternStep)) throw new RangeError("Radiation-cut angular step must be 1°, 2°, 5° or 10°.");
  const request: SimulateAdvancedRequest = {
    ...antenna,
    frequency: { start_mhz: frequencyMhz, stop_mhz: frequencyMhz, steps: 1 },
    frequencySegments: undefined,
    compute_currents: false,
    compute_pattern: true,
    near_field: undefined,
    pattern_step: patternStep,
    comment: "HF Antenna Studio shared radiation cuts",
  };
  const freeSpace = request.ground.type === "free_space";
  const thetaStart = freeSpace ? -180 : -90;
  const thetaRange = freeSpace ? 360 : 180;
  return {
    deck: buildCardDeck(request),
    parse: {
      nTheta: Math.floor(thetaRange / patternStep) + 1,
      nPhi: Math.floor(360 / patternStep),
      thetaStart,
      thetaStep: patternStep,
      phiStart: 0,
      phiStep: patternStep,
      computeCurrents: false,
      totalSegments: antenna.wires.reduce((sum, wire) => sum + wire.segments, 0),
    },
  };
}

export async function runRadiationPattern(
  antenna: SimulateAdvancedRequest,
  frequencyMhz: number,
  options: { signal?: AbortSignal; patternStep?: number } = {},
): Promise<RadiationPatternResult> {
  const simulation = await engine.runDeck(
    buildRadiationPatternRequest(antenna, frequencyMhz, options.patternStep),
    120_000,
    options.signal,
  );
  const solved = simulation.frequency_data[0];
  if (!solved?.pattern) throw new Error("The NEC solver did not return a radiation-pattern grid.");
  return {
    frequencyMhz: solved.frequency_mhz,
    pattern: solved.pattern,
    engine: simulation.engine,
    computedInMs: simulation.computed_in_ms,
    warnings: simulation.warnings,
  };
}
