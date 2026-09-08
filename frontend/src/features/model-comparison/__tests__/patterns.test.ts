import { describe, expect, it } from "vitest";
import type { PatternData } from "../../../api/nec";
import { circularPatternMetrics, extractComparisonCuts, strongestComparisonBearing } from "../patterns";

describe("compatible pattern cuts", () => {
  it("extracts a common elevation and compass-bearing plane from the NEC grid", () => {
    const pattern: PatternData = { theta_start: 0, theta_step: 10, theta_count: 10, phi_start: 0, phi_step: 45, phi_count: 8, gain_dbi: Array.from({ length: 10 }, (_, theta) => Array.from({ length: 8 }, (_, phi) => theta * 10 + phi)) };
    const cuts = extractComparisonCuts(pattern, 10, 0);
    expect(cuts.actualAzimuthElevationDeg).toBe(10);
    expect(cuts.actualElevationBearingDeg).toBe(0);
    expect(cuts.azimuth).toHaveLength(8);
    expect(cuts.azimuth.map((point) => point.angleDeg)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(cuts.elevation.map((point) => point.angleDeg)).toEqual(Array.from({ length: 19 }, (_, index) => index * 10));
    expect(cuts.elevation.map((point) => point.gainDbi)).toEqual([96, 86, 76, 66, 56, 46, 36, 26, 16, 6, 12, 22, 32, 42, 52, 62, 72, 82, 92]);
  });

  it("finds the strongest solved compass bearing using the Wire Editor compass convention", () => {
    const pattern: PatternData = { theta_start: 0, theta_step: 10, theta_count: 2, phi_start: 0, phi_step: 90, phi_count: 4, gain_dbi: [[1, 2, 3, 4], [5, 6, 7, 11]] };
    // NEC phi 270° is north (0°) in the shared Wire Editor compass convention.
    expect(strongestComparisonBearing(pattern)).toBe(0);
  });

  it("derives axial front-to-back and interpolated half-power beamwidth", () => {
    const points = [10, 8, 4, 1, 0, 1, 4, 8].map((gainDbi, index) => ({ angleDeg: index * 45, gainDbi, normalizedDb: gainDbi - 10 }));
    const metrics = circularPatternMetrics(points);
    expect(metrics.frontToBackDb).toBe(10);
    expect(metrics.beamwidthDeg).toBeCloseTo(112.5, 1);
  });

  it("reports a 360-degree half-power width for an omnidirectional cut", () => {
    const points = Array.from({ length: 8 }, (_, index) => ({ angleDeg: index * 45, gainDbi: 5, normalizedDb: 0 }));
    expect(circularPatternMetrics(points)).toEqual({ frontToBackDb: 0, beamwidthDeg: 360 });
  });
});
