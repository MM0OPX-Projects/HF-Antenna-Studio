import { describe, expect, it } from "vitest";
import type { FrequencyResult } from "../../../api/nec";
import { centerSpanToStartStop, deriveAnalyserPoint, nearestPointIndex, startStopToCenterSpan, validateSweepConfig } from "../math";

function result(real: number, imag: number, frequency_mhz = 14.1): FrequencyResult {
  return { frequency_mhz, impedance: { real, imag }, swr_50: 999, gain_max_dbi: -999.99, gain_max_theta: 0, gain_max_phi: 0, front_to_back_db: null, beamwidth_e_deg: null, beamwidth_h_deg: null, efficiency_percent: null, pattern: null, currents: null };
}

describe("frequency analyser calculations", () => {
  it("derives a perfect match without relying on solver SWR", () => {
    const point = deriveAnalyserPoint(result(50, 0), 50);
    expect(point.impedanceMagnitudeOhms).toBe(50);
    expect(point.reflectionMagnitude).toBe(0);
    expect(point.swr).toBe(1);
    expect(point.returnLossDb).toBe(Number.POSITIVE_INFINITY);
  });

  it("derives reflection coefficient, SWR and return loss for a real load", () => {
    const point = deriveAnalyserPoint(result(100, 0), 50);
    expect(point.reflectionReal).toBeCloseTo(1 / 3, 12);
    expect(point.reflectionImag).toBe(0);
    expect(point.swr).toBeCloseTo(2, 12);
    expect(point.returnLossDb).toBeCloseTo(9.542425, 5);
  });

  it("retains complex reflection phase and impedance magnitude", () => {
    const point = deriveAnalyserPoint(result(50, 50), 50);
    expect(point.impedanceMagnitudeOhms).toBeCloseTo(Math.sqrt(5000), 12);
    expect(point.reflectionReal).toBeCloseTo(0.2, 12);
    expect(point.reflectionImag).toBeCloseTo(0.4, 12);
    expect(point.reflectionMagnitude).toBeCloseTo(Math.sqrt(0.2), 12);
    expect(point.reflectionPhaseDeg).toBeCloseTo(63.434949, 5);
    expect(point.swr).toBeCloseTo(2.618034, 5);
  });

  it("reports an infinite SWR for a zero-ohm load", () => {
    const point = deriveAnalyserPoint(result(0, 0), 50);
    expect(point.reflectionReal).toBe(-1);
    expect(point.reflectionMagnitude).toBe(1);
    expect(point.swr).toBe(Number.POSITIVE_INFINITY);
    expect(point.returnLossDb).toBe(-0);
  });

  it("does not hide the singular reflection coefficient at Z = -Z0", () => {
    const point = deriveAnalyserPoint(result(-50, 0), 50);
    expect(point.reflectionMagnitude).toBe(Number.POSITIVE_INFINITY);
    expect(point.swr).toBe(Number.POSITIVE_INFINITY);
    expect(point.returnLossDb).toBe(Number.NEGATIVE_INFINITY);
  });

  it("round-trips start/stop and centre/span", () => {
    expect(startStopToCenterSpan(14, 14.35)).toEqual({ centerMhz: 14.175, spanMhz: 0.34999999999999964 });
    const range = centerSpanToStartStop(14.175, 0.35);
    expect(range.startMhz).toBeCloseTo(14, 12);
    expect(range.stopMhz).toBeCloseTo(14.35, 12);
  });

  it("validates HF limits, point count, ordering and reference impedance", () => {
    expect(validateSweepConfig({ mode: "start-stop", startMhz: 14, stopMhz: 14.35, points: 81, referenceOhms: 50 })).toEqual([]);
    const errors = validateSweepConfig({ mode: "start-stop", startMhz: 1, stopMhz: 55, points: 2, referenceOhms: 0 });
    expect(errors).toHaveLength(4);
    expect(validateSweepConfig({ mode: "start-stop", startMhz: 14.35, stopMhz: 14, points: 81, referenceOhms: 50 })).toContain("Stop frequency must be greater than start frequency.");
  });

  it("selects the nearest solved point", () => {
    const points = [result(50, 0, 14), result(50, 0, 14.1), result(50, 0, 14.2)].map((item) => deriveAnalyserPoint(item, 50));
    expect(nearestPointIndex(points, 14.16)).toBe(2);
    expect(nearestPointIndex([], 14.1)).toBe(-1);
  });
});
