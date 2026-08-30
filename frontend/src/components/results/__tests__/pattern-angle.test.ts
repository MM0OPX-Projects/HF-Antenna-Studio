import { describe, expect, it } from "vitest";
import { clampElevationAngle, gainAtAngle, gainAtCircularAngle, withElevationHorizonFloorPoints, type GainPatternPoint } from "../pattern-angle";

const points: GainPatternPoint[] = [
  { angleDeg: 0, gainDbi: -8, normalizedDb: -10 },
  { angleDeg: 5, gainDbi: -1, normalizedDb: -3 },
  { angleDeg: 10, gainDbi: 2, normalizedDb: 0 },
];

describe("gainAtAngle", () => {
  it("returns an unchanged exact NEC sample", () => {
    expect(gainAtAngle(points, 5)).toEqual({
      requestedAngleDeg: 5,
      gainDbi: -1,
      normalizedDb: -3,
      peakGainDbi: 2,
      method: "exact",
      lowerAngleDeg: 5,
      upperAngleDeg: 5,
    });
  });

  it("linearly interpolates decibels and exposes the bounding samples", () => {
    expect(gainAtAngle(points, 7.5)).toEqual({
      requestedAngleDeg: 7.5,
      gainDbi: 0.5,
      normalizedDb: -1.5,
      peakGainDbi: 2,
      method: "interpolated",
      lowerAngleDeg: 5,
      upperAngleDeg: 10,
    });
  });

  it("does not extrapolate or use invalid NEC sentinel values", () => {
    expect(gainAtAngle(points, -1)).toBeNull();
    expect(gainAtAngle(points, 181)).toBeNull();
    expect(gainAtAngle([{ angleDeg: 5, gainDbi: -999.99, normalizedDb: -999.99 }], 5)).toBeNull();
    expect(gainAtAngle([
      points[0]!,
      { angleDeg: 5, gainDbi: -999.99, normalizedDb: -999.99 },
      points[2]!,
    ], 7.5)).toBeNull();
  });

  it("sorts samples and ignores duplicate angles", () => {
    expect(gainAtAngle([points[2]!, points[0]!, points[1]!, { ...points[1]!, gainDbi: 99 }], 5)?.gainDbi).toBe(-1);
  });

  it("derives the cut peak from absolute gain rather than a floor-clamped relative value", () => {
    const reading = gainAtAngle([
      { angleDeg: 0, gainDbi: 10, normalizedDb: 0 },
      { angleDeg: 5, gainDbi: -45, normalizedDb: -40 },
    ], 5);
    expect(reading?.peakGainDbi).toBe(10);
    expect(reading && reading.peakGainDbi - reading.gainDbi).toBe(55);
  });
});

describe("clampElevationAngle", () => {
  it("keeps cursor angles within the complete elevation plane", () => {
    expect(clampElevationAngle(-2)).toBe(0);
    expect(clampElevationAngle(5)).toBe(5);
    expect(clampElevationAngle(95)).toBe(95);
    expect(clampElevationAngle(181)).toBe(180);
  });
});

describe("gainAtCircularAngle", () => {
  it("interpolates continuously across the 360/0-degree seam", () => {
    const circular = [
      { angleDeg: 0, gainDbi: 10, normalizedDb: 0 },
      { angleDeg: 90, gainDbi: 6, normalizedDb: -4 },
      { angleDeg: 180, gainDbi: 4, normalizedDb: -6 },
      { angleDeg: 270, gainDbi: 2, normalizedDb: -8 },
    ];
    expect(gainAtCircularAngle(circular, 315)).toMatchObject({
      gainDbi: 6,
      normalizedDb: -4,
      method: "interpolated",
      lowerAngleDeg: 270,
      upperAngleDeg: 360,
    });
    expect(gainAtCircularAngle(circular, 360)?.gainDbi).toBe(10);
  });

  it("does not interpolate through an invalid NEC null", () => {
    expect(gainAtCircularAngle([
      { angleDeg: 0, gainDbi: 10, normalizedDb: 0 },
      { angleDeg: 270, gainDbi: -999.99, normalizedDb: -40 },
    ], 315)).toBeNull();
  });
});

describe("withElevationHorizonFloorPoints", () => {
  it("completes one omitted NEC-null grid interval at both horizons for plotting", () => {
    const completed = withElevationHorizonFloorPoints([
      { angleDeg: 5, gainDbi: -12, normalizedDb: -14 },
      { angleDeg: 10, gainDbi: -5, normalizedDb: -7 },
      { angleDeg: 175, gainDbi: -13, normalizedDb: -15 },
    ]);
    expect(completed.map((point) => point.angleDeg)).toEqual([0, 5, 10, 175, 180]);
    expect(completed[0]).toEqual({ angleDeg: 0, gainDbi: -999.99, normalizedDb: -40 });
    expect(completed[completed.length - 1]).toEqual({ angleDeg: 180, gainDbi: -999.99, normalizedDb: -40 });
    expect(gainAtAngle(completed, 0)).toBeNull();
    expect(gainAtAngle(completed, 2.5)).toBeNull();
  });

  it("preserves real horizon samples and does not bridge a larger missing boundary", () => {
    const realHorizons = [
      { angleDeg: 0, gainDbi: -8, normalizedDb: -10 },
      { angleDeg: 10, gainDbi: 2, normalizedDb: 0 },
      { angleDeg: 180, gainDbi: -9, normalizedDb: -11 },
    ];
    expect(withElevationHorizonFloorPoints(realHorizons)).toEqual(realHorizons);
    expect(withElevationHorizonFloorPoints([
      { angleDeg: 20, gainDbi: -8, normalizedDb: -10 },
      { angleDeg: 25, gainDbi: -4, normalizedDb: -6 },
      { angleDeg: 30, gainDbi: 2, normalizedDb: 0 },
    ]).map((point) => point.angleDeg)).toEqual([20, 25, 30]);
  });
});
