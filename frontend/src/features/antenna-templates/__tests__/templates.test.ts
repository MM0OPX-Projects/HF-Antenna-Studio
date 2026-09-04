import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "../../../stores/uiStore";
import { LEGACY_CONDUCTOR } from "../../../engine/conductor";
import { readFileSync } from "node:fs";
import { SPEED_OF_LIGHT_M_PER_S } from "../../verified-dipole/model";
import { antennaTemplateDefinitions, getTemplateDefinition } from "../definitions";
import { adaptTemplateToNec } from "../nec-adapter";
import { feedPointCoordinates, generateTemplateModel, hasTemplateErrors, initialTemplateParameters } from "../model";
import { segmentTemplateModel } from "../segmentation";

beforeEach(() => useUIStore.getState().setConductor(LEGACY_CONDUCTOR));

const perfectGround = { kind: "perfect" } as const;

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe("parametric antenna template registry", () => {
  it("contains exactly the eight requested templates with unique IDs", () => {
    expect(antennaTemplateDefinitions.map((item) => item.id)).toEqual([
      "horizontal-dipole", "inverted-v", "sloper", "quarter-wave-vertical",
      "ground-plane-vertical", "full-wave-loop", "delta-loop", "square-loop",
    ]);
    expect(new Set(antennaTemplateDefinitions.map((item) => item.id)).size).toBe(8);
  });

  for (const definition of antennaTemplateDefinitions) {
    describe(definition.name, () => {
      const parameters = initialTemplateParameters(definition);
      const generated = generateTemplateModel(definition, parameters, definition.defaultGround ?? perfectGround, false);

      it("declares complete UI parameter metadata and valid starting values", () => {
        expect(definition.parameters[0]?.key).toBe("frequencyHz");
        expect(definition.presets.length).toBeGreaterThanOrEqual(10);
        for (const parameter of definition.parameters) {
          expect(parameter.slider).toBe(true);
          expect(parameter.minSI).toBeLessThan(parameter.maxSI);
          expect(parameter.stepSI).toBeGreaterThan(0);
          expect(parameters[parameter.key], parameter.key).toBeGreaterThanOrEqual(parameter.minSI);
          expect(parameters[parameter.key], parameter.key).toBeLessThanOrEqual(parameter.maxSI);
        }
        expect(parameters.wireDiameterM).toBe(0.001);
      });

      it("generates finite positive wire geometry and an on-wire feed location", () => {
        expect(hasTemplateErrors(generated), generated.issues.map((issue) => issue.message).join(" ")).toBe(false);
        expect(generated.model.wires.length).toBeGreaterThan(0);
        for (const wire of generated.model.wires) {
          expect(distance(wire.startM, wire.endM)).toBeGreaterThan(0);
          expect(wire.diameterM).toBeGreaterThan(0);
          expect([wire.startM.x, wire.startM.y, wire.startM.z, wire.endM.x, wire.endM.y, wire.endM.z].every(Number.isFinite)).toBe(true);
        }
        const feedWire = generated.model.wires.find((wire) => wire.id === generated.model.feed.wireId);
        expect(feedWire).toBeDefined();
        const feed = feedPointCoordinates(generated.model);
        expect([feed.x, feed.y, feed.z].every(Number.isFinite)).toBe(true);
        expect(generated.model.feed.position).toBeGreaterThanOrEqual(0);
        expect(generated.model.feed.position).toBeLessThanOrEqual(1);
      });

      it("applies the shared segmentation recommendation and maps a legal feed segment", () => {
        const segmented = segmentTemplateModel(generated.model, definition);
        const wavelengthM = SPEED_OF_LIGHT_M_PER_S / generated.model.frequencyHz;
        expect(segmented.issues.filter((issue) => issue.severity === "error")).toEqual([]);
        expect(segmented.totalSegments).toBeGreaterThanOrEqual(generated.model.wires.length * definition.segmentation.minimumSegmentsPerWire);
        for (const wire of segmented.wires) {
          expect(wire.segments % 2).toBe(1);
          expect(wire.segmentLengthM / wavelengthM).toBeLessThanOrEqual(definition.segmentation.maximumSegmentLengthWavelengths + 1e-12);
        }
        const feedWire = segmented.wires.find((wire) => wire.tag === segmented.feed.tag)!;
        expect(segmented.feed.segment).toBeGreaterThanOrEqual(1);
        expect(segmented.feed.segment).toBeLessThanOrEqual(feedWire.segments);
      });

      it("generates one exact NEC deck through the shared adapter", () => {
        const adapted = adaptTemplateToNec(generated.model, definition);
        expect(adapted.deck.match(/^GW /gm)).toHaveLength(generated.model.wires.length);
        expect(adapted.deck.match(/^EX /gm)).toHaveLength(1);
        expect(adapted.deck).toContain("CM Generated dimensions are starting points, not resonance guarantees");
        expect(adapted.deck).toContain(definition.defaultGround?.kind === "real" ? "GN 2" : "GN 1");
        expect(adapted.deck).toContain(`FR 0 1 0 0 ${generated.model.frequencyHz / 1_000_000}`);
        expect(adapted.deck.endsWith("EN\n")).toBe(true);
        expect(adapted.runRequest.deck).toBe(adapted.deck);
        expect(adapted.runRequest.parse.totalSegments).toBe(adapted.segmentation.totalSegments);
        if (definition.id === "quarter-wave-vertical") {
          const comparatorModel = generateTemplateModel(definition, { ...parameters, wireDiameterM: 0.002 }, definition.defaultGround ?? perfectGround, false).model;
          const comparatorDeck = adaptTemplateToNec(comparatorModel, definition).deck.replace(/\r\n/g, "\n");
          const fixture = readFileSync(new URL("../../../../../validation/vertical/template-surface-16radial-20m-real.nec", import.meta.url), "utf8").replace(/\r\n/g, "\n");
          expect(comparatorDeck).toBe(fixture);
        }
      });
    });
  }
});

describe("template RF geometry sanity", () => {
  it("uses documented non-textbook starting ratios", () => {
    for (const id of ["horizontal-dipole", "inverted-v", "sloper"] as const) {
      const definition = getTemplateDefinition(id);
      const parameters = definition.startingParameters(14_100_000);
      const wavelengthM = SPEED_OF_LIGHT_M_PER_S / 14_100_000;
      expect(parameters.totalLengthM).not.toBeCloseTo(wavelengthM * 0.5, 8);
      expect(parameters.totalLengthM! / wavelengthM).toBeGreaterThan(0.45);
      expect(parameters.totalLengthM! / wavelengthM).toBeLessThan(0.49);
    }
    for (const id of ["full-wave-loop", "delta-loop", "square-loop"] as const) {
      const parameters = getTemplateDefinition(id).startingParameters(14_100_000);
      expect(parameters.perimeterM! / (SPEED_OF_LIGHT_M_PER_S / 14_100_000)).toBeCloseTo(1.02, 2);
    }
  });

  it("creates the expected topology and closes every loop", () => {
    const expectedWires = new Map([
      ["horizontal-dipole", 1], ["inverted-v", 2], ["sloper", 1], ["quarter-wave-vertical", 17],
      ["ground-plane-vertical", 5], ["full-wave-loop", 16], ["delta-loop", 3], ["square-loop", 4],
    ]);
    for (const definition of antennaTemplateDefinitions) {
      const model = generateTemplateModel(definition, initialTemplateParameters(definition), definition.defaultGround ?? perfectGround, false).model;
      expect(model.wires).toHaveLength(expectedWires.get(definition.id)!);
      if (definition.id.endsWith("loop")) {
        for (let index = 0; index < model.wires.length; index += 1) {
          expect(distance(model.wires[index]!.endM, model.wires[(index + 1) % model.wires.length]!.startM)).toBeLessThan(1e-10);
        }
      }
    }
  });

  it("preserves the requested full-wave loop perimeter and places its feed at bottom centre", () => {
    const definition = getTemplateDefinition("full-wave-loop");
    const parameters = initialTemplateParameters(definition);
    const model = generateTemplateModel(definition, parameters, perfectGround, false).model;
    const perimeterM = model.wires.reduce((total, wire) => total + distance(wire.startM, wire.endM), 0);
    const feed = feedPointCoordinates(model);
    expect(perimeterM).toBeCloseTo(parameters.perimeterM!, 10);
    expect(feed.x).toBeCloseTo(0, 10);
    expect(feed.z).toBeCloseTo(parameters.bottomHeightM!, 10);
  });

  it("serialises template-defined lumped loads through the common NEC adapter", () => {
    const definition = getTemplateDefinition("horizontal-dipole");
    const generated = generateTemplateModel(definition, initialTemplateParameters(definition), perfectGround, false);
    generated.model.loads = [{
      kind: "series-rlc", wireId: generated.model.wires[0]!.id, position: 0.25,
      resistanceOhm: 12, inductanceH: 1e-6, capacitanceF: 25e-12,
    }];
    const deck = adaptTemplateToNec(generated.model, definition).deck;
    expect(deck).toMatch(/^LD 0 1 \d+ \d+ 12 0\.000001 2\.5e-11$/m);
  });

  it("rejects unsafe cross-parameter geometry rather than silently clamping it", () => {
    const definition = getTemplateDefinition("ground-plane-vertical");
    const parameters = { ...initialTemplateParameters(definition), baseHeightM: 0.25, radialDroopRad: 45 * Math.PI / 180 };
    const generated = generateTemplateModel(definition, parameters, perfectGround, true);
    expect(generated.issues).toEqual(expect.arrayContaining([expect.objectContaining({ severity: "error", code: "ground-clearance" })]));
  });

  it("reports an out-of-range parameter without changing the requested value", () => {
    const definition = getTemplateDefinition("horizontal-dipole");
    const parameters = { ...initialTemplateParameters(definition), totalLengthM: 300 };
    const generated = generateTemplateModel(definition, parameters, perfectGround, true);
    expect(generated.model.parametersSI.totalLengthM).toBe(300);
    expect(generated.issues).toContainEqual(expect.objectContaining({ severity: "error", code: "parameter-totalLengthM-range" }));
  });

  it("keeps the near-surface vertical above the NEC interface over real ground", () => {
    for (const definition of antennaTemplateDefinitions) {
      const model = generateTemplateModel(definition, initialTemplateParameters(definition), definition.defaultGround ?? perfectGround, false).model;
      const deck = adaptTemplateToNec(model, definition).deck;
      expect(deck).toContain("GE -1");
      if (definition.id === "quarter-wave-vertical") expect(deck).toContain("GN 2 0 0 0 13 0.005");
    }
  });

  it("generates explicit connected ground radials and rejects a perfect-ground substitution", () => {
    const definition = getTemplateDefinition("quarter-wave-vertical");
    const parameters = initialTemplateParameters(definition);
    const generated = generateTemplateModel(definition, parameters, definition.defaultGround!, false);
    expect(generated.model.wires.filter((wire) => wire.id.startsWith("radial-"))).toHaveLength(16);
    expect(generated.model.wires.every((wire) => wire.startM.z === parameters.surfaceClearanceM)).toBe(true);
    expect(generated.issues).toContainEqual(expect.objectContaining({ code: "surface-radial-nec2-approximation", severity: "warning" }));
    expect(generateTemplateModel(definition, parameters, perfectGround, false).issues).toContainEqual(expect.objectContaining({ code: "surface-radial-real-ground", severity: "error" }));
  });
});
