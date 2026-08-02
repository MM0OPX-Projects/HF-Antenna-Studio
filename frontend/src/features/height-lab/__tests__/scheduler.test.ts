import { afterEach, describe, expect, it, vi } from "vitest";
import { HeightLabScheduler, type HeightCalculationState } from "../scheduler";

describe("HeightLabScheduler", () => {
  afterEach(() => vi.useRealTimers());

  it("debounces rapid slider requests and executes only the final one", async () => {
    vi.useFakeTimers();
    const scheduler = new HeightLabScheduler<number>(450);
    const states: HeightCalculationState<number>[] = [];
    let calls = 0;
    const request = async () => ++calls;

    scheduler.schedule("0.10", request, (state) => states.push(state));
    scheduler.schedule("0.25", request, (state) => states.push(state));
    scheduler.schedule("0.50", request, (state) => states.push(state));
    await vi.advanceTimersByTimeAsync(449);
    expect(calls).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(1);
    expect(states[states.length - 1]).toEqual({ key: "0.50", phase: "success", result: 1, error: null });
  });

  it("aborts an in-flight solve and never publishes its stale response", async () => {
    vi.useFakeTimers();
    const scheduler = new HeightLabScheduler<string>(10);
    const states: HeightCalculationState<string>[] = [];
    let oldSignal: AbortSignal | undefined;
    let resolveOld: ((value: string) => void) | undefined;
    scheduler.schedule("old", (signal) => {
      oldSignal = signal;
      return new Promise((resolve) => { resolveOld = resolve; });
    }, (state) => states.push(state));
    await vi.advanceTimersByTimeAsync(10);

    scheduler.schedule("new", async () => "new result", (state) => states.push(state));
    expect(oldSignal?.aborted).toBe(true);
    resolveOld?.("stale result");
    await vi.advanceTimersByTimeAsync(10);
    expect(states.some((state) => state.result === "stale result")).toBe(false);
    expect(states[states.length - 1]?.result).toBe("new result");
  });

  it("restores exact model keys from its bounded cache without another solve", async () => {
    vi.useFakeTimers();
    const scheduler = new HeightLabScheduler<number>(5, 2);
    let calls = 0;
    let latest: HeightCalculationState<number> | null = null;
    scheduler.schedule("a", async () => ++calls, (state) => { latest = state; });
    await vi.advanceTimersByTimeAsync(5);
    scheduler.schedule("a", async () => ++calls, (state) => { latest = state; });
    expect(calls).toBe(1);
    expect(latest).toEqual({ key: "a", phase: "cached", result: 1, error: null });
  });
});
