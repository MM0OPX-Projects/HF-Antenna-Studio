import { describe, expect, it } from "vitest";
import { availableVariables, createDefaultOptimisationDefinition, OBJECTIVES_BY_FAMILY, validateOptimisationDefinition } from "../model";
import { constraintFailures, scoreMetrics } from "../scoring";
import type { SweepMetrics } from "../../parameter-sweeps/types";

const metrics: SweepMetrics = { swr: 1.5, gainDbi: 8, takeOffAngleDeg: 22, frontToBackDb: 14, resistanceOhm: 55, reactanceOhm: -7 };

describe("optimiser objectives and constraints", () => {
  it("scores every declared single objective with lower-is-better semantics", () => {
    const definition = createDefaultOptimisationDefinition();
    expect(scoreMetrics(metrics, { ...definition.objective, kind: "lowest-swr" })).toBe(1.5);
    expect(scoreMetrics(metrics, { ...definition.objective, kind: "maximum-forward-gain" })).toBe(-8);
    expect(scoreMetrics(metrics, { ...definition.objective, kind: "maximum-front-to-back" })).toBe(-14);
    expect(scoreMetrics(metrics, { ...definition.objective, kind: "target-feed-resistance", targetResistanceOhm: 50 })).toBe(5);
    expect(scoreMetrics(metrics, { ...definition.objective, kind: "target-zero-reactance" })).toBe(7);
    expect(scoreMetrics(metrics, { ...definition.objective, kind: "target-take-off-angle", targetTakeOffAngleDeg: 20 })).toBe(2);
  });

  it("uses the documented raw-unit weighted formula and ignores zero-weight unavailable values", () => {
    const definition = createDefaultOptimisationDefinition();
    const objective = { ...definition.objective, kind: "weighted-multi-objective" as const, targetResistanceOhm: 50, targetTakeOffAngleDeg: 20, weights: { swr: 2, gain: 0.5, frontToBack: 0, resistance: 0.1, reactance: 0.2, takeOffAngle: 0.3 } };
    expect(scoreMetrics(metrics, objective)).toBeCloseTo(2 * 0.5 - 0.5 * 8 + 0.1 * 5 + 0.2 * 7 + 0.3 * 2);
    expect(scoreMetrics({ ...metrics, swr: null, resistanceOhm: null, reactanceOhm: null, frontToBackDb: 12 }, { ...objective, weights: { swr: 0, gain: 1, frontToBack: 1, resistance: 0, reactance: 0, takeOffAngle: 0 } })).toBe(-20);
  });

  it("applies optional engineering constraints without changing the objective score", () => {
    expect(constraintFailures(metrics, { maximumSwr: 1.4, minimumGainDbi: 9, minimumFrontToBackDb: 15, maximumTakeOffAngleDeg: 20 })).toHaveLength(4);
    expect(constraintFailures(metrics, { maximumSwr: 2, minimumGainDbi: 7, minimumFrontToBackDb: 10, maximumTakeOffAngleDeg: 30 })).toEqual([]);
  });

  it("keeps objectives and dimensions compatible with each family", () => {
    expect(OBJECTIVES_BY_FAMILY["phased-array"]).not.toContain("lowest-swr");
    expect(availableVariables("yagi", 14.1).map((variable) => variable.parameterId)).toEqual(["yagi-director-spacing", "yagi-height"]);
    const invalid = createDefaultOptimisationDefinition(); invalid.family = "phased-array"; invalid.variables = availableVariables("phased-array", 14.1).slice(0, 1); invalid.objective.kind = "lowest-swr";
    expect(validateOptimisationDefinition(invalid).join(" ")).toContain("objective is unavailable");
  });

  it("requires bounds to contain the reproducible starting design", () => {
    const definition = createDefaultOptimisationDefinition(); definition.variables[0] = { parameterId: "dipole-length", minimum: 5, maximum: 6 };
    expect(validateOptimisationDefinition(definition).join(" ")).toContain("starting value");
  });
});
