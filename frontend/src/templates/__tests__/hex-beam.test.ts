import { hexBeamTemplate } from "../hex-beam";

const length = (wire: ReturnType<typeof hexBeamTemplate.generateGeometry>[number]) => Math.hypot(wire.x2 - wire.x1, wire.y2 - wire.y1, wire.z2 - wire.z1);
const pointDistance = (a: { x2: number; y2: number; z2: number }, b: { x1: number; y1: number; z1: number }) => Math.hypot(b.x1 - a.x2, b.y1 - a.y2, b.z1 - a.z2);

describe("reusable G3TXQ broadband Hexbeam template", () => {
  const params = { frequency: 14.175, height: 10, wire_diameter: 2 };
  const wires = hexBeamTemplate.generateGeometry(params);

  it("advertises only the published construction-band starting sets", () => {
    expect(hexBeamTemplate.bands).toEqual(["20m", "17m", "15m", "12m", "10m"]);
  });

  it("uses the shared ten-section canonical conductor path", () => {
    expect(wires).toHaveLength(10);
    expect(wires[0]).toMatchObject({ tag: 1, segments: 1, y1: 0, y2: 0 });
    expect(wires[1]!.x2).toBeCloseTo(-wires[3]!.x2, 12);
    expect(wires[1]!.y2).toBeCloseTo(wires[3]!.y2, 12);
    expect(wires[7]!.y1).toBeCloseTo(wires[7]!.y2, 12);
    expect(wires[7]!.y1).toBeLessThan(0);
  });

  it("preserves the published 20 m starting lengths and open tip gaps", () => {
    const drivenHalfM = length(wires[0]!) / 2 + length(wires[1]!) + length(wires[2]!);
    const reflectorM = wires.slice(5).reduce((sum, wire) => sum + length(wire), 0);
    expect(drivenHalfM).toBeCloseTo(218 * 0.0254, 9);
    expect(reflectorM).toBeCloseTo(412 * 0.0254, 9);
    expect(pointDistance(wires[2]!, wires[5]!)).toBeCloseTo(24 * 0.0254, 9);
  });

  it("places the only source on the explicit centre bridge", () => {
    expect(hexBeamTemplate.generateExcitation(params, wires)).toEqual({ wire_tag: 1, segment: 1, voltage_real: 1, voltage_imag: 0 });
    expect(hexBeamTemplate.generateFeedpoints(params, wires)).toEqual([{ position: [0, 0, 10], wireTag: 1 }]);
  });
});
