import { describe, expect, it } from "vitest";
import type { SimulateAdvancedRequest } from "../../../engine/types";
import { buildRadiationPatternRequest } from "../service";

const antenna: SimulateAdvancedRequest = {
  wires: [{ tag: 1, segments: 11, x1: -5, y1: 0, z1: 10, x2: 5, y2: 0, z2: 10, radius: 0.0005 }],
  excitations: [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0 }],
  ground: { type: "perfect" },
  frequency: { start_mhz: 14, stop_mhz: 14.35, steps: 81 },
};

describe("shared radiation-cut solver request", () => {
  it("creates one cancellable full-pattern calculation without currents", () => {
    const request = buildRadiationPatternRequest(antenna, 14.175, 5);
    expect(request.deck).toContain("FR 0 1 0 0 14.175000 0.000000");
    expect(request.deck).toMatch(/^RP 0 37 72 /m);
    expect(request.deck).toContain("PT -1 0 0 0");
    expect(request.parse).toMatchObject({ nTheta: 37, nPhi: 72, computeCurrents: false, totalSegments: 11 });
  });

  it("rejects unsupported frequencies and angular grids", () => {
    expect(() => buildRadiationPatternRequest(antenna, 1, 5)).toThrow("1.8 to 54");
    expect(() => buildRadiationPatternRequest(antenna, 14.1, 3)).toThrow("angular step");
  });
});
