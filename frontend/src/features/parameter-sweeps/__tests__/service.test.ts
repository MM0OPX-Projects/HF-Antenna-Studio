import { describe, expect, it, vi } from "vitest";
import { createDefaultSweepDefinition, fingerprintText } from "../model";
import { ParameterSweepRunner, type SweepPointSolver } from "../service";

function solved(modelKey: string, deck = `CM exact ${modelKey}\nEN\n`) {
  return { modelKey, generatedNec: deck, necFingerprint: fingerprintText(deck), metrics: { swr: 1.5, gainDbi: 7, takeOffAngleDeg: 30, frontToBackDb: null, resistanceOhm: 60, reactanceOhm: -5 }, engine: "fixture-nec", computedInMs: 4, warnings: [] };
}

describe("ParameterSweepRunner", () => {
  it("solves every exact point, publishes progress, and restores repeat runs from its bounded cache", async () => {
    const definition = createDefaultSweepDefinition(); definition.axes[0] = { parameterId: "dipole-height", start: 5, stop: 10, points: 3 };
    const solver = vi.fn<SweepPointSolver>(async (built) => solved(built.modelKey));
    const runner = new ParameterSweepRunner(10, solver);
    const progress: number[] = [];
    const first = await runner.run(definition, { onProgress: (state) => progress.push(state.completed) });
    expect(progress).toEqual([1, 2, 3]);
    expect(first.points.map((point) => point.parameterValues["dipole-height"])).toEqual([5, 7.5, 10]);
    expect(new Set(first.points.map((point) => point.modelKey)).size).toBe(3);
    expect(first.points.every((point) => point.necFingerprint === fingerprintText(point.generatedNec))).toBe(true);
    const second = await runner.run(definition);
    expect(solver).toHaveBeenCalledTimes(3);
    expect(second.cacheHits).toBe(3);
    expect(second.points.every((point) => point.cached)).toBe(true);
  });

  it("cancels an in-flight point and never returns a partial result", async () => {
    const controller = new AbortController();
    const solver: SweepPointSolver = (_built, signal) => new Promise((_resolve, reject) => {
      const cancel = () => reject(new DOMException("cancelled", "AbortError"));
      if (signal?.aborted) cancel(); else signal?.addEventListener("abort", cancel, { once: true });
    });
    const promise = new ParameterSweepRunner(10, solver).run(createDefaultSweepDefinition(), { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects solver results whose model identity or NEC fingerprint differs from the requested point", async () => {
    await expect(new ParameterSweepRunner(10, async () => solved("wrong-model")).run(createDefaultSweepDefinition())).rejects.toThrow("model identity mismatch");
    await expect(new ParameterSweepRunner(10, async (built) => ({ ...solved(built.modelKey), necFingerprint: "wrong" })).run(createDefaultSweepDefinition())).rejects.toThrow("NEC fingerprint mismatch");
  });
});
