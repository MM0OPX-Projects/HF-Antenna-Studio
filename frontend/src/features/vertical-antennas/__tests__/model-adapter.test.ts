import { describe, expect, it } from "vitest";
import { adaptVerticalToNec, segmentVerticalWires } from "../nec-adapter";
import { buildVerticalWires, generateVerticalModel, regenerateVerticalStartingDimensions, startingVerticalModel, switchVerticalConfiguration, validateVerticalModel, wavelengthM } from "../model";
import { nec2UserGuideExample10Equivalent } from "../validation-cases";

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe("vertical antenna model", () => {
  it("keeps ideal, explicit-radial, and simplified-screen configurations distinct", () => {
    const ideal = startingVerticalModel(7_100_000, "ground-mounted-ideal");
    const explicit = startingVerticalModel(14_100_000, "elevated-explicit-radials");
    const screen = startingVerticalModel(28_500_000, "nec-radial-screen-approximation");
    expect(ideal).toMatchObject({ baseHeightM: 0, radials: { representation: "none", count: 0 }, ground: { kind: "perfect" } });
    expect(explicit).toMatchObject({ radials: { representation: "explicit-wires", count: 4 }, ground: { kind: "perfect" } });
    expect(screen).toMatchObject({ baseHeightM: 0, radials: { representation: "nec-ground-screen", count: 16 }, ground: { kind: "reflection-coefficient" } });
  });

  it("generates the requested number, length, angle, and shared feed junction for explicit radials", () => {
    const initial = startingVerticalModel(14_100_000, "elevated-explicit-radials");
    const model = { ...initial, radials: { ...initial.radials, count: 8, lengthM: 5.2, droopAngleRad: Math.PI / 6 } };
    const wires = buildVerticalWires(model);
    expect(wires).toHaveLength(9);
    for (const radial of wires.slice(1)) {
      expect(distance(radial.startM, wires[0]!.startM)).toBeLessThan(1e-12);
      expect(distance(radial.startM, radial.endM)).toBeCloseTo(5.2, 10);
      expect(radial.startM.z - radial.endM.z).toBeCloseTo(2.6, 10);
    }
    const azimuths = wires.slice(1).map((radial) => Math.atan2(radial.endM.y, radial.endM.x));
    expect(new Set(azimuths.map((angle) => angle.toFixed(10))).size).toBe(8);
  });

  it("regenerates wavelength-scaled starting dimensions at 40, 20, and 10 metres", () => {
    let model = startingVerticalModel(7_100_000, "elevated-explicit-radials");
    for (const frequencyHz of [7_100_000, 14_100_000, 28_500_000]) {
      model = regenerateVerticalStartingDimensions(model, frequencyHz);
      const lambda = wavelengthM(frequencyHz);
      expect(model.radiatorLengthM / lambda).toBeCloseTo(0.2375, 12);
      expect(model.radials.lengthM / lambda).toBeCloseTo(0.25, 12);
      expect(model.baseHeightM / lambda).toBeCloseTo(0.12, 12);
      expect(model.provenance.manualDimensions).toBe(false);
    }
  });

  it("rejects real ground on a touching ideal monopole", () => {
    const ideal = startingVerticalModel(14_100_000, "ground-mounted-ideal");
    const invalid = { ...ideal, ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 } as const };
    expect(validateVerticalModel(invalid)).toContainEqual(expect.objectContaining({ severity: "error", code: "ideal-requires-perfect" }));
  });

  it("rejects explicit radial penetration and warns on close Sommerfeld/Norton clearance", () => {
    const initial = startingVerticalModel(14_100_000, "elevated-explicit-radials");
    const penetrating = { ...initial, baseHeightM: 0.2, radials: { ...initial.radials, lengthM: 5, droopAngleRad: Math.PI / 4 } };
    expect(validateVerticalModel(penetrating)).toContainEqual(expect.objectContaining({ severity: "error", code: "radial-ground-intersection" }));
    const close = { ...initial, baseHeightM: 0.01, radials: { ...initial.radials, lengthM: 1, droopAngleRad: 0 }, ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 } as const };
    expect(validateVerticalModel(close)).toContainEqual(expect.objectContaining({ severity: "warning", code: "sommerfeld-clearance" }));
  });

  it("configuration switching resets incompatible ground/radial semantics", () => {
    const explicit = startingVerticalModel(14_100_000, "elevated-explicit-radials");
    const screen = switchVerticalConfiguration(explicit, "nec-radial-screen-approximation");
    expect(screen.radials.representation).toBe("nec-ground-screen");
    expect(screen.ground.kind).toBe("reflection-coefficient");
    expect(screen.baseHeightM).toBe(0);
  });

  it("represents the NEC-2 User's Guide Example 10 dimensions as six explicit radial wires", () => {
    const model = nec2UserGuideExample10Equivalent();
    const generated = generateVerticalModel(model);
    expect(generated.wires).toHaveLength(7);
    expect(model).toMatchObject({ frequencyHz: 10_000_000, radiatorLengthM: 7.5, baseHeightM: 0.01, radials: { count: 6, lengthM: 30 }, ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.001, relativePermittivity: 4 } });
    expect(generated.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(adaptVerticalToNec(generated).deck).toContain("GN 2 0 0 0 4 0.001");
  });

  it("rejects combining the simplified radial screen with Sommerfeld/Norton", () => {
    const screen = startingVerticalModel(14_100_000, "nec-radial-screen-approximation");
    const invalid = { ...screen, ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 } as const };
    expect(validateVerticalModel(invalid)).toContainEqual(expect.objectContaining({ severity: "error", code: "screen-requires-rca-ground" }));
  });
});

describe("vertical NEC adapter", () => {
  it("emits the ideal perfect-ground contact model", () => {
    const adapted = adaptVerticalToNec(generateVerticalModel(startingVerticalModel(14_100_000, "ground-mounted-ideal")));
    expect(adapted.deck.match(/^GW /gm)).toHaveLength(1);
    expect(adapted.deck).toContain("GE 1\nGN 1");
    expect(adapted.deck).toContain("EX 0 1 1 0 1 0");
    expect(adapted.deck).toContain("RP 0 19 72 1000");
  });

  it("emits every elevated radial as a wire over Sommerfeld/Norton ground", () => {
    const initial = startingVerticalModel(7_100_000, "elevated-explicit-radials");
    const model = { ...initial, radials: { ...initial.radials, count: 8 }, ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 } as const };
    const generated = generateVerticalModel(model);
    const adapted = adaptVerticalToNec(generated);
    expect(adapted.deck.match(/^GW /gm)).toHaveLength(9);
    expect(adapted.deck).toContain("GE -1\nGN 2 0 0 0 13 0.005");
    expect(adapted.deck).toContain("RP 0 19 72 1000");
    expect(adapted.runRequest.deck).toBe(adapted.deck);
  });

  it("uses NEC GN/RP radial-screen fields without pretending they are wire geometry", () => {
    const generated = generateVerticalModel(startingVerticalModel(28_500_000, "nec-radial-screen-approximation"));
    const adapted = adaptVerticalToNec(generated);
    expect(generated.wires).toHaveLength(1);
    expect(adapted.deck.match(/^GW /gm)).toHaveLength(1);
    expect(adapted.deck).toMatch(/^GN 0 16 0 0 13 0\.005 [\d.]+ 0\.001$/m);
    expect(adapted.deck).toContain("RP 4 19 72 1000");
    expect(adapted.issues).toContainEqual(expect.objectContaining({ code: "screen-simplification", severity: "warning" }));
  });

  it("uses bounded odd segmentation no longer than 0.02 wavelength", () => {
    for (const configuration of ["ground-mounted-ideal", "elevated-explicit-radials", "nec-radial-screen-approximation"] as const) {
      const model = startingVerticalModel(7_100_000, configuration);
      const wires = buildVerticalWires(model);
      const segmentation = segmentVerticalWires(model, wires);
      expect(segmentation.issues.filter((issue) => issue.severity === "error")).toEqual([]);
      for (const wire of segmentation.wires) {
        expect(wire.segments % 2).toBe(1);
        expect(wire.segmentLengthM / wavelengthM(model.frequencyHz)).toBeLessThanOrEqual(0.02 + 1e-12);
      }
      expect(segmentation.feed).toEqual({ tag: 1, segment: 1 });
    }
  });
});
