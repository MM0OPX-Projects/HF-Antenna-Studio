import { describe, expect, it, vi } from "vitest";
import type { PatternData, SimulationResult } from "../../../api/nec";
import type { NecDeckRunRequest } from "../../../engine/wasm/worker";
import { adaptYagiToNec } from "../nec-adapter";
import { generateYagiModel, startingYagiModel } from "../model";
import { calculateYagiDirectionalMetrics } from "../result";
import { runYagiModel } from "../service";

function angularDistance(a: number, b: number): number { return Math.abs(((a - b + 540) % 360) - 180); }

function pattern(): PatternData {
  const gain = Array.from({ length: 46 }, (_, ti) => Array.from({ length: 180 }, (_, pi) => {
    const theta = ti * 2;
    const phi = pi * 2;
    return 8 - 20 * Math.pow(angularDistance(phi, 90) / 180, 2) - Math.abs(theta - 70) * 0.05;
  }));
  return { theta_start: 0, theta_step: 2, theta_count: 46, phi_start: 0, phi_step: 2, phi_count: 180, gain_dbi: gain };
}

function simulation(): SimulationResult {
  const generated = generateYagiModel(startingYagiModel());
  const adapted = adaptYagiToNec(generated);
  let absoluteSegment = 1;
  const currents = adapted.segmentation.wires.map((wire, index) => {
    const point = { tag: wire.tag, segment: absoluteSegment, x: wire.startM.x, y: wire.startM.y, z: wire.startM.z, current_real: 1 / (index + 1), current_imag: 0, current_magnitude: 1 / (index + 1), current_phase_deg: -index * 30 };
    absoluteSegment += wire.segments;
    return point;
  });
  return { simulation_id: "yagi-test", engine: "test-engine", computed_in_ms: 22, total_segments: adapted.segmentation.totalSegments, cached: false, warnings: ["solver warning"], frequency_data: [{ frequency_mhz: 14.175, impedance: { real: 28, imag: -6 }, swr_50: 2, gain_max_dbi: 8, gain_max_theta: 70, gain_max_phi: 90, front_to_back_db: 20, beamwidth_e_deg: null, beamwidth_h_deg: null, efficiency_percent: null, pattern: pattern(), currents }] };
}

describe("Yagi result contract", () => {
  it("measures direction from the explicit +Y axis and distinguishes F/B from F/R", () => {
    const metrics = calculateYagiDirectionalMetrics(pattern());
    expect(metrics.forwardBearingDeg).toBe(90);
    expect(metrics.takeOffAngleDeg).toBe(20);
    expect(metrics.forwardGainDbi).toBeCloseTo(8, 6);
    expect(metrics.rearGainDbi).toBeCloseTo(-12, 6);
    expect(metrics.frontToBackDb).toBeCloseTo(20, 6);
    expect(metrics.frontToRearDb).toBeLessThan(metrics.frontToBackDb);
    expect(metrics.beamwidthDeg).toBeGreaterThan(130);
    expect(metrics.beamwidthDeg).toBeLessThan(145);
    expect(metrics.azimuthPattern).toHaveLength(180);
    expect(metrics.elevationPattern).toHaveLength(91);
    expect(metrics.elevationPattern[0]).toMatchObject({ angleDeg: 0 });
    expect(metrics.elevationPattern[metrics.elevationPattern.length - 1]).toMatchObject({ angleDeg: 180 });
    expect(metrics.elevationPattern.find((point) => point.angleDeg === 4)!.gainDbi)
      .toBeGreaterThan(metrics.elevationPattern.find((point) => point.angleDeg === 176)!.gainDbi);
  });

  it("does not silently redefine a stronger rear lobe as forward", () => {
    const reversed = pattern();
    for (let ti = 0; ti < reversed.theta_count; ti += 1) {
      for (let pi = 0; pi < reversed.phi_count; pi += 1) {
        const phi = pi * reversed.phi_step;
        if (angularDistance(phi, 270) < 20) {
          const row = reversed.gain_dbi[ti]!;
          row[pi] = (row[pi] ?? -999.99) + 30;
        }
      }
    }
    const metrics = calculateYagiDirectionalMetrics(reversed);
    expect(metrics.forwardGainDbi).toBeCloseTo(8, 6);
    expect(metrics.maximumRearGainDbi).toBeGreaterThan(metrics.forwardGainDbi);
    expect(metrics.frontToRearDb).toBeLessThan(0);
  });

  it("executes the displayed deck and maps impedance, SWR, pattern, and all element currents", async () => {
    const generated = generateYagiModel(startingYagiModel());
    const solver = vi.fn(async (_request: NecDeckRunRequest) => simulation());
    const result = await runYagiModel(generated, { solver });
    expect(solver.mock.calls[0]![0].deck).toBe(result.generatedNec);
    expect(result).toMatchObject({ resistanceOhm: 28, reactanceOhm: -6, forwardGainDbi: 8, rearGainDbi: -12, engine: "test-engine" });
    expect(result.swr).toBeGreaterThan(1);
    expect(result.currentDistribution.map((point) => point.wireId)).toEqual(["reflector", "driven", "director-1"]);
    expect(result.currentDistribution[2]).toMatchObject({ family: "director", phaseDeg: -60, fractionAlongWire: expect.any(Number) });
    expect(result.warnings).toContain("solver warning");
  });

  it("rejects missing patterns and currents, and propagates failures and cancellation", async () => {
    const generated = generateYagiModel(startingYagiModel());
    const missingPattern = simulation();
    missingPattern.frequency_data[0]!.pattern = null;
    await expect(runYagiModel(generated, { solver: async () => missingPattern })).rejects.toThrow("radiation pattern");
    const missingCurrents = simulation();
    missingCurrents.frequency_data[0]!.currents = null;
    await expect(runYagiModel(generated, { solver: async () => missingCurrents })).rejects.toThrow("element-current");
    await expect(runYagiModel(generated, { solver: async () => { throw new Error("solver unavailable"); } })).rejects.toThrow("solver unavailable");
    const controller = new AbortController(); controller.abort();
    await expect(runYagiModel(generated, { signal: controller.signal, solver: async (_request, signal) => { if (signal?.aborted) throw new DOMException("Aborted", "AbortError"); return simulation(); } })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("adds a visible diagnostic when the strongest rear response exceeds forward", async () => {
    const generated = generateYagiModel(startingYagiModel());
    const reversed = simulation();
    const grid = reversed.frequency_data[0]!.pattern!;
    for (let ti = 0; ti < grid.theta_count; ti += 1) for (let pi = 0; pi < grid.phi_count; pi += 1) {
      if (angularDistance(pi * grid.phi_step, 270) < 20) {
        const row = grid.gain_dbi[ti]!;
        row[pi] = (row[pi] ?? -999.99) + 30;
      }
    }
    const result = await runYagiModel(generated, { solver: async () => reversed });
    expect(result.frontToRearDb).toBeLessThan(0);
    expect(result.warnings.some((warning) => warning.includes("rear-hemisphere radiation exceeds"))).toBe(true);
  });
});
