import { describe, expect, it } from "vitest";
import { clonePreset, comparisonConditionKey, comparisonConditionWarnings, comparisonLabel, createDefaultComparisonConditions, validateComparisonDefinition, validateComparisonRadialCounts } from "../model";
import type { ComparisonConditions } from "../types";
import { createModelComparisonProject, migrateProjectFile } from "../../../utils/project-file";

const conditions: ComparisonConditions = createDefaultComparisonConditions();

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

  it("labels and validates an immutable saved-project slot without using its built-in parameter", () => {
    const snapshot = { projectId: "p1", projectName: "My phased verticals", projectRevision: 3, project: { version: 10 } };
    const definition = { id: "saved", family: "dipole" as const, parameterValue: 0, source: "saved-project" as const, savedProject: snapshot };
    expect(comparisonLabel(definition)).toBe("My phased verticals");
    expect(validateComparisonDefinition(definition)).toEqual([]);
    expect(validateComparisonDefinition({ ...definition, savedProject: undefined })).toContain("Select a valid saved antenna project.");
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

  it("blocks two-radial slots before a near-surface comparison reaches NEC", () => {
    const realConditions: ComparisonConditions = {
      ...conditions,
      ground: { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 },
      radialSystems: { ...conditions.radialSystems, verticalMode: "near-surface" },
    };
    expect(validateComparisonRadialCounts(clonePreset("vertical"), realConditions).join(" ")).toContain("Model 1");
    expect(validateComparisonRadialCounts(clonePreset("vertical").map((item) => ({ ...item, parameterValue: Math.max(4, item.parameterValue) })), realConditions)).toEqual([]);
  });

  it("saves and restores the selected elevation-bearing mode", () => {
    const strongest = { ...conditions, elevationBearingMode: "strongest" as const };
    const project = createModelComparisonProject(clonePreset("mixed"), strongest, { mode: "start-stop", startMhz: 14, stopMhz: 14.2, points: 3, referenceOhms: 50 });
    expect(migrateProjectFile(JSON.parse(JSON.stringify(project))).project.modelComparison?.conditions.elevationBearingMode).toBe("strongest");
    expect(createDefaultComparisonConditions().elevationBearingMode).toBe("common");
  });
});
