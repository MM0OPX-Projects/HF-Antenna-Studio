import { describe, expect, it } from "vitest";
import { buildComparisonSweepRequest, createDipoleSweepPlanForTest, maximumSegmentWavelengthsAtFrequency } from "../service";
import type { ComparisonConditions } from "../types";

const conditions: ComparisonConditions = { frequencyMhz: 14.1, ground: { kind: "perfect" }, referenceImpedanceOhm: 50, azimuthElevationDeg: 10, elevationBearingDeg: 0 };

describe("comparison solver plans", () => {
  it("reuses the validated dipole adapter with the requested exact height and frequency", () => {
    const plan = createDipoleSweepPlanForTest({ id: "dipole", family: "dipole", parameterValue: 5 }, conditions);
    expect(plan.deck).toContain("GW 1 21");
    expect(plan.deck).toMatch(/^GW 1 21 .* 0 5 .* 0 5 0\.001$/m);
    expect(plan.deck).toContain("FR 0 1 0 0 14.1 0");
  });

  it("turns a pattern deck into one batched impedance-only sweep without altering geometry or sources", () => {
    const source = "CM test\nCE\nGW 1 11 -5 0 10 5 0 10 0.001\nGE -1\nGN 1\nEX 0 1 6 0 1 0\nFR 0 1 0 0 14.1 0\nRP 0 19 72 1000 0 0 5 5\nEN\n";
    const request = buildComparisonSweepRequest(source, 11, { mode: "start-stop", startMhz: 14, stopMhz: 14.2, points: 3, referenceOhms: 50 });
    expect(request.deck).toContain("GW 1 11 -5 0 10 5 0 10 0.001");
    expect(request.deck).toContain("EX 0 1 6 0 1 0");
    expect(request.deck).toContain("FR 0 3 0 0 14 0.1");
    expect(request.deck.match(/^RP /gm)).toBeNull();
    expect(request.deck.match(/^XQ 0$/gm)).toHaveLength(1);
    expect(request.deck.trimEnd().endsWith("EN")).toBe(true);
    expect(maximumSegmentWavelengthsAtFrequency(request.deck, 14.2)).toBeCloseTo((10 / 11) / (299_792_458 / 14_200_000), 12);
  });
});
