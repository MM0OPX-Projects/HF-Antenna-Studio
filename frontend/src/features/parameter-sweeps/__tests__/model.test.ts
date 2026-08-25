import { describe, expect, it } from "vitest";
import { MAX_PARAMETER_SWEEP_JOBS, axisValues, buildSweepModel, builtParameterValue, createDefaultSweepDefinition, defaultAxis, parameterCoordinates, parameterSweepJobCount, validateParameterSweepDefinition } from "../model";
import type { ParameterId, ParameterSweepDefinition, ParameterSweepFamily } from "../types";

function definition(family: ParameterSweepFamily, axes: ParameterSweepDefinition["axes"], mode: ParameterSweepDefinition["mode"] = "one-dimensional"): ParameterSweepDefinition {
  return { ...createDefaultSweepDefinition(), mode, family, axes };
}

describe("parameter sweep model planning", () => {
  it("generates inclusive, distinct exact values for continuous and integer axes", () => {
    expect(axisValues({ parameterId: "dipole-height", start: 5, stop: 10, points: 3 })).toEqual([5, 7.5, 10]);
    expect(axisValues({ parameterId: "radial-count", start: 2, stop: 8, points: 4 })).toEqual([2, 4, 6, 8]);
  });

  it("creates row-major two-dimensional coordinates and enforces the 81-job ceiling", () => {
    const candidate = definition("dipole", [{ parameterId: "dipole-height", start: 5, stop: 10, points: 3 }, { parameterId: "dipole-length", start: 9, stop: 11, points: 2 }], "two-dimensional");
    expect(parameterCoordinates(candidate).map((point) => point.axisValues)).toEqual([[5, 9], [7.5, 9], [10, 9], [5, 11], [7.5, 11], [10, 11]]);
    expect(parameterSweepJobCount(candidate)).toBe(6);
    const tooLarge = { ...candidate, axes: candidate.axes.map((axis) => ({ ...axis, points: 10 })) };
    expect(parameterSweepJobCount(tooLarge)).toBeGreaterThan(MAX_PARAMETER_SWEEP_JOBS);
    expect(validateParameterSweepDefinition(tooLarge).join(" ")).toContain("maximum is 81");
  });

  it("rejects duplicate axes and integer ranges that cannot produce distinct models", () => {
    const duplicate = definition("vertical", [{ parameterId: "radial-count", start: 2, stop: 4, points: 5 }, { parameterId: "radial-count", start: 5, stop: 9, points: 5 }], "two-dimensional");
    const errors = validateParameterSweepDefinition(duplicate).join(" ");
    expect(errors).toContain("different parameters");
    expect(errors).toContain("distinct values");
  });

  it.each([
    ["dipole", "dipole-height", 7.25], ["dipole", "dipole-length", 10.8],
    ["vertical", "vertical-length", 5.4], ["vertical", "radial-count", 8],
    ["yagi", "yagi-director-spacing", 4.2], ["yagi", "yagi-height", 12],
    ["phased-array", "array-spacing", 6.1], ["phased-array", "array-phase", 135],
  ] as Array<[ParameterSweepFamily, ParameterId, number]>)('maps %s %s into the exact typed family model', (family, parameterId, value) => {
    const candidate = definition(family, [{ ...defaultAxis(parameterId, 14.1, 2), start: value, stop: value + (parameterId === "radial-count" ? 1 : 0.5) }]);
    const built = buildSweepModel(candidate, { [parameterId]: value });
    expect(built.family).toBe(family);
    expect(builtParameterValue(built, parameterId)).toBe(value);
    expect(JSON.parse(built.modelKey)).toEqual(built.model);
  });

  it("provides a valid reproducible default definition", () => {
    expect(validateParameterSweepDefinition(createDefaultSweepDefinition())).toEqual([]);
  });

  it("rejects near-surface radial-count sweeps below the four-wire geometry limit", () => {
    const candidate = definition("vertical", [{ parameterId: "radial-count", start: 2, stop: 8, points: 4 }]);
    candidate.ground = { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 };
    candidate.radialSystems = { ...candidate.radialSystems, verticalMode: "near-surface" };
    expect(validateParameterSweepDefinition(candidate).join(" ")).toContain("must start at four");
  });

  it("changes exact vertical and phased-array model identity when radial systems change", () => {
    const vertical = definition("vertical", [{ parameterId: "radial-count", start: 4, stop: 8, points: 2 }]);
    const elevated = buildSweepModel(vertical, { "radial-count": 4 });
    const nearSurface = buildSweepModel({ ...vertical, ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 }, radialSystems: { ...vertical.radialSystems, verticalMode: "near-surface" } }, { "radial-count": 4 });
    expect(elevated.modelKey).not.toBe(nearSurface.modelKey);
    expect(nearSurface.family === "vertical" && nearSurface.model.baseHeightM).toBeCloseTo(vertical.radialSystems.nearSurfaceClearanceM, 12);

    const phased = definition("phased-array", [{ parameterId: "array-phase", start: 0, stop: 180, points: 2 }]);
    const shared = buildSweepModel({ ...phased, ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 }, radialSystems: { ...phased.radialSystems, phasedMode: "near-surface-shared" } }, { "array-phase": 90 });
    expect(shared.family === "phased-array" && shared.model.radials.topology).toBe("shared-bonded-network");
  });
});
