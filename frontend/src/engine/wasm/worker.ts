/** Run nec2c in an isolated Web Worker and parse its text output. */

import type { NearFieldResult, SimulationResult } from "../../api/nec";
import { buildCardDeck } from "../parsers/nec-input";
import { parseNearFieldOutput, parseNecOutput } from "../parsers/nec-output";
import type { SimulateAdvancedRequest } from "../types";
import type { Nec2cModule } from "./nec2c-module";

export interface NecDeckParseConfig {
  nTheta: number;
  nPhi: number;
  thetaStart: number;
  thetaStep: number;
  phiStart: number;
  phiStep: number;
  computeCurrents: boolean;
  totalSegments: number;
}

export interface NecDeckRunRequest {
  /** Exact text written to /input.nec. */
  deck: string;
  /** Grid metadata needed to reconstruct NEC's flattened RP output. */
  parse: NecDeckParseConfig;
}

export interface SimulateMessage {
  type: "simulate";
  id: string;
  request: SimulateAdvancedRequest;
}

export interface RunDeckMessage {
  type: "run-deck";
  id: string;
  request: NecDeckRunRequest;
}

export type WorkerRequest = SimulateMessage | RunDeckMessage;

export interface WorkerSuccessResponse {
  type: "success";
  id: string;
  result: SimulationResult;
}

export interface WorkerErrorResponse {
  type: "error";
  id: string;
  message: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

let createNec2cFactory:
  | ((opts?: Record<string, unknown>) => Promise<Nec2cModule>)
  | null = null;

async function ensureFactory(): Promise<void> {
  if (createNec2cFactory) return;
  const wasmBase = import.meta.env.BASE_URL;
  const response = await fetch(`${wasmBase}wasm/nec2c.js`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch nec2c.js (${response.status}). Ensure WASM artifacts are in public/wasm/.`,
    );
  }
  (0, eval)(await response.text());
  const factory = (self as unknown as Record<string, unknown>)
    .createNec2c as typeof createNec2cFactory;
  if (!factory) {
    throw new Error("nec2c.js loaded but createNec2c not found on globalThis.");
  }
  createNec2cFactory = factory;
}

interface LoadedModule {
  module: Nec2cModule;
  stderr: string[];
}

async function loadModule(): Promise<LoadedModule> {
  await ensureFactory();
  const wasmBase = import.meta.env.BASE_URL;
  const stderr: string[] = [];
  const module = await createNec2cFactory!({
    locateFile: (path: string) =>
      path.endsWith(".wasm") ? `${wasmBase}wasm/nec2c.wasm` : path,
    print: () => undefined,
    printErr: (line: unknown) => stderr.push(String(line)),
  });
  return { module, stderr };
}

function extractWarnings(output: string, stderr: string[]): string[] {
  const candidates = [
    ...stderr.filter((line) => /\b(?:warning|error)\b/i.test(line)),
    ...output.split(/\r?\n/).filter((line) => /\b(?:warning|error)\b/i.test(line)),
  ]
    .map((line) => line.trim())
    .filter(Boolean);
  return [...new Set(candidates)].slice(0, 20);
}

async function executeDeck(
  deck: string,
  parse: NecDeckParseConfig,
): Promise<{ result: SimulationResult; output: string }> {
  const deckLines = deck.trim().split(/\r?\n/);
  if (deckLines[deckLines.length - 1]?.trim() !== "EN") {
    throw new Error("The NEC deck must end with an EN card.");
  }
  if (deck.length > 2_000_000) {
    throw new Error("The NEC deck exceeds the 2 MB browser-solver limit.");
  }
  const counts = [parse.nTheta, parse.nPhi, parse.totalSegments];
  if (!counts.every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error("NEC parse-grid counts and total segments must be positive integers.");
  }
  if (parse.nTheta * parse.nPhi > 200_000 || parse.totalSegments > 10_000) {
    throw new Error("The NEC result request exceeds browser-solver resource limits.");
  }
  const gridValues = [parse.thetaStart, parse.thetaStep, parse.phiStart, parse.phiStep];
  if (!gridValues.every(Number.isFinite) || parse.thetaStep <= 0 || parse.phiStep <= 0) {
    throw new Error("NEC parse-grid angles must be finite with positive increments.");
  }
  const t0 = performance.now();
  const { module: nec2c, stderr } = await loadModule();
  nec2c.FS.writeFile("/input.nec", deck);
  try {
    nec2c.callMain(["-i", "/input.nec", "-o", "/output.out"]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("exit(0)") && !message.includes("status = 0")) {
      throw new Error(`nec2c execution failed: ${message}`);
    }
  }

  let output: string;
  try {
    output = nec2c.FS.readFile("/output.out", { encoding: "utf8" });
  } catch {
    throw new Error("nec2c did not produce output. The antenna geometry may be invalid.");
  }

  const frequencyData = parseNecOutput(
    output,
    parse.nTheta,
    parse.nPhi,
    parse.thetaStart,
    parse.thetaStep,
    parse.phiStart,
    parse.phiStep,
    parse.computeCurrents,
  );
  if (frequencyData.length === 0) {
    throw new Error("No frequency data parsed from nec2c output. Check antenna geometry.");
  }

  return {
    output,
    result: {
      simulation_id: `wasm-${Date.now().toString(36)}`,
      engine: "wasm-nec2c",
      computed_in_ms: Math.round(performance.now() - t0),
      total_segments: parse.totalSegments,
      cached: false,
      frequency_data: frequencyData,
      near_field: null,
      warnings: extractWarnings(output, stderr),
    },
  };
}

async function runSimulationAsync(request: SimulateAdvancedRequest): Promise<SimulationResult> {
  const patternStep = request.pattern_step ?? 5;
  const isFreeSpace = request.ground.type === "free_space";
  const thetaStart = isFreeSpace ? -180 : -90;
  const thetaRange = isFreeSpace ? 360 : 180;
  const parse: NecDeckParseConfig = {
    nTheta: Math.floor(thetaRange / patternStep) + 1,
    nPhi: Math.floor(360 / patternStep),
    thetaStart,
    thetaStep: patternStep,
    phiStart: 0,
    phiStep: patternStep,
    computeCurrents: request.compute_currents ?? true,
    totalSegments: request.wires.reduce((sum, wire) => sum + wire.segments, 0),
  };
  const executed = await executeDeck(buildCardDeck(request), parse);

  let nearField: NearFieldResult | null = null;
  if (request.near_field) {
    const nf = request.near_field;
    nearField = parseNearFieldOutput(
      executed.output,
      nf.plane,
      nf.height_m,
      nf.extent_m,
      nf.resolution_m,
    );
  }
  return { ...executed.result, near_field: nearField };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    const result = msg.type === "simulate"
      ? await runSimulationAsync(msg.request)
      : (await executeDeck(msg.request.deck, msg.request.parse)).result;
    const response: WorkerSuccessResponse = { type: "success", id: msg.id, result };
    self.postMessage(response);
  } catch (error: unknown) {
    const response: WorkerErrorResponse = {
      type: "error",
      id: msg.id,
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
