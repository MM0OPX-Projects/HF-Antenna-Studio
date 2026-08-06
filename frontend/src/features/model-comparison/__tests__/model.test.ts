import { describe, expect, it } from "vitest";
import { clonePreset, comparisonConditionKey, comparisonConditionWarnings, comparisonLabel, validateComparisonDefinition } from "../model";
import type { ComparisonConditions } from "../types";

const conditions: ComparisonConditions = { frequencyMhz: 14.1, ground: { kind: "perfect" }, referenceImpedanceOhm: 50, azimuthElevationDeg: 10, elevationBearingDeg: 0 };

describe("model comparison definitions", () => {
  it("provides four independent states for every requested example family", () => {
    expect(clonePreset("dipole").map((item) => item.parameterValue)).toEqual([5, 10, 15, 20]);
    expect(clonePreset("vertical").map((item) => item.parameterValue)).toEqual([2, 4, 8, 16]);
    expect(clonePreset("phased").map((item) => item.parameterValue)).toEqual([0, 90, 180, 270]);
    expect(clonePreset("yagi").map((item) => item.parameterValue)).toEqual([5, 10, 15, 20]);
    expect(clonePreset("mixed")).toHaveLength(4);
  });

  it("labels the compared parameter and rejects invalid ranges", () => {
    expect(comparisonLabel({ id: "a", family: "dipole", parameterValue: 5 })).toBe("Horizontal dipole · Height 5m");
    expect(comparisonLabel({ id: "b", family: "vertical", parameterValue: 16 })).toContain("Radial count 16");
    expect(validateComparisonDefinition({ id: "bad", family: "vertical", parameterValue: 3.5 })).toContain("Radial count must be a whole number.");
  });

  it("warns rather than overlaying stale or differently conditioned snapshots", () => {
    const definitions = clonePreset("mixed");
    const currentKey = comparisonConditionKey(conditions);
    const changedKey = comparisonConditionKey({ ...conditions, frequencyMhz: 14.2 });
    const warnings = comparisonConditionWarnings([
      { slotId: "model-1", conditionKey: currentKey, definitionKey: JSON.stringify(definitions[0]) },
      { slotId: "model-2", conditionKey: changedKey, definitionKey: JSON.stringify(definitions[1]) },
    ], definitions, conditions);
    expect(warnings.join(" ")).toContain("different frequency, ground, reference-impedance, cut, or sweep conditions");
    expect(warnings.join(" ")).toContain("differ from the current common-condition controls");
  });
});
