import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { adaptIdealCalibrationToNec, adaptIdealFinalToNec, adaptPhysicalNetworkToNec, segmentPhasedWires } from "../nec-adapter";
import { buildPhasedWires, complexPhaseDeg, elementBases, generatePhasedArray, lineMetrics, phasedWavelengthM, startingPhasedArrayModel, switchPhasedRadialRepresentation, validatePhasedArrayModel } from "../model";
import { formatPhaseDegrees } from "../presentation";

describe("typed phased-array model and NEC adapter", () => {
  it("normalises numerical signed zero in phase results", () => {
    expect(complexPhaseDeg({ real: 1, imag: -Number.EPSILON })).toBe(0);
    expect(Object.is(complexPhaseDeg({ real: 1, imag: -Number.EPSILON }), -0)).toBe(false);
    expect(formatPhaseDegrees(-0.049)).toBe("0.0");
    expect(formatPhaseDegrees(-0.051)).toBe("-0.1");
  });

  it("uses SI geometry and compass bearing from element 1 toward element 2", () => {
    const model = startingPhasedArrayModel(14_100_000);
    model.spacingM = 10;
    model.bearingDeg = 0;
    let [first, second] = elementBases(model);
    expect(first).toMatchObject({ x: expect.closeTo(0), y: expect.closeTo(-5), z: 0 });
    expect(second).toMatchObject({ x: expect.closeTo(0), y: expect.closeTo(5), z: 0 });
    model.bearingDeg = 90;
    [first, second] = elementBases(model);
    expect(first.x).toBeCloseTo(-5, 10);
    expect(second.x).toBeCloseTo(5, 10);
    expect(model.elementLengthM / phasedWavelengthM(model.frequencyHz)).toBeCloseTo(0.2375, 10);
    expect(model.elementDiameterM).toBe(0.001);
    expect(model.radials.diameterM).toBe(0.001);
    expect(model.provenance.dimensionsAreStartingPoints).toBe(true);
  });

  it("generates explicit radials and a source/TL overlay only for physical mode", () => {
    const model = startingPhasedArrayModel();
    expect(buildPhasedWires(model)).toMatchObject({ wires: expect.arrayContaining([expect.objectContaining({ family: "element-1" }), expect.objectContaining({ family: "element-2" })]), networkPaths: [] });
    model.mode = "physical-feed-network";
    model.radials = { ...model.radials, representation: "elevated-explicit-wires", topology: "independent-per-element", count: 4 };
    model.elementBaseHeightM = phasedWavelengthM(model.frequencyHz) * .1;
    const built = buildPhasedWires(model);
    expect(built.wires.filter((wire) => wire.family === "radial-1")).toHaveLength(4);
    expect(built.wires.filter((wire) => wire.family === "radial-2")).toHaveLength(4);
    expect(built.wires.some((wire) => wire.family === "source-junction")).toBe(true);
    expect(built.networkPaths).toHaveLength(2);
  });

  it("converts physical, electrical, and delay inputs consistently", () => {
    const model = startingPhasedArrayModel(10_000_000);
    model.physical.velocityFactor = .66;
    model.physical.lengthInput = "electrical";
    model.physical.line1Value = 90;
    const electrical = lineMetrics(model, 1);
    expect(electrical.necEquivalentLengthM).toBeCloseTo(phasedWavelengthM(model.frequencyHz) / 4, 8);
    expect(electrical.delayS).toBeCloseTo(25e-9, 12);
    model.physical.lengthInput = "delay"; model.physical.line1Value = 25;
    expect(lineMetrics(model, 1).electricalLengthDeg).toBeCloseTo(90, 10);
    model.physical.lengthInput = "physical"; model.physical.line1Value = electrical.physicalLengthM;
    expect(lineMetrics(model, 1).electricalLengthDeg).toBeCloseTo(90, 10);
  });

  it("segments both feed segments explicitly and emits calibrated dual voltage sources", () => {
    const generated = generatePhasedArray(startingPhasedArrayModel());
    const segmented = segmentPhasedWires(generated);
    expect(segmented.feeds).toEqual([{ tag: 1, segment: 1 }, { tag: 2, segment: 1 }]);
    expect(segmented.wires.slice(0, 2).every((wire) => wire.segments >= 11 && wire.segments % 2 === 1)).toBe(true);
    const calibration = adaptIdealCalibrationToNec(generated, 2);
    expect(calibration.deck.match(/^EX /gm)).toHaveLength(1);
    expect(calibration.deck).toContain("RP 0 1 1 1000 60 0 1 1");
    const final = adaptIdealFinalToNec(generated, [{ real: 1.25, imag: -.5 }, { real: -.25, imag: .75 }]);
    expect(final.deck.match(/^EX /gm)).toHaveLength(2);
    expect(final.deck).toContain("EX 0 1 1 0 1.25 -0.5");
    expect(final.deck).toContain("EX 0 2 1 0 -0.25 0.75");
    expect(final.deck).toContain("RP 0 45 180 1000 0 0 2 2");
    expect(final.runRequest.deck).toBe(final.deck);
    expect(final.deck.split("\n").filter((line) => line.startsWith("GW ")).every((line) => line.length <= 80)).toBe(true);
  });

  it("models a physical parallel junction with TL cards and one source", () => {
    const model = startingPhasedArrayModel();
    model.mode = "physical-feed-network";
    model.physical.lengthInput = "electrical";
    model.physical.line1Value = 90;
    model.physical.line2Value = 180;
    model.physical.sourceTerminationOhm = 50;
    const adapted = adaptPhysicalNetworkToNec(generatePhasedArray(model));
    expect(adapted.deck.match(/^TL /gm)).toHaveLength(2);
    expect(adapted.deck.match(/^EX /gm)).toHaveLength(1);
    expect(adapted.deck).toContain(" 0.02 0 ");
    expect(adapted.segmentation.sourceJunction).not.toBeNull();
    expect(adapted.deck).toContain("GN 1");
  });

  it("keeps all independently compared fixtures identical to final application cards", () => {
    const cases = [
      { name: "broadside-20m-perfect", voltage: [{ real: 51.957961, imag: -30.042609 }, { real: 51.957961, imag: -30.042609 }] },
      { name: "endfire-forward-20m-perfect", voltage: [{ real: 19.30767, imag: -34.014192 }, { real: 2.6076825, imag: -47.986378 }] },
      { name: "endfire-reverse-20m-perfect", voltage: [{ real: 47.986378, imag: 2.6076825 }, { real: 34.014192, imag: 19.30767 }] },
    ] as const;
    for (const reference of cases) {
      const model = startingPhasedArrayModel();
      model.elementDiameterM = 0.002;
      model.radials.diameterM = 0.002;
      const deck = adaptIdealFinalToNec(generatePhasedArray(model), [...reference.voltage]).deck.replace(/\r\n/g, "\n");
      const fixture = readFileSync(new URL(`../../../../../validation/phased-arrays/${reference.name}.nec`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
      expect(deck, reference.name).toBe(fixture);
    }
  });

  it("rejects invalid ground/radial combinations and preserves distinctions", () => {
    const model = startingPhasedArrayModel();
    model.ground = { kind: "sommerfeld-norton", conductivitySPerM: .005, relativePermittivity: 13 };
    const built = buildPhasedWires(model);
    expect(validatePhasedArrayModel(model, built.wires).some((issue) => issue.code === "image-ground" && issue.severity === "error")).toBe(true);
    model.radials = { ...model.radials, representation: "elevated-explicit-wires", topology: "independent-per-element", count: 4 };
    model.elementBaseHeightM = 0;
    expect(validatePhasedArrayModel(model, buildPhasedWires(model).wires).some((issue) => issue.code === "radial-clearance")).toBe(true);
    expect(() => adaptIdealCalibrationToNec(generatePhasedArray(model), 1)).toThrow();
  });

  it("builds a connected shared near-surface radial network for both element bases", () => {
    const model = switchPhasedRadialRepresentation(startingPhasedArrayModel(), "near-surface-explicit-wires");
    const generated = generatePhasedArray(model);
    expect(generated.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(generated.wires.filter((wire) => wire.family === "radial-shared")).toHaveLength(16);
    expect(generated.wires.filter((wire) => wire.family === "ground-bond")).toHaveLength(2);
    const centre = { x: 0, y: 0, z: model.elementBaseHeightM };
    expect(generated.wires.filter((wire) => wire.family === "radial-shared").every((wire) => wire.startM.x === centre.x && wire.startM.y === centre.y && wire.startM.z === centre.z)).toBe(true);
    const bases = elementBases(model);
    const bonds = generated.wires.filter((wire) => wire.family === "ground-bond");
    expect(bonds[0]).toMatchObject({ startM: bases[0], endM: centre });
    expect(bonds[1]).toMatchObject({ startM: centre, endM: bases[1] });
    expect(generated.issues).toContainEqual(expect.objectContaining({ code: "surface-radial-nec2-approximation", severity: "warning" }));
  });

  it("emits the shared radial network above Sommerfeld/Norton ground", () => {
    const model = switchPhasedRadialRepresentation(startingPhasedArrayModel(), "near-surface-explicit-wires");
    model.elementDiameterM = 0.002;
    model.radials.diameterM = 0.002;
    const adapted = adaptIdealCalibrationToNec(generatePhasedArray(model), 1);
    expect(adapted.deck.match(/^GW /gm)).toHaveLength(20);
    expect(adapted.deck).toContain("CM Radials: near-surface-explicit-wires; topology: shared-bonded-network");
    expect(adapted.deck).toContain("GE -1\nGN 2 0 0 0 13 0.005");
    const finalDeck = adaptIdealFinalToNec(generatePhasedArray(model), [{ real: 1, imag: 0 }, { real: 1, imag: 0 }]).deck.replace(/\r\n/g, "\n");
    const fixture = readFileSync(new URL("../../../../../validation/phased-arrays/shared-16radial-20m-real.nec", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    expect(finalDeck).toBe(fixture);
  });

  it("rejects overlapping independent near-surface fields instead of leaving unresolved crossings", () => {
    const model = switchPhasedRadialRepresentation(startingPhasedArrayModel(), "near-surface-explicit-wires");
    model.radials.topology = "independent-per-element";
    const issues = validatePhasedArrayModel(model, buildPhasedWires(model).wires);
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", code: "independent-radial-overlap" }));
  });
});
