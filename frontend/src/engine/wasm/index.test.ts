import { afterEach, describe, expect, it, vi } from "vitest";
import { WasmEngine } from ".";
import type { SimulateAdvancedRequest } from "../types";

class SilentWorker {
  static latest: SilentWorker | null = null;
  terminated = false;
  private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  constructor() {
    SilentWorker.latest = this;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  postMessage(): void {
    // Deliberately silent to exercise the timeout path.
  }

  terminate(): void {
    this.terminated = true;
  }
}

const request: SimulateAdvancedRequest = {
  wires: [
    {
      tag: 1,
      segments: 11,
      x1: -5,
      y1: 0,
      z1: 10,
      x2: 5,
      y2: 0,
      z2: 10,
      radius: 0.001,
    },
  ],
  excitations: [
    {
      wire_tag: 1,
      segment: 6,
      voltage_real: 1,
      voltage_imag: 0,
    },
  ],
  ground: { type: "free_space" },
  frequency: { start_mhz: 14.1, stop_mhz: 14.1, steps: 1 },
};

describe("WasmEngine worker failures", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    SilentWorker.latest = null;
  });

  it("rejects and resets a worker that does not answer before the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", SilentWorker);

    const result = new WasmEngine().simulateAdvanced(request).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(120_000);

    await expect(result).resolves.toMatchObject({
      message: "Simulation timed out after 120 seconds.",
    });
    expect(SilentWorker.latest?.terminated).toBe(true);
  });
});
