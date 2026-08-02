import { describe, expect, it } from "vitest";
import { createDefaultDipoleModel, type HorizontalDipoleModel } from "../model";
import { adaptDipoleToNec } from "../nec-adapter";
import { assessDipoleModel } from "../validation";
import { wavelengthMetres } from "../units";

function halfWaveModel(overrides: Partial<HorizontalDipoleModel> = {}): HorizontalDipoleModel {
  const frequencyHz = overrides.frequencyHz ?? 14_100_000;
  return {
    ...createDefaultDipoleModel(),
    frequencyHz,
    totalLengthM: wavelengthMetres(frequencyHz) / 2,
    wireDiameterM: 0.002,
    ...overrides,
  };
}

describe("verified dipole NEC adapter", () => {
  it("uses an odd, conservative count with a centre source", () => {
    const adapted = adaptDipoleToNec(halfWaveModel());
    expect(adapted.segmentation.segments).toBe(21);
    expect(adapted.segmentation.centreSegment).toBe(11);
    expect(adapted.model.source.segment).toBe(11);
    expect(adapted.segmentation.segmentLengthWavelengths).toBeLessThanOrEqual(0.025);
  });

  it("preserves SI wire dimensions and radius in one continuous GW card", () => {
    const adapted = adaptDipoleToNec({
      ...halfWaveModel(),
      totalLengthM: 10,
      wireDiameterM: 0.004,
      heightM: 7.5,
    });
    expect(adapted.model.wire.startM).toEqual([-5, 0, 7.5]);
    expect(adapted.model.wire.endM).toEqual([5, 0, 7.5]);
    expect(adapted.model.wire.radiusM).toBe(0.002);
    expect(adapted.deck).toContain(`GW 1 ${adapted.segmentation.segments} -5 0 7.5 5 0 7.5 0.002`);
    expect(adapted.model.source.segment).toBe(adapted.segmentation.centreSegment);
    expect(adapted.deck.match(/^GW /gm)).toHaveLength(1);
  });

  it("serializes the centre feed, frequency, currents, and exact parse grid", () => {
    const adapted = adaptDipoleToNec(halfWaveModel());
    expect(adapted.deck).toContain("PT 0 0 0 0");
    expect(adapted.deck).toContain("EX 0 1 11 0 1 0");
    expect(adapted.deck).toContain("FR 0 1 0 0 14.1 0");
    expect(adapted.deck).toContain("RP 0 19 72 1000 0 0 5 5");
    expect(adapted.deck.endsWith("EN\n")).toBe(true);
    expect(adapted.runRequest.deck).toBe(adapted.deck);
  });

  it("represents perfect, real, and free-space ground distinctly", () => {
    expect(adaptDipoleToNec(halfWaveModel({ ground: { kind: "perfect" } })).deck).toContain("GN 1 0 0 0 0 0");
    expect(adaptDipoleToNec(halfWaveModel({ ground: { kind: "real", conductivitySPerM: 0.005, relativePermittivity: 13 } })).deck).toContain("GN 2 0 0 0 13 0.005");
    const free = adaptDipoleToNec(halfWaveModel({ ground: { kind: "free-space" } }));
    expect(free.deck).toContain("GE 0\nGN -1");
    expect(adaptDipoleToNec(halfWaveModel({ ground: { kind: "perfect" } })).deck).toContain("GE -1\nGN 1");
    expect(free.runRequest.parse.nTheta).toBe(37);
  });

  it("rejects invalid geometry before NEC generation", () => {
    const assessment = assessDipoleModel(halfWaveModel({ wireDiameterM: 2, totalLengthM: 1 }));
    expect(assessment.valid).toBe(false);
    expect(assessment.errors.join(" ")).toMatch(/diameter|thick/i);
    expect(() => adaptDipoleToNec(halfWaveModel({ wireDiameterM: 2, totalLengthM: 1 }))).toThrow();
  });

  it("rejects a wire intersecting ground", () => {
    const assessment = assessDipoleModel(halfWaveModel({ heightM: 0.0005, wireDiameterM: 0.002 }));
    expect(assessment.errors.join(" ")).toMatch(/above the ground/);
  });
});
