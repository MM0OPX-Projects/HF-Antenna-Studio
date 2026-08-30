import { describe, expect, it, vi } from "vitest";
import type { SimulationResult } from "../../../api/nec";
import { createDefaultDipoleModel } from "../model";
import { runVerifiedDipole, VerifiedDipoleSolverError, type ExactDeckSolver } from "../service";

function solverResult(): SimulationResult {
  const thetaCount = 19;
  const phiCount = 72;
  const gain = Array.from({ length: thetaCount }, (_, ti) =>
    Array.from({ length: phiCount }, (_, pi) => 7 - Math.abs(ti - 10) * 0.7 - Math.abs(pi - 18) * 0.02),
  );
  return {
    simulation_id: "test",
    engine: "fixture-nec2c",
    computed_in_ms: 12,
    total_segments: 21,
    cached: false,
    warnings: ["solver warning"],
    frequency_data: [{
      frequency_mhz: 14.1,
      impedance: { real: 72, imag: 18 },
      swr_50: 1,
      gain_max_dbi: 7,
      gain_max_theta: 50,
      gain_max_phi: 90,
      front_to_back_db: null,
      beamwidth_e_deg: null,
      beamwidth_h_deg: null,
      efficiency_percent: 100,
      pattern: {
        theta_start: 0,
        theta_step: 5,
        theta_count: thetaCount,
        phi_start: 0,
        phi_step: 5,
        phi_count: phiCount,
        gain_dbi: gain,
      },
      currents: Array.from({ length: 21 }, (_, index) => ({
        tag: 1,
        segment: index + 1,
        x: -5 + index * 0.5,
        y: 0,
        z: 10,
        current_real: 0.01,
        current_imag: 0,
        current_magnitude: Math.sin(((index + 1) / 22) * Math.PI),
        current_phase_deg: index === 10 ? 0 : 1,
      })),
    }],
  };
}

describe("verified dipole end-to-end service", () => {
  it("passes the displayed exact deck to the injected solver and validates outputs", async () => {
    let solvedDeck = "";
    const solver: ExactDeckSolver = vi.fn(async (request) => {
      solvedDeck = request.deck;
      return solverResult();
    });
    const run = await runVerifiedDipole({ ...createDefaultDipoleModel(), referenceImpedanceOhm: 75 }, { solver });

    expect(solver).toHaveBeenCalledOnce();
    expect(solvedDeck).toBe(run.result.generatedNec);
    expect(run.result.resistanceOhm).toBe(72);
    expect(run.result.reactanceOhm).toBe(18);
    expect(run.result.complexImpedance).toEqual({ realOhm: 72, imaginaryOhm: 18 });
    expect(run.result.swr).toBeCloseTo(1.27, 1);
    expect(run.result.maximumGainDbi).toBe(7);
    expect(run.result.takeOffAngleDeg).toBe(40);
    expect(Math.max(...run.result.azimuthPattern.map((point) => point.normalizedDb))).toBe(0);
    expect(Math.max(...run.result.elevationPattern.map((point) => point.normalizedDb))).toBe(0);
    expect(run.result.elevationPattern[0]!.angleDeg).toBe(0);
    expect(run.result.elevationPattern[run.result.elevationPattern.length - 1]!.angleDeg).toBe(180);
    expect(run.result.currentDistribution).toHaveLength(21);
    expect(run.result.radiationPattern.theta_count).toBe(19);
    expect(Math.max(...run.result.currentDistribution.map((point) => point.normalizedMagnitude))).toBe(1);
  });

  it("surfaces solver failures with feature context", async () => {
    const solver: ExactDeckSolver = async () => { throw new Error("WASM unavailable"); };
    await expect(runVerifiedDipole(createDefaultDipoleModel(), { solver })).rejects.toEqual(
      expect.objectContaining({ name: "VerifiedDipoleSolverError", message: expect.stringContaining("WASM unavailable") }),
    );
  });

  it("times out a solver that never responds", async () => {
    vi.useFakeTimers();
    const solver: ExactDeckSolver = () => new Promise(() => undefined);
    const pending = runVerifiedDipole(createDefaultDipoleModel(), { solver, timeoutMs: 50 });
    const assertion = expect(pending).rejects.toEqual(expect.objectContaining({
      name: "VerifiedDipoleSolverError",
      message: expect.stringContaining("timed out after 0.05 seconds"),
    }));
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    await expect(pending).rejects.toBeInstanceOf(VerifiedDipoleSolverError);
    vi.useRealTimers();
  });

  it("cancels an injected solver without accepting its later result", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const solver: ExactDeckSolver = (_request, signal) => {
      receivedSignal = signal;
      return new Promise(() => undefined);
    };
    const pending = runVerifiedDipole(createDefaultDipoleModel(), { solver, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toEqual(expect.objectContaining({
      name: "VerifiedDipoleSolverError",
      message: expect.stringContaining("cancelled"),
    }));
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("rejects malformed parsed output instead of displaying it", async () => {
    const malformed = solverResult();
    malformed.frequency_data[0]!.pattern = null;
    await expect(runVerifiedDipole(createDefaultDipoleModel(), { solver: async () => malformed })).rejects.toThrow(/radiation pattern/);
  });
});
