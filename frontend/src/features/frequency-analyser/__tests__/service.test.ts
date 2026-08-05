import { describe, expect, it, vi } from "vitest";
import type { FrequencyResult, SimulationResult } from "../../../api/nec";
import type { SimulateAdvancedRequest } from "../../../engine/types";
import { buildAnalyserDeckRequest, runAnalyserSweep } from "../service";
import type { SweepConfig } from "../types";

const config: SweepConfig = { mode: "start-stop", startMhz: 14, stopMhz: 14.2, points: 3, referenceOhms: 75 };
const antenna: SimulateAdvancedRequest = {
  wires: [{ tag: 1, segments: 11, x1: -5, y1: 0, z1: 10, x2: 5, y2: 0, z2: 10, radius: 0.001 }],
  excitations: [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0 }],
  ground: { type: "perfect" },
  frequency: { start_mhz: 7, stop_mhz: 7, steps: 1 },
};

function frequency(frequency_mhz: number, real: number, imag: number): FrequencyResult {
  return { frequency_mhz, impedance: { real, imag }, swr_50: 999, gain_max_dbi: -999.99, gain_max_theta: 0, gain_max_phi: 0, front_to_back_db: null, beamwidth_e_deg: null, beamwidth_h_deg: null, efficiency_percent: null, pattern: null, currents: null };
}

function simulation(points: FrequencyResult[]): SimulationResult {
  return { simulation_id: "test", engine: "test-nec", computed_in_ms: 12, total_segments: 11, cached: false, frequency_data: points, warnings: [] };
}

describe("frequency analyser NEC service", () => {
  it("emits one impedance-only batched frequency card", () => {
    const request = buildAnalyserDeckRequest(antenna, config);
    expect(request.deck.match(/^FR /gm)).toHaveLength(1);
    expect(request.deck).toContain("FR 0 3 0 0 14.000000 0.100000");
    expect(request.deck.match(/^XQ 0$/gm)).toHaveLength(1);
    expect(request.deck).not.toMatch(/^RP /m);
    expect(request.deck).toContain("PT -1 0 0 0");
    expect(request.parse).toMatchObject({ computeCurrents: false, totalSegments: 11 });
  });

  it("passes cancellation to the solver and derives the selected reference impedance", async () => {
    const controller = new AbortController();
    const solver = vi.fn(async (_request, signal?: AbortSignal) => {
      expect(signal).toBe(controller.signal);
      return simulation([frequency(14, 75, 0), frequency(14.1, 50, 10), frequency(14.2, 25, -4)]);
    });
    const sweep = await runAnalyserSweep(antenna, config, { solver, signal: controller.signal });
    expect(solver).toHaveBeenCalledOnce();
    expect(sweep.points).toHaveLength(3);
    expect(sweep.points[0]!.swr).toBe(1);
    expect(sweep.config.referenceOhms).toBe(75);
  });

  it("rejects truncated and non-finite solver output", async () => {
    await expect(runAnalyserSweep(antenna, config, { solver: async () => simulation([frequency(14, 50, 0)]) })).rejects.toThrow("Expected 3 frequency points");
    await expect(runAnalyserSweep(antenna, config, { solver: async () => simulation([frequency(14, 50, 0), frequency(14.1, Number.NaN, 0), frequency(14.2, 50, 0)]) })).rejects.toThrow("non-finite impedance");
    await expect(runAnalyserSweep(antenna, config, { solver: async () => simulation([frequency(14, 50, 0), frequency(14.15, 50, 0), frequency(14.2, 50, 0)]) })).rejects.toThrow("frequency mismatch at point 2");
  });

  it("propagates solver cancellation without publishing a result", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runAnalyserSweep(antenna, config, { signal: controller.signal, solver: async (_request, signal) => {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return simulation([]);
    } })).rejects.toMatchObject({ name: "AbortError" });
  });
});
