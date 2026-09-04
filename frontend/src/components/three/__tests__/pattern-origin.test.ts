import { describe, expect, it } from "vitest";
import { patternOriginForExcitations } from "../pattern-origin";

const wire = { tag: 1, segments: 11, x1: 2, y1: 4, z1: 1.5, x2: 2, y2: 4, z2: 11.5, radius: 0.0005 };

describe("3D radiation pattern origin", () => {
  it("anchors an end-fed pattern to the requested connection", () => {
    expect(patternOriginForExcitations([wire], [{ wire_tag: 1, segment: 1, voltage_real: 1, voltage_imag: 0, position_ratio: 0 }])).toEqual([2, 1.5, -4]);
  });

  it("anchors a centre-fed pattern to its requested position", () => {
    expect(patternOriginForExcitations([wire], [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0, position_ratio: 0.5 }])).toEqual([2, 6.5, -4]);
  });

  it("uses the feed centroid for a combined multi-source pattern", () => {
    const second = { ...wire, tag: 2, x1: 6, x2: 6 };
    expect(patternOriginForExcitations([wire, second], [
      { wire_tag: 1, segment: 1, voltage_real: 1, voltage_imag: 0, position_ratio: 0 },
      { wire_tag: 2, segment: 11, voltage_real: 1, voltage_imag: 0, position_ratio: 1 },
    ])).toEqual([4, 6.5, -4]);
  });
});
