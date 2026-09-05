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
});
