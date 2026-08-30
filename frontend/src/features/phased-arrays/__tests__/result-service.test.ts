import { describe, expect, it, vi } from "vitest";
import type { PatternData, SegmentCurrent, SimulationResult } from "../../../api/nec";
import type { NecDeckRunRequest } from "../../../engine/wasm/worker";
import { absoluteSegmentNumber, adaptPhysicalNetworkToNec } from "../nec-adapter";
import { generatePhasedArray, startingPhasedArrayModel } from "../model";
import { calculatePhasedDirectionalMetrics } from "../result";
import { runPhasedArrayModel, solveTwoPortVoltages } from "../service";
import type { ComplexValue } from "../schema";

function distance(a: number, b: number): number { return Math.abs(((a - b + 540) % 360) - 180); }
function pattern(headingCompass = 30, bidirectional = false): PatternData {
  const gain = Array.from({ length: 46 }, (_, ti) => Array.from({ length: 180 }, (_, pi) => {
    const elevation = 90 - ti * 2;
    const compass = (90 - pi * 2 + 360) % 360;
    const main = 10 - distance(compass, headingCompass) ** 2 / 1200 - Math.abs(elevation - 24) * .08;
    const reverse = 10 - distance(compass, (headingCompass + 180) % 360) ** 2 / 1200 - Math.abs(elevation - 24) * .08 - (bidirectional ? 0 : 12);
    return Math.max(main, reverse);
  }));
  return { theta_start: 0, theta_step: 2, theta_count: 46, phi_start: 0, phi_step: 2, phi_count: 180, gain_dbi: gain };
}

function current(tag: number, segment: number, value: { real: number; imag: number }): SegmentCurrent {
  const magnitude = Math.hypot(value.real, value.imag);
  return { tag, segment, x: 0, y: 0, z: 0, current_real: value.real, current_imag: value.imag, current_magnitude: magnitude, current_phase_deg: Math.atan2(value.imag, value.real) * 180 / Math.PI };
}

function simulation(request: NecDeckRunRequest, feedValues: [{ real: number; imag: number }, { real: number; imag: number }], impedance = { real: 32, imag: -8 }): SimulationResult {
  const generated = generatePhasedArray(startingPhasedArrayModel());
  const segmentation = request.deck.includes("source-junction") ? adaptPhysicalNetworkToNec(generated).segmentation : undefined;
  const firstSegments = Number(request.deck.match(/^GW 1 (\d+)/m)?.[1] ?? 11);
  const currents = [current(1, 1, feedValues[0]), current(2, firstSegments + 1, feedValues[1])];
  if (segmentation?.sourceJunction) currents.push(current(segmentation.sourceJunction.tag, absoluteSegmentNumber(segmentation, segmentation.sourceJunction.tag, 1), { real: .02, imag: 0 }));
  return { simulation_id: "phased-test", engine: "test-engine", computed_in_ms: 7, total_segments: request.parse.totalSegments, cached: false, warnings: [], frequency_data: [{ frequency_mhz: 14.1, impedance, swr_50: 2, gain_max_dbi: 10, gain_max_theta: 66, gain_max_phi: 60, front_to_back_db: 12, beamwidth_e_deg: null, beamwidth_h_deg: null, efficiency_percent: null, pattern: pattern(), currents }] };
}

describe("phased-array result and service", () => {
  it("uses compass headings and distinguishes exact reverse from rear hemisphere", () => {
    const metrics = calculatePhasedDirectionalMetrics(pattern(30));
    expect(metrics.beamHeadingDeg).toBe(30);
    expect(metrics.takeOffAngleDeg).toBe(24);
    expect(metrics.forwardGainDbi).toBeCloseTo(10, 6);
    expect(metrics.frontToBackDb).toBeCloseTo(12, 6);
    expect(metrics.frontToRearDb).toBeLessThanOrEqual(metrics.frontToBackDb);
    expect(metrics.azimuthPattern[0]!.angleDeg).toBe(0);
    expect(metrics.elevationPattern).toHaveLength(91);
    expect(metrics.elevationPattern[0]!.angleDeg).toBe(0);
    expect(metrics.elevationPattern[metrics.elevationPattern.length - 1]!.angleDeg).toBe(180);
    expect(metrics.elevationPattern.find((point) => point.angleDeg === 4)!.gainDbi)
      .toBeGreaterThan(metrics.elevationPattern.find((point) => point.angleDeg === 176)!.gainDbi);
    expect(metrics.beamHeadingAmbiguous).toBe(false);
    expect(calculatePhasedDirectionalMetrics(pattern(90, true)).beamHeadingAmbiguous).toBe(true);
  });

  it("solves a complex 2x2 admittance matrix", () => {
    const y: [[ComplexValue, ComplexValue], [ComplexValue, ComplexValue]] = [[{ real: 1, imag: 0 }, { real: .2, imag: 0 }], [{ real: .1, imag: 0 }, { real: .8, imag: 0 }]];
    const voltage = solveTwoPortVoltages(y, [{ real: 1, imag: 0 }, { real: 0, imag: -1 }]);
    expect(voltage[0].real).toBeCloseTo(1.025641, 5);
    expect(voltage[0].imag).toBeCloseTo(.256410, 5);
    expect(voltage[1].real).toBeCloseTo(-.128205, 5);
    expect(voltage[1].imag).toBeCloseTo(-1.282051, 5);
  });

  it("calibrates ideal feed currents, executes the final deck, and verifies targets", async () => {
    const model = startingPhasedArrayModel();
    model.ideal.phase2Deg = -90;
    const generated = generatePhasedArray(model);
    let call = 0;
    const solver = vi.fn(async (request: NecDeckRunRequest) => {
      call += 1;
      if (call === 1) return simulation(request, [{ real: 1, imag: 0 }, { real: .1, imag: 0 }]);
      if (call === 2) return simulation(request, [{ real: .2, imag: 0 }, { real: .8, imag: 0 }]);
      return simulation(request, [{ real: 1, imag: 0 }, { real: 0, imag: -1 }]);
    });
    const result = await runPhasedArrayModel(generated, { solver });
    expect(solver).toHaveBeenCalledTimes(3);
    expect(result.calibrationDecks).toHaveLength(2);
    expect(result.generatedNec.match(/^EX /gm)).toHaveLength(2);
    expect(result.elementFeedCurrents[0].magnitudeA).toBeCloseTo(1, 8);
    expect(result.elementFeedCurrents[1].phaseDeg).toBeCloseTo(-90, 8);
    expect(result.requiredSourceVoltages).not.toBeNull();
    expect(result.networkInputImpedance).toBeNull();
  });

  it("runs physical mode once and reports solved rather than requested currents", async () => {
    const model = startingPhasedArrayModel(); model.mode = "physical-feed-network";
    const solver = vi.fn(async (request: NecDeckRunRequest) => simulation(request, [{ real: .7, imag: .1 }, { real: .3, imag: -.2 }], { real: 41, imag: 12 }));
    const result = await runPhasedArrayModel(generatePhasedArray(model), { solver });
    expect(solver).toHaveBeenCalledTimes(1);
    expect(result.generatedNec.match(/^TL /gm)).toHaveLength(2);
    expect(result.networkInputImpedance).toEqual({ real: 41, imag: 12 });
    expect(result.requiredSourceVoltages).toBeNull();
    expect(result.elementFeedCurrents[1].magnitudeA).toBeCloseTo(Math.hypot(.3, -.2), 8);
  });

  it("rejects unverified current enforcement and propagates cancellation", async () => {
    const generated = generatePhasedArray(startingPhasedArrayModel());
    let call = 0;
    await expect(runPhasedArrayModel(generated, { solver: async (request) => {
      call += 1;
      return call < 3 ? simulation(request, call === 1 ? [{ real: 1, imag: 0 }, { real: 0, imag: 0 }] : [{ real: 0, imag: 0 }, { real: 1, imag: 0 }]) : simulation(request, [{ real: .5, imag: 0 }, { real: .5, imag: 0 }]);
    } })).rejects.toThrow("verification failed");
    const controller = new AbortController(); controller.abort();
    await expect(runPhasedArrayModel(generated, { signal: controller.signal, solver: async (_request, signal) => { if (signal?.aborted) throw new DOMException("Aborted", "AbortError"); throw new Error("unexpected"); } })).rejects.toMatchObject({ name: "AbortError" });
  });
});
