import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "../../../stores/uiStore";
import { LEGACY_CONDUCTOR } from "../../../engine/conductor";
import { adaptLoopBeamToNec, segmentLoopBeamWires } from "../nec-adapter";
import { generateLoopBeamModel, loopBeamWavelengthM, multibandLongestBandExtraSpacingM, multibandStackSpacingM, resizeCubicalQuad, startingCubicalQuadModel, startingDeltaLoopModel, startingDiamondLoopModel, startingHexbeamModel, startingMultibandHexbeamModel, startingSquareLoopModel, validateLoopBeamModel } from "../model";
import type { LoopBeamWire } from "../schema";

beforeEach(() => useUIStore.getState().setConductor(LEGACY_CONDUCTOR));

function length(wire: LoopBeamWire): number { return Math.hypot(wire.endM.x - wire.startM.x, wire.endM.y - wire.startM.y, wire.endM.z - wire.startM.z); }
function total(wires: LoopBeamWire[], family: LoopBeamWire["family"]): number { return wires.filter((wire) => wire.family === family).reduce((sum, wire) => sum + length(wire), 0); }

describe("typed loop, quad, and hexbeam models", () => {
  it("starts every wire-family model with a 1 mm conductor", () => {
    for (const model of [startingSquareLoopModel(), startingDeltaLoopModel(), startingDiamondLoopModel(), startingCubicalQuadModel(), startingHexbeamModel(), startingMultibandHexbeamModel()]) {
      expect(model.elementDiameterM, model.kind).toBe(0.001);
    }
  });

  it("builds electrically closed square, delta, and diamond reference loops", () => {
    for (const model of [startingSquareLoopModel(), startingDeltaLoopModel(), startingDiamondLoopModel()]) {
      const generated = generateLoopBeamModel(model);
      expect(generated.issues.filter((issue) => issue.severity === "error"), model.kind).toEqual([]);
      expect(generated.wires.filter((wire) => wire.source), model.kind).toHaveLength(1);
      expect(total(generated.wires, "driven") / loopBeamWavelengthM(model.frequencyHz), model.kind).toBeCloseTo(1.02, 10);
    }
  });

  it("places each delta feed on an exact bridge and derives its conductor orientation", () => {
    expect(generateLoopBeamModel(startingDeltaLoopModel(14_175_000, "bottom")).feedConductorOrientation).toBe("horizontal");
    for (const location of ["lower-corner", "side-region"] as const) {
      const generated = generateLoopBeamModel(startingDeltaLoopModel(14_175_000, location));
      expect(generated.feedConductorOrientation).toBe("sloping");
      const source = generated.wires.find((wire) => wire.source)!;
      expect(source.id).toBe(generated.feedWireId);
      expect(length(source)).toBeGreaterThan(source.diameterM * 4);
    }
  });

  it("builds practical two-, three-, and four-loop cubical quads in explicit +Y order", () => {
    for (const count of [2, 3, 4] as const) {
      const model = startingCubicalQuadModel(14_175_000, count);
      const generated = generateLoopBeamModel(model);
      expect(generated.issues.filter((issue) => issue.severity === "error")).toEqual([]);
      expect(new Set(generated.wires.map((wire) => wire.family))).toEqual(new Set(count === 2 ? ["reflector", "driven"] : ["reflector", "driven", "director"]));
      expect(generated.intendedForwardAxis).toBe("+Y");
      expect(total(generated.wires, "driven")).toBeCloseTo(model.drivenPerimeterM, 10);
      expect(total(generated.wires, "reflector")).toBeCloseTo(model.reflectorPerimeterM, 10);
    }
    expect(resizeCubicalQuad(startingCubicalQuadModel(), 4).directorPerimetersM).toHaveLength(2);
  });

  it("builds the canonical G3TXQ broadband paths and preserves element dimensions", () => {
    for (const band of ["20m", "17m", "15m", "12m", "10m", "6m"] as const) {
      const model = startingHexbeamModel(band); const generated = generateLoopBeamModel(model);
      expect(generated.issues.filter((issue) => issue.severity === "error"), band).toEqual([]);
      expect(generated.supports, band).toHaveLength(12);
      expect(generated.wires.filter((wire) => wire.family === "driven"), band).toHaveLength(5);
      expect(generated.wires.filter((wire) => wire.family === "reflector"), band).toHaveLength(5);
      expect(total(generated.wires, "driven"), band).toBeCloseTo(model.drivenHalfLengthM * 2, 9);
      expect(total(generated.wires, "reflector"), band).toBeCloseTo(model.reflectorTotalLengthM, 9);
      const leftDriverTip = generated.wires.find((wire) => wire.id === "driven-left-outer")!.endM;
      const leftReflectorTip = generated.wires.find((wire) => wire.id === "reflector-left-tip")!.startM;
      expect(Math.hypot(leftReflectorTip.x - leftDriverTip.x, leftReflectorTip.y - leftDriverTip.y), band).toBeCloseTo(model.endSpacingM, 9);
      expect(generated.intendedForwardAxis).toBe("+Y");
    }
    const shifted = startingHexbeamModel("20m", 15_000_000);
    expect(shifted.frequencyHz).toBe(15_000_000);
    expect(shifted.drivenHalfLengthM / loopBeamWavelengthM(shifted.frequencyHz)).toBeCloseTo(startingHexbeamModel("20m").drivenHalfLengthM / loopBeamWavelengthM(startingHexbeamModel("20m").frequencyHz), 10);
  });

  it("builds nested multiband pairs with only the active driver bridged", () => {
    const model = startingMultibandHexbeamModel(["20m", "17m", "10m", "6m"]);
    expect(multibandStackSpacingM(model)).toBeCloseTo(0.1, 10);
    expect(multibandLongestBandExtraSpacingM(model)).toBeCloseTo(0.1, 10);
    expect(model.bandDimensions["20m"]?.drivenHalfLengthM).toBeCloseTo(214 * 0.0254, 10);
    expect(model.bandDimensions["20m"]?.reflectorTotalLengthM).toBeCloseTo(404 * 0.0254, 10);
    const generated = generateLoopBeamModel(model);
    expect(generated.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(generated.wires.filter((wire) => wire.source)).toHaveLength(1);
    expect(generated.wires.filter((wire) => wire.band === "20m")).toHaveLength(10);
    expect(generated.wires.filter((wire) => wire.band !== "20m")).toHaveLength(27);
    expect(generated.feedWireId).toBe("20m-driven-feed");
    expect(generated.wires.find((wire) => wire.source)?.band).toBe("20m");
    expect(generated.supports).toHaveLength(4 * 12 + 3);
    const bandHeight = (band: string) => generated.wires.find((wire) => wire.band === band)!.startM.z;
    expect(bandHeight("6m")).toBeCloseTo(model.heightM, 10);
    expect(bandHeight("10m")).toBeCloseTo(model.heightM + multibandStackSpacingM(model), 10);
    expect(bandHeight("17m")).toBeCloseTo(model.heightM + multibandStackSpacingM(model) * 2, 10);
    expect(bandHeight("20m")).toBeCloseTo(model.heightM + multibandStackSpacingM(model) * 3 + multibandLongestBandExtraSpacingM(model), 10);
    const openEnds = new Map<string, number>();
    const endpoint = (point: LoopBeamWire["startM"]) => `${point.x.toFixed(8)}|${point.y.toFixed(8)}|${point.z.toFixed(8)}`;
    for (const wire of generated.wires) { openEnds.set(endpoint(wire.startM), (openEnds.get(endpoint(wire.startM)) ?? 0) + 1); openEnds.set(endpoint(wire.endM), (openEnds.get(endpoint(wire.endM)) ?? 0) + 1); }
    expect([...openEnds.values()].filter((value) => value === 1)).toHaveLength(4 + 3 * 6);
    const adapted = adaptLoopBeamToNec(generated);
    expect(adapted.deck.match(/^GW /gm)).toHaveLength(37);
    expect(adapted.deck).toContain("EX 0 1 1 0 1 0");
    expect(adapted.deck).toContain("CM Vertical stack:");
    expect(adapted.deck).toContain("additional 17-20 spacing 0.1 m");
  });

  it("defaults legacy multiband models without a saved stack spacing to 100 mm", () => {
    const model = startingMultibandHexbeamModel(["20m", "17m", "6m"]);
    delete model.stackSpacingM;
    const generated = generateLoopBeamModel(model);
    expect(generated.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    const heights = new Map(model.bands.map((band) => [band, generated.wires.find((wire) => wire.band === band)!.startM.z]));
    expect(heights.get("6m")).toBeCloseTo(model.heightM, 10);
    expect(heights.get("17m")).toBeCloseTo(model.heightM + 0.1, 10);
    expect(heights.get("20m")).toBeCloseTo(model.heightM + 0.2 + 0.1, 10);
  });

  it("applies the configurable extra gap only at the 17–20 m transition", () => {
    const model = startingMultibandHexbeamModel(["20m", "17m", "15m"]);
    model.longestBandExtraSpacingM = 0.3;
    const generated = generateLoopBeamModel(model);
    const height = (band: string) => generated.wires.find((wire) => wire.band === band)!.startM.z;
    expect(height("17m") - height("15m")).toBeCloseTo(0.1, 10);
    expect(height("20m") - height("17m")).toBeCloseTo(0.4, 10);
  });

  it("uses an exact one-segment source, safe segmentation, NEC ground cards, and portable line lengths", () => {
    for (const model of [startingSquareLoopModel(), startingDeltaLoopModel(), startingDiamondLoopModel(), startingCubicalQuadModel(), startingHexbeamModel()]) {
      model.ground = { kind: "perfect" };
      const generated = generateLoopBeamModel(model); const segmented = segmentLoopBeamWires(generated); const adapted = adaptLoopBeamToNec(generated); const source = segmented.wires.find((wire) => wire.source)!;
      expect(segmented.feed).toEqual({ tag: source.tag, segment: 1, wireId: source.id });
      expect(source.segments).toBe(1);
      expect(segmented.wires.every((wire) => wire.segmentLengthM / loopBeamWavelengthM(model.frequencyHz) <= 0.05)).toBe(true);
      expect(adapted.deck).toContain("GE 1\nGN 1 0 0 0 0 0");
      expect(adapted.deck).toContain(`EX 0 ${source.tag} 1 0 1 0`);
      expect(adapted.deck).toContain("RP 0 46 180 1000 0 0 2 2");
      expect(adapted.deck.split("\n").filter((line) => line.startsWith("GW ")).every((line) => line.length <= 80)).toBe(true);
    }
  });

  it("keeps every external-comparator fixture identical to its application deck", () => {
    const cases = [
      ["square-loop-20m-perfect", startingSquareLoopModel()], ["delta-loop-20m-perfect", startingDeltaLoopModel()],
      ["diamond-loop-20m-perfect", startingDiamondLoopModel()], ["cubical-quad-2el-20m-perfect", startingCubicalQuadModel()],
      ["hexbeam-20m-perfect", startingHexbeamModel()],
    ] as const;
    for (const [name, model] of cases) {
      model.ground = { kind: "perfect" }; model.elementDiameterM = 0.002; const deck = adaptLoopBeamToNec(generateLoopBeamModel(model)).deck;
      const fixture = readFileSync(new URL(`../../../../../validation/loop-beams/${name}.nec`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
      expect(fixture, name).toBe(deck);
    }
  });

  it("rejects invalid ground contact, broken array cardinality, and impossible hex dimensions", () => {
    const quad = startingCubicalQuadModel(); quad.centreHeightM = 0.1; quad.directorPerimetersM = [1];
    expect(validateLoopBeamModel(quad, generateLoopBeamModel(quad).wires, generateLoopBeamModel(quad).feedWireId).some((issue) => issue.severity === "error")).toBe(true);
    const hex = startingHexbeamModel(); hex.drivenHalfLengthM = 0.1; hex.reflectorTotalLengthM = 1; hex.endSpacingM = 10;
    const invalid = generateLoopBeamModel(hex); expect(invalid.issues.some((issue) => issue.code === "hex-driver-fit")).toBe(true); expect(invalid.issues.some((issue) => issue.code === "hex-canonical-geometry")).toBe(true); expect(() => adaptLoopBeamToNec(invalid)).toThrow();
  });
});
