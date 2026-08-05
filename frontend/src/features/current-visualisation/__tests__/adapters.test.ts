import { describe, expect, it } from "vitest";
import { adaptParametricCurrents, adaptPositionedCurrents } from "../adapters";

describe("current visualisation adapters", () => {
  it("maps solver-derived parametric samples to exact conductor positions", () => {
    const data = adaptParametricCurrents([{ id: "driven", startM: { x: -5, y: 2, z: 10 }, endM: { x: 5, y: 2, z: 10 }, diameterM: 0.002 }], [
      { wireId: "driven", tag: 3, segment: 7, fractionAlongWire: 0.25, magnitudeA: 0.5, phaseDeg: 90 },
    ]);
    expect(data.source).toBe("nec-solver");
    expect(data.wires[0]).toMatchObject({ tag: 3, radiusM: 0.001 });
    expect(data.currents[0]).toMatchObject({ tag: 3, segment: 7, x: -2.5, y: 2, z: 10, current_magnitude: 0.5, current_phase_deg: 90 });
    expect(data.currents[0]!.current_real).toBeCloseTo(0, 12);
    expect(data.currents[0]!.current_imag).toBeCloseTo(0.5, 12);
  });

  it("retains parsed XYZ positions and does not synthesize additional samples", () => {
    const points = [
      { wireId: "element-1", tag: 1, segment: 1, positionM: { x: 1, y: 2, z: 3 }, magnitudeA: 0.2, phaseDeg: -45 },
      { wireId: "element-1", tag: 1, segment: 2, positionM: { x: 1, y: 2, z: 4 }, magnitudeA: 0.4, phaseDeg: 30 },
    ];
    const data = adaptPositionedCurrents(points);
    expect(data.currents).toHaveLength(points.length);
    expect(data.currents.map(({ x, y, z }) => ({ x, y, z }))).toEqual(points.map((point) => point.positionM));
    expect(data.currents.map((point) => point.current_magnitude)).toEqual([0.2, 0.4]);
  });

  it("rejects references to missing wires and invalid fractions", () => {
    const wires = [{ id: "wire", startM: { x: 0, y: 0, z: 0 }, endM: { x: 1, y: 0, z: 0 } }];
    expect(() => adaptParametricCurrents(wires, [{ wireId: "missing", tag: 1, segment: 1, fractionAlongWire: 0.5, magnitudeA: 1, phaseDeg: 0 }])).toThrow("unknown wire");
    expect(() => adaptParametricCurrents(wires, [{ wireId: "wire", tag: 1, segment: 1, fractionAlongWire: 1.1, magnitudeA: 1, phaseDeg: 0 }])).toThrow("outside wire");
  });
});
