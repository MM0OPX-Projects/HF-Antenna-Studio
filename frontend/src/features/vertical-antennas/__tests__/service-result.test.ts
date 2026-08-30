import { describe, expect, it, vi } from "vitest";
import type { SimulationResult } from "../../../api/nec";
import type { NecDeckRunRequest } from "../../../engine/wasm/worker";
import { generateVerticalModel, startingVerticalModel } from "../model";
import { runVerticalModel } from "../service";

function simulation(): SimulationResult {
  const gain = Array.from({ length: 19 }, (_, theta) => Array.from({ length: 72 }, (_, phi) => 5.1 - Math.abs(theta - 18) * 0.5 - (phi % 2) * 0.001));
  return {
    simulation_id: "vertical-test",
    engine: "test-engine",
    computed_in_ms: 12,
    total_segments: 2,
    cached: false,
    warnings: ["solver warning"],
    frequency_data: [{
      frequency_mhz: 14.1,
      impedance: { real: 36.5, imag: 2.5 },
      swr_50: 1.4,
      gain_max_dbi: 5.1,
      gain_max_theta: 90,
      gain_max_phi: 0,
      front_to_back_db: null,
      beamwidth_e_deg: null,
      beamwidth_h_deg: null,
      efficiency_percent: null,
      pattern: { theta_start: 0, theta_step: 5, theta_count: 19, phi_start: 0, phi_step: 5, phi_count: 72, gain_dbi: gain },
      currents: [
        { tag: 1, segment: 1, x: 0, y: 0, z: 1, current_real: 1, current_imag: 0, current_magnitude: 1, current_phase_deg: 0 },
        { tag: 2, segment: 14, x: 1, y: 0, z: 1, current_real: 0.5, current_imag: 0, current_magnitude: 0.5, current_phase_deg: -10 },
      ],
    }],
  };
}

describe("vertical solver pipeline", () => {
  it("executes the exact generated deck and maps impedance, SWR, patterns, and tagged currents", async () => {
    const generated = generateVerticalModel(startingVerticalModel(14_100_000, "elevated-explicit-radials"));
    const solver = vi.fn(async (_request: NecDeckRunRequest) => simulation());
    const result = await runVerticalModel(generated, { solver });
    const request = solver.mock.calls[0]![0];
    expect(request.deck).toBe(result.generatedNec);
    expect(result).toMatchObject({ resistanceOhm: 36.5, reactanceOhm: 2.5, maximumGainDbi: 5.1, takeOffAngleDeg: 0, engine: "test-engine" });
    expect(result.swr).toBeCloseTo(1.3772, 4);
    expect(result.azimuthVariationDb).toBeCloseTo(0.001, 6);
    expect(result.elevationPattern).toHaveLength(37);
    expect(result.elevationPattern[0]!.angleDeg).toBe(0);
    expect(result.elevationPattern[result.elevationPattern.length - 1]!.angleDeg).toBe(180);
    expect(result.azimuthPattern).toHaveLength(72);
    expect(result.currentDistribution[0]).toMatchObject({ wireId: "radiator", family: "radiator", tag: 1 });
    expect(result.currentDistribution[1]).toMatchObject({ wireId: "radial-1", family: "radial", tag: 2, phaseDeg: -10 });
    expect(result.currentDistribution[1]!.fractionAlongWire).toBeLessThan(0.1);
  });

  it("rejects malformed solver results", async () => {
    const generated = generateVerticalModel(startingVerticalModel());
    const malformed = simulation();
    malformed.frequency_data[0]!.pattern = null;
    await expect(runVerticalModel(generated, { solver: async () => malformed })).rejects.toThrow("radiation pattern");
  });

  it("propagates solver failures and abort signals", async () => {
    const generated = generateVerticalModel(startingVerticalModel());
    const controller = new AbortController();
    controller.abort();
    await expect(runVerticalModel(generated, { signal: controller.signal, solver: async (_request, signal) => {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return simulation();
    } })).rejects.toMatchObject({ name: "AbortError" });
    await expect(runVerticalModel(generated, { solver: async () => { throw new Error("solver unavailable"); } })).rejects.toThrow("solver unavailable");
  });
});
