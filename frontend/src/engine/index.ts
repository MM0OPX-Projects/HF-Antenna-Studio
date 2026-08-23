/**
 * Engine factory — returns the appropriate SimulationEngine based on VITE_ENGINE.
 *
 * - "wasm" (default): local nec2c compiled to WebAssembly
 * - "backend": legacy AntennaSim REST API + WebSocket, only when explicitly requested
 */

import type { SimulationEngine } from "./types";
import { BackendEngine } from "./backend";
import { WasmEngine } from "./wasm";

let _engine: SimulationEngine | null = null;

/** Get the singleton SimulationEngine instance */
export function getEngine(): SimulationEngine {
  if (!_engine) {
    const mode = import.meta.env.VITE_ENGINE as string | undefined;
    if (mode === "backend") {
      _engine = new BackendEngine();
    } else {
      _engine = new WasmEngine();
    }
  }
  return _engine;
}

// Re-export types for convenience
export type {
  SimulationEngine,
  SimulateRequest,
  SimulateAdvancedRequest,
  ImportResult,
  ExportData,
  OptimizationRequest,
  OptimizationProgress,
  OptimizationResult,
} from "./types";
