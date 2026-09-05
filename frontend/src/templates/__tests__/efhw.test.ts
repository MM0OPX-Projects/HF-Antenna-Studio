import { describe, expect, it } from "vitest";
import { efhwTemplate } from "../efhw";

function params(overrides: Record<string, number> = {}) {
  const base = Object.fromEntries(efhwTemplate.parameters.map((p) => [p.key, p.defaultValue]));
  return { ...base, ...overrides };
}

function lengthOf(w: { x1:number; y1:number; z1:number; x2:number; y2:number; z2:number }) {
  return Math.hypot(w.x2-w.x1, w.y2-w.y1, w.z2-w.z1);
}

describe("EFHW parametric orientations", () => {
  it("does not draw an unexplained counterpoise leg by default", () => {
    expect(efhwTemplate.generateGeometry(params()).some((wire) => wire.tag === 99)).toBe(false);
    expect(efhwTemplate.validateParameters?.(params())).toEqual(expect.arrayContaining([expect.objectContaining({ code: "efhw-no-return-path", severity: "warning" })]));
  });

  it.each([
    ["horizontal", 0], ["sloper", 1], ["inverted-v", 2], ["vertical", 3],
  ])("generates a connected %s model with both feed ends", (_name, orientation) => {
    for (const feed_end of [0, 1]) {
      const p = params({ orientation, feed_end, counterpoise_enabled: 1 });
      const wires = efhwTemplate.generateGeometry(p);
      const radiator = wires.filter((w) => w.tag !== 99);
      const source = efhwTemplate.generateExcitation(p, wires);
      const excitation = Array.isArray(source) ? source[0]! : source;
      const feed = efhwTemplate.generateFeedpoints(p, wires)[0]!;
      expect(radiator.length).toBe(orientation === 2 ? 2 : 1);
      expect(radiator.every((w) => lengthOf(w) > 0 && w.segments >= 3)).toBe(true);
      const lastRadiator = radiator[radiator.length - 1]!;
      expect(excitation.wire_tag).toBe(feed_end === 0 ? radiator[0]!.tag : lastRadiator.tag);
      expect(excitation.segment).toBe(feed_end === 0 ? 1 : lastRadiator.segments);
      expect(feed.wireTag).toBe(excitation.wire_tag);
      expect(wires.some((w) => w.tag === 99)).toBe(true);
      const counterpoise = wires.find((w) => w.tag === 99)!;
      expect(radiator.some((wire) => Math.abs((wire.x2-wire.x1)*(counterpoise.y2-counterpoise.y1)-(wire.y2-wire.y1)*(counterpoise.x2-counterpoise.x1)) < 1e-10 && orientation === 0)).toBe(false);
    }
  });

  it("keeps the requested manual radiator length", () => {
    const p = params({ length_mode: 1, total_length: 18.25, counterpoise_enabled: 0 });
    const wires = efhwTemplate.generateGeometry(p);
    const total = wires.reduce((sum, wire) => sum + lengthOf(wire), 0);
    expect(total).toBeCloseTo(18.25, 6);
  });

  it("rotates a horizontal model with bearing", () => {
    const p = params({ orientation: 0, bearing: 0, counterpoise_enabled: 0 });
    const wire = efhwTemplate.generateGeometry(p)[0]!;
    expect(Math.abs(wire.y2 - wire.y1)).toBeLessThan(1e-8);
    expect(wire.x2).toBeGreaterThan(wire.x1);
  });

  it("places inverted-V terminals at the requested heights", () => {
    const p = params({ orientation: 2, inverted_v_mode: 1, apex_height: 14, feed_height: 4, far_end_height: 6, counterpoise_enabled: 0 });
    const wires = efhwTemplate.generateGeometry(p);
    expect(wires[0]!.z1).toBeCloseTo(4, 6);
    expect(wires[0]!.z2).toBeCloseTo(14, 6);
    expect(wires[1]!.z1).toBeCloseTo(14, 6);
    expect(wires[1]!.z2).toBeCloseTo(6, 6);
  });

  it("generates a symmetric, coplanar classic inverted-V with the true requested angle", () => {
    const p = params({ orientation: 2, inverted_v_mode: 0, included_angle: 120, bearing: 37, counterpoise_enabled: 0 });
    const [a,b] = efhwTemplate.generateGeometry(p);
    const va=[a!.x1-a!.x2,a!.y1-a!.y2,a!.z1-a!.z2];
    const vb=[b!.x2-b!.x1,b!.y2-b!.y1,b!.z2-b!.z1];
    const angle=Math.acos(va.reduce((sum,n,i)=>sum+n*vb[i]!,0)/(lengthOf(a!)*lengthOf(b!)))*180/Math.PI;
    expect(lengthOf(a!)).toBeCloseTo(lengthOf(b!),8);
    expect(a!.z1).toBeCloseTo(b!.z2,8);
    expect(angle).toBeCloseTo(120,8);
    expect((a!.x1-a!.x2)*(b!.y2-b!.y1)-(a!.y1-a!.y2)*(b!.x2-b!.x1)).toBeCloseTo(0,8);
  });

  it("reports impossible arrangements and missing return paths", () => {
    expect(efhwTemplate.validateParameters?.(params({ orientation: 1, length_mode: 1, total_length: 5, feed_height: 20, far_end_height: 1 }))).toEqual(expect.arrayContaining([expect.objectContaining({ code: "efhw-sloper-height-span", severity: "error" })]));
    expect(efhwTemplate.validateParameters?.(params({ counterpoise_enabled: 0 }))).toEqual(expect.arrayContaining([expect.objectContaining({ code: "efhw-no-return-path", severity: "warning" })]));
  });
});
