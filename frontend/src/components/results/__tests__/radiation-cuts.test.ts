import { describe, expect, it } from "vitest";
import type { PatternData } from "../../../api/nec";
import { radiationCutSeriesFromPattern } from "../radiation-cuts";

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
});
