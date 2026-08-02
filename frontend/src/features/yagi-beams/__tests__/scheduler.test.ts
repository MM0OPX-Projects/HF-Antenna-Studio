import { afterEach, describe, expect, it, vi } from "vitest";
import { HeightLabScheduler } from "../../height-lab/scheduler";

afterEach(() => vi.useRealTimers());

describe("Yagi debounced scheduling contract", () => {
  it("runs only the final model after rapid slider changes", async () => {
    vi.useFakeTimers();
    const scheduler = new HeightLabScheduler<string>(450, 4);
    const results: string[] = [];
    scheduler.schedule("height-1", async () => "old", (state) => { if (state.result) results.push(state.result); });
    scheduler.schedule("height-2", async () => "new", (state) => { if (state.result) results.push(state.result); });
    await vi.advanceTimersByTimeAsync(451);
    expect(results).toEqual(["new"]);
  });

  it("aborts an in-flight solve and never publishes its stale pattern", async () => {
    vi.useFakeTimers();
    const scheduler = new HeightLabScheduler<string>(10, 4);
    const states: string[] = [];
    let release!: (value: string) => void;
    scheduler.schedule("old-model", (signal) => new Promise<string>((resolve, reject) => { release = resolve; signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))); }), (state) => { if (state.result) states.push(state.result); });
    await vi.advanceTimersByTimeAsync(11);
    scheduler.schedule("new-model", async () => "new-pattern", (state) => { if (state.result) states.push(state.result); });
    release("old-pattern");
    await vi.advanceTimersByTimeAsync(11);
    expect(states).toEqual(["new-pattern"]);
  });

  it("caches only by exact model key", async () => {
    vi.useFakeTimers();
    const scheduler = new HeightLabScheduler<string>(1, 2);
    let calls = 0;
    const request = async () => `result-${++calls}`;
    scheduler.schedule("exact-a", request, () => undefined); await vi.advanceTimersByTimeAsync(2);
    let cached = "";
    scheduler.schedule("exact-a", request, (state) => { if (state.phase === "cached") cached = state.result!; });
    expect(cached).toBe("result-1");
    scheduler.schedule("exact-b", request, () => undefined); await vi.advanceTimersByTimeAsync(2);
    expect(calls).toBe(2);
  });
});
