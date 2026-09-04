import { describe, expect, it } from "vitest";
import { patternOriginForGeometry } from "../pattern-origin";

const wire = { tag: 1, segments: 11, x1: 2, y1: 4, z1: 1.5, x2: 2, y2: 4, z2: 11.5, radius: 0.0005 };

describe("3D radiation pattern origin", () => {
  it("anchors a vertical pattern to its lowest physical point", () => {
    expect(patternOriginForGeometry([wire])).toEqual([2, 1.5, -4]);
  });

  it("does not move when the source is at the centre", () => {
    expect(patternOriginForGeometry([wire])).not.toEqual([2, 6.5, -4]);
  });

  it("averages the lowest points of a multi-wire model", () => {
    const second = { ...wire, tag: 2, x1: 6, x2: 6 };
    expect(patternOriginForGeometry([wire, second])).toEqual([4, 1.5, -4]);
  });
});
