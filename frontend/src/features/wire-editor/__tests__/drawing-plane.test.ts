import { describe, expect, it } from "vitest";
import { endpointFromLengthAngle, expandPoint, projectPoint, type DrawingPlane } from "../drawing-plane";

describe("fixed 2D drawing planes", () => {
  it.each([
    ["xz", 7, { x: 2, y: 7, z: 3 }],
    ["yz", 7, { x: 7, y: 2, z: 3 }],
    ["xy", 7, { x: 2, y: 3, z: 7 }],
  ] as const)("expands %s coordinates while preserving its fixed axis", (plane, fixed, expected) => {
    expect(expandPoint({ u: 2, v: 3 }, plane, fixed)).toEqual(expected);
  });

  it.each([
    ["xz", { u: 2, v: 4 }],
    ["yz", { u: 3, v: 4 }],
    ["xy", { u: 2, v: 3 }],
  ] as const)("projects a three-dimensional point onto %s", (plane, expected) => {
    expect(projectPoint({ x: 2, y: 3, z: 4 }, plane as DrawingPlane)).toEqual(expected);
  });

  it.each([
    ["xz", 0, { u: 7, v: 3 }],
    ["yz", 90, { u: 2, v: 8 }],
    ["xy", 180, { u: -3, v: 3 }],
  ] as const)("applies exact length and angle in the %s drawing plane", (_plane, angle, expected) => {
    const point = endpointFromLengthAngle({ u: 2, v: 3 }, 5, angle);
    expect(point.u).toBeCloseTo(expected.u, 10);
    expect(point.v).toBeCloseTo(expected.v, 10);
  });
});
