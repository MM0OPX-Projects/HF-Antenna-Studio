import { describe, expect, it } from "vitest";
import { connectedPolylinePath, polylineDistanceForRatio, polylinePositionAtDistance } from "../polyline";

const wires = [
  { tag: 1, segments: 3, x1: 0, y1: 0, z1: 0, x2: 2, y2: 0, z2: 0, radius: 0.0005 },
  { tag: 2, segments: 3, x1: 2, y1: 0, z1: 0, x2: 2, y2: 3, z2: 0, radius: 0.0005 },
  { tag: 3, segments: 3, x1: 2, y1: 3, z1: 0, x2: 6, y2: 3, z2: 0, radius: 0.0005 },
];
const junctions = [
  { id: 1, endpoints: [{ wireTag: 1, endpoint: "end" as const }, { wireTag: 2, endpoint: "start" as const }] },
  { id: 2, endpoints: [{ wireTag: 2, endpoint: "end" as const }, { wireTag: 3, endpoint: "start" as const }] },
];

describe("connected polyline feed positioning", () => {
  it("orders a connected path and maps whole-path distance to the correct wire", () => {
    const path = connectedPolylinePath(wires, junctions, 2);
    expect(path).toMatchObject({ totalLengthM: 9, branched: false, closed: false });
    expect(path.legs.map((leg) => leg.wireTag)).toEqual([1, 2, 3]);
    expect(polylinePositionAtDistance(path, 3.5)).toEqual({ wireTag: 2, wireRatio: 0.5 });
    expect(polylineDistanceForRatio(path, 3, 0.25)).toBe(6);
  });

  it("reverses the local ratio when a wire is traversed from its end", () => {
    const reversed = [wires[0]!, { ...wires[1]!, x1: 2, y1: 3, x2: 2, y2: 0 }];
    const path = connectedPolylinePath(reversed, [{ id: 1, endpoints: [{ wireTag: 1, endpoint: "end" }, { wireTag: 2, endpoint: "end" }] }], 1);
    expect(path.legs[1]).toMatchObject({ wireTag: 2, reversed: true });
    expect(polylinePositionAtDistance(path, 3.5)).toEqual({ wireTag: 2, wireRatio: 0.5 });
  });

  it("refuses to invent a unique traversal through a branch", () => {
    const branch = connectedPolylinePath(wires, [{ id: 1, endpoints: [
      { wireTag: 1, endpoint: "end" }, { wireTag: 2, endpoint: "start" }, { wireTag: 3, endpoint: "start" },
    ] }], 1);
    expect(branch.branched).toBe(true);
    expect(polylinePositionAtDistance(branch, 1)).toBeNull();
  });
});
