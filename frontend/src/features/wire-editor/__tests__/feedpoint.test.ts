import { describe, expect, it } from "vitest";
import { feedpointPlacement, requestedFeedpointPosition, segmentCentreRatio, segmentForFeedRatio } from "../feedpoint";

describe("wire editor feedpoint mapping", () => {
  it("maps requested percentages to real 1-based NEC segment centres", () => {
    expect(segmentForFeedRatio(0, 11)).toBe(1);
    expect(segmentForFeedRatio(0.5, 11)).toBe(6);
    expect(segmentForFeedRatio(1, 11)).toBe(11);
    expect(segmentCentreRatio(1, 11)).toBeCloseTo(0.5 / 11);
    expect(segmentCentreRatio(11, 11)).toBeCloseTo(10.5 / 11);
  });

  it("reports requested and actual position without pretending the endpoint is excitable", () => {
    const source = { wire_tag: 1, segment: 1, voltage_real: 1, voltage_imag: 0, position_ratio: 0 };
    const wire = { tag: 1, segments: 5, x1: 0, y1: 0, z1: 1, x2: 10, y2: 0, z2: 1, radius: 0.0005 };
    const placement = feedpointPlacement(source, wire);
    expect(placement.requestedDistanceM).toBe(0);
    expect(placement.actualDistanceM).toBe(1);
    expect(placement.actualRatio).toBe(0.1);
    expect(requestedFeedpointPosition(source, wire)).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("keeps a ground-mounted vertical feed marker at the radial hub while NEC uses segment one", () => {
    const source = { wire_tag: 1, segment: 1, voltage_real: 1, voltage_imag: 0, position_ratio: 0 };
    const vertical = { tag: 1, segments: 21, x1: 0, y1: 0, z1: 0.001, x2: 0, y2: 0, z2: 10, radius: 0.0005 };
    expect(requestedFeedpointPosition(source, vertical)).toEqual({ x: 0, y: 0, z: 0.001 });
    expect(feedpointPlacement(source, vertical).actualRatio).toBeCloseTo(0.5 / 21);
    expect(segmentForFeedRatio(0, vertical.segments)).toBe(1);
  });
});
