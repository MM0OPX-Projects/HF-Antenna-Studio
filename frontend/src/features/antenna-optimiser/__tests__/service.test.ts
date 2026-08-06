import { describe, expect, it, vi } from "vitest";
import { fingerprintText } from "../../parameter-sweeps/model";
import type { SweepPointSolver } from "../../parameter-sweeps/service";
import { builtParameterValue } from "../../parameter-sweeps/model";
import { createDefaultOptimisationDefinition } from "../model";
import { AntennaOptimiserRunner } from "../service";

function response(modelKey: string, length: number, deck = `CM dipole length ${length}\nGW 1 3 ${-length / 2} 0 10 ${length / 2} 0 10 .001\nEN\n`) {
  const swr = 1 + (length - 9.5) ** 2;
  return { modelKey, generatedNec: deck, necFingerprint: fingerprintText(deck), metrics: { swr, gainDbi: 7 - Math.abs(length - 9.5), takeOffAngleDeg: 25, frontToBackDb: null, resistanceOhm: 50 + (length - 9.5) * 10, reactanceOhm: (length - 9.5) * 30 }, engine: "fixture-nec", computedInMs: 2, warnings: [] };
}

describe("AntennaOptimiserRunner", () => {
  it("improves a simple known convex SWR task and retains reproducible best candidates", async () => {
    const definition = createDefaultOptimisationDefinition();
    definition.variables[0] = { parameterId: "dipole-length", minimum: 8.5, maximum: 12 };
    definition.algorithm.maximumEvaluations = 24;
    const solver = vi.fn<SweepPointSolver>(async (built) => response(built.modelKey, builtParameterValue(built, "dipole-length")));
    const progress: number[] = [];
    const runner = new AntennaOptimiserRunner(64, solver);
    const result = await runner.run(definition, { onProgress: (state) => progress.push(state.completed) });
    expect(result.startingDesign.evaluation).toBe(1);
    expect(Math.abs(result.bestSolution.parameters["dipole-length"]! - 9.5)).toBeLessThan(0.15);
    expect(result.bestSolution.score).toBeLessThan(result.startingDesign.score!);
    expect(result.retainedSolutions.length).toBeGreaterThan(1);
    expect(result.retainedSolutions.length).toBeLessThanOrEqual(5);
    expect(result.globalOptimumEstablished).toBe(false);
    expect(result.bestSolution.bestSoFarScore).toBe(result.bestSolution.score);
    expect(progress).toEqual(result.history.map((candidate) => candidate.evaluation));
    expect(new Set(result.history.flatMap((candidate) => candidate.solved ? [candidate.solved.modelKey] : [])).size).toBe(result.history.filter((candidate) => candidate.solved).length);
  });

  it("is deterministic and restores exact candidate models from cache on a repeated run", async () => {
    const definition = createDefaultOptimisationDefinition(); definition.algorithm.maximumEvaluations = 9;
    const solver = vi.fn<SweepPointSolver>(async (built) => response(built.modelKey, builtParameterValue(built, "dipole-length")));
    const runner = new AntennaOptimiserRunner(64, solver);
    const first = await runner.run(definition); const calls = solver.mock.calls.length;
    const second = await runner.run(definition);
    expect(second.history.map((candidate) => candidate.parameters)).toEqual(first.history.map((candidate) => candidate.parameters));
    expect(second.bestSolution.parameters).toEqual(first.bestSolution.parameters);
    expect(solver).toHaveBeenCalledTimes(calls);
    expect(second.cacheHits).toBe(second.history.length);
  });

  it("records constraint and model rejection without accepting them as best solutions", async () => {
    const definition = createDefaultOptimisationDefinition(); definition.constraints.maximumSwr = 1.05; definition.algorithm.maximumEvaluations = 20;
    const solver: SweepPointSolver = async (built) => response(built.modelKey, builtParameterValue(built, "dipole-length"));
    const result = await new AntennaOptimiserRunner(64, solver).run(definition);
    expect(result.history.some((candidate) => candidate.status === "constraint-rejected")).toBe(true);
    expect(result.bestSolution.status).toBe("feasible");
    expect(result.bestSolution.solved.necFingerprint).toBe(fingerprintText(result.bestSolution.solved.generatedNec));
  });

  it("cancels an in-flight solver and returns no partial optimisation result", async () => {
    const controller = new AbortController();
    const solver: SweepPointSolver = (_built, signal) => new Promise((_resolve, reject) => {
      const cancel = () => reject(new DOMException("cancelled", "AbortError"));
      if (signal?.aborted) cancel(); else signal?.addEventListener("abort", cancel, { once: true });
    });
    const promise = new AntennaOptimiserRunner(64, solver).run(createDefaultOptimisationDefinition(), { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects a result whose model identity or NEC fingerprint is not exact", async () => {
    await expect(new AntennaOptimiserRunner(10, async (built) => response("wrong", builtParameterValue(built, "dipole-length"))).run(createDefaultOptimisationDefinition())).rejects.toThrow("model identity mismatch");
    await expect(new AntennaOptimiserRunner(10, async (built) => ({ ...response(built.modelKey, builtParameterValue(built, "dipole-length")), necFingerprint: "wrong" })).run(createDefaultOptimisationDefinition())).rejects.toThrow("NEC fingerprint mismatch");
  });

  it("rechecks cached NEC evidence before reuse", async () => {
    const definition = createDefaultOptimisationDefinition(); definition.algorithm.maximumEvaluations = 3;
    let firstSolved: ReturnType<typeof response> | null = null;
    const runner = new AntennaOptimiserRunner(10, async (built) => {
      const solved = response(built.modelKey, builtParameterValue(built, "dipole-length"));
      firstSolved ??= solved;
      return solved;
    });
    await runner.run(definition);
    firstSolved!.generatedNec += "CM altered after caching\n";
    await expect(runner.run(definition)).rejects.toThrow("NEC fingerprint mismatch");
  });
});
