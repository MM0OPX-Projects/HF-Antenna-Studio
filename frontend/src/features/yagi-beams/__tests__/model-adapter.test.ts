import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { adaptYagiToNec, segmentYagiWires } from "../nec-adapter";
import { buildYagiWires, generateYagiModel, regenerateYagiStartingDimensions, resizeYagi, startingYagiModel, validateYagiModel, yagiWavelengthM } from "../model";

describe("typed Yagi model and NEC adapter", () => {
  it("creates distinct 2-element, 3-element, and configurable arrays on a +Y boom", () => {
    const two = startingYagiModel(14_175_000, 0);
    const three = startingYagiModel(14_175_000, 1);
    const six = startingYagiModel(14_175_000, 4);
    expect(buildYagiWires(two)).toHaveLength(2);
    expect(buildYagiWires(three)).toHaveLength(3);
    const wires = buildYagiWires(six);
    expect(wires).toHaveLength(6);
    expect(wires[0]).toMatchObject({ id: "reflector", family: "reflector" });
    expect(wires[0]!.startM.y).toBeLessThan(0);
    expect(wires[1]).toMatchObject({ id: "driven", family: "driven", startM: expect.objectContaining({ y: 0 }) });
    expect(wires.slice(2).every((wire, index, all) => index === 0 ? wire.startM.y > 0 : wire.startM.y > all[index - 1]!.startM.y)).toBe(true);
  });

  it("uses frequency-linked starting dimensions without claiming resonance", () => {
    const model = startingYagiModel(14_100_000, 2);
    const lambda = yagiWavelengthM(model.frequencyHz);
    expect(model.drivenElementLengthM / lambda).toBeCloseTo(0.476, 10);
    expect(model.provenance).toEqual({ dimensionsAreStartingPoints: true, manualDimensions: false });
    const resized = resizeYagi(model, 6);
    expect(resized.directors).toHaveLength(6);
    expect(resized.provenance.manualDimensions).toBe(true);
    const regenerated = regenerateYagiStartingDimensions(resized, 28_500_000);
    expect(regenerated.directors).toHaveLength(6);
    expect(regenerated.provenance.manualDimensions).toBe(false);
  });

  it("assigns odd segments and the exact centre source on the driven element", () => {
    const generated = generateYagiModel(startingYagiModel());
    const segmentation = segmentYagiWires(generated);
    const driven = segmentation.wires.find((wire) => wire.family === "driven")!;
    expect(segmentation.wires.every((wire) => wire.segments >= 11 && wire.segments % 2 === 1)).toBe(true);
    expect(segmentation.feed).toEqual({ tag: driven.tag, segment: (driven.segments + 1) / 2 });
    expect(segmentation.wires.every((wire) => wire.segmentLengthM / yagiWavelengthM(generated.model.frequencyHz) <= 0.021)).toBe(true);
  });

  it("generates an exact high-resolution NEC deck for perfect and real ground", () => {
    const perfect = startingYagiModel(14_175_000, 1);
    perfect.ground = { kind: "perfect" };
    const adapted = adaptYagiToNec(generateYagiModel(perfect));
    expect(adapted.deck).toContain("GE 1\nGN 1 0 0 0 0 0");
    expect(adapted.deck).toContain(`EX 0 ${adapted.segmentation.feed.tag} ${adapted.segmentation.feed.segment} 0 1 0`);
    expect(adapted.deck).toContain("FR 0 1 0 0 14.175 0");
    expect(adapted.deck).toContain("RP 0 46 180 1000 0 0 2 2");
    expect(adapted.runRequest.deck).toBe(adapted.deck);
    expect(adapted.runRequest.parse).toMatchObject({ nTheta: 46, nPhi: 180, computeCurrents: true });
    expect(adapted.deck.split("\n").filter((line) => line.startsWith("GW ")).every((line) => line.length <= 80)).toBe(true);
    const real = startingYagiModel();
    real.ground = { kind: "sommerfeld-norton", conductivitySPerM: 0.001, relativePermittivity: 4 };
    expect(adaptYagiToNec(generateYagiModel(real)).deck).toContain("GN 2 0 0 0 4 0.001");
  });

  it("keeps the independent-comparator fixtures identical to the application cards", () => {
    for (const elements of [2, 3, 5]) {
      const model = startingYagiModel(14_175_000, elements - 2);
      model.ground = { kind: "perfect" };
      const applicationCards = adaptYagiToNec(generateYagiModel(model)).deck.split("CE\n")[1];
      const fixture = readFileSync(new URL(`../../../../../validation/yagi/starting-${elements}el-20m-perfect.nec`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
      expect(fixture.split("CE\n")[1], `${elements}-element fixture`).toBe(applicationCards);
    }
  });

  it("reports invalid values and RF-suspect geometry instead of silently correcting them", () => {
    const invalid = startingYagiModel();
    invalid.frequencyHz = 1;
    invalid.reflectorSpacingM = 0.01;
    invalid.reflectorLengthM = invalid.drivenElementLengthM * 0.9;
    invalid.directors[0]!.lengthM = invalid.drivenElementLengthM * 1.1;
    const issues = validateYagiModel(invalid);
    expect(issues.some((issue) => issue.severity === "error" && issue.code === "frequency")).toBe(true);
    expect(issues.some((issue) => issue.severity === "error" && issue.code.startsWith("close-elements"))).toBe(true);
    expect(issues.some((issue) => issue.code === "short-reflector")).toBe(true);
    expect(issues.some((issue) => issue.code === "long-director-1")).toBe(true);
    expect(() => adaptYagiToNec(generateYagiModel(invalid))).toThrow();
  });
});
