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

  postMessage(_message?: unknown): void {
    // Deliberately silent to exercise the timeout path.
  }

  terminate(): void {
    this.terminated = true;
  }
}

class AnsweringWorker extends SilentWorker {
  posted: unknown = null;

  override postMessage(message: unknown): void {
    this.posted = message;
    const typed = message as { id: string };
    queueMicrotask(() => this.emit("message", {
      data: {
        type: "success",
        id: typed.id,
        result: {
          simulation_id: "raw-deck-test",
          engine: "wasm-nec2c",
          computed_in_ms: 1,
          total_segments: 1,
          cached: false,
          frequency_data: [],
          warnings: [],
        },
      },
    }));
  }

  emit(type: string, event: unknown): void {
    const listeners = (this as unknown as { listeners: Map<string, Set<EventListenerOrEventListenerObject>> }).listeners.get(type);
    listeners?.forEach((listener) => {
      if (typeof listener === "function") listener(event as Event);
      else listener.handleEvent(event as Event);
    });
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

  it("terminates an in-flight worker when an exact-deck run is cancelled", async () => {
    vi.stubGlobal("Worker", SilentWorker);
    const controller = new AbortController();
    const pending = new WasmEngine().runDeck({
      deck: "CM cancel test\nCE\nEN\n",
      parse: { nTheta: 1, nPhi: 1, thetaStart: 0, thetaStep: 5, phiStart: 0, phiStep: 5, computeCurrents: false, totalSegments: 1 },
    }, 120_000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow("Simulation cancelled");
    expect(SilentWorker.latest?.terminated).toBe(true);
  });

  it("invokes the worker with the exact raw NEC deck", async () => {
    vi.stubGlobal("Worker", AnsweringWorker);
    const engine = new WasmEngine();
    const deck = "CM exact\nCE\nGW 1 1 0 0 0 1 0 0 0.001\nGE -1\nEN\n";
    await engine.runDeck({
      deck,
      parse: { nTheta: 1, nPhi: 1, thetaStart: 0, thetaStep: 5, phiStart: 0, phiStep: 5, computeCurrents: true, totalSegments: 1 },
    });
    expect((SilentWorker.latest as unknown as AnsweringWorker).posted).toEqual(expect.objectContaining({
      type: "run-deck",
      request: expect.objectContaining({ deck }),
    }));
  });
});
