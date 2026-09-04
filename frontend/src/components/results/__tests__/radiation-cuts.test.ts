import { describe, expect, it } from "vitest";
import type { PatternData } from "../../../api/nec";
import { azimuthCutFromPattern, radiationCutSeriesFromPattern } from "../radiation-cuts";

describe("shared radiation-cut extraction", () => {
  it("uses the maximum-gain elevation row and real opposite-bearing elevation samples", () => {
    const pattern: PatternData = {
      theta_start: -90, theta_step: 90, theta_count: 3,
      phi_start: 0, phi_step: 90, phi_count: 4,
      gain_dbi: [
        [-20, -21, -22, -23],
        [4, 8, 2, 1],
        [-4, -8, -12, -16],
      ],
    };
    const cuts = radiationCutSeriesFromPattern(pattern);
    expect(cuts.azimuthElevationDeg).toBe(90);
    expect(cuts.elevationBearingDeg).toBe(180);
    expect(cuts.azimuth[0]!.points.map((point) => point.angleDeg)).toEqual([0, 90, 180, 270]);
    expect(cuts.elevation[0]!.points.map((point) => point.angleDeg)).toEqual([0, 90, 180]);
    expect(cuts.elevation[0]!.points[2]!.gainDbi).toBe(-21);
  });

  it("returns empty series when no valid NEC gains exist", () => {
    const pattern: PatternData = { theta_start: -90, theta_step: 5, theta_count: 1, phi_start: 0, phi_step: 5, phi_count: 1, gain_dbi: [[-999.99]] };
    expect(radiationCutSeriesFromPattern(pattern).azimuth).toEqual([]);
  });

  it("selects the nearest real NEC row for a requested 0–90° azimuth elevation", () => {
    const pattern: PatternData = {
      theta_start: 0, theta_step: 10, theta_count: 10,
      phi_start: 0, phi_step: 90, phi_count: 4,
      gain_dbi: Array.from({ length: 10 }, (_, theta) => Array.from({ length: 4 }, (_, phi) => theta * 10 + phi)),
    };
    const cut = azimuthCutFromPattern(pattern, 32);
    expect(cut?.actualElevationDeg).toBe(30);
    expect(cut?.thetaIndex).toBe(6);
    expect(cut?.points.map((point) => point.angleDeg)).toEqual([0, 90, 180, 270]);
    expect(cut?.points.map((point) => point.gainDbi)).toEqual([60, 61, 62, 63]);
  });

  it("supports compass-coordinate cuts without changing NEC gain samples", () => {
    const pattern: PatternData = {
      theta_start: 0, theta_step: 5, theta_count: 19,
      phi_start: 0, phi_step: 90, phi_count: 4,
      gain_dbi: Array.from({ length: 19 }, (_, theta) => Array.from({ length: 4 }, (_, phi) => theta + phi)),
    };
    const cut = azimuthCutFromPattern(pattern, 5, "compass");
    expect(cut?.actualElevationDeg).toBe(5);
    expect(cut?.points.map((point) => point.angleDeg)).toEqual([0, 90, 180, 270]);
    expect(cut?.points.map((point) => point.gainDbi)).toEqual([18, 17, 20, 19]);
  });

  it("uses the canonical positive-theta row when the duplicated negative row contains the first grid maximum", () => {
    const pattern: PatternData = {
      theta_start: -10, theta_step: 10, theta_count: 3,
      phi_start: 0, phi_step: 90, phi_count: 4,
      gain_dbi: [
        [9, 1, 2, 3],
        [0, 0, 0, 0],
        [2, 3, 9, 1],
      ],
    };
    const cut = azimuthCutFromPattern(pattern);
    expect(cut?.thetaIndex).toBe(2);
    expect(cut?.actualElevationDeg).toBe(80);
    expect(cut?.peakBearingDeg).toBe(180);
    expect(cut?.points.map((point) => point.gainDbi)).toEqual([2, 3, 9, 1]);
  });

  it("rotates bearings for a signed-theta-only imported grid", () => {
    const pattern: PatternData = {
      theta_start: -30, theta_step: 10, theta_count: 3,
      phi_start: 0, phi_step: 90, phi_count: 4,
      gain_dbi: [[8, 1, 2, 3], [7, 1, 2, 3], [6, 1, 2, 3]],
    };
    const cut = azimuthCutFromPattern(pattern, 60);
    expect(cut?.thetaIndex).toBe(0);
    expect(cut?.peakBearingDeg).toBe(180);
    expect(cut?.points.map((point) => point.gainDbi)).toEqual([2, 3, 8, 1]);
  });
});
