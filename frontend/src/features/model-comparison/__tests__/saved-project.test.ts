import { describe, expect, it } from "vitest";
import { createSimulatorProject } from "../../../utils/project-file";
import { getTemplate } from "../../../templates";
import { getDefaultParams } from "../../../templates/types";
import { createDefaultComparisonConditions } from "../model";
import { createSavedProjectComparisonRequest } from "../service";

describe("saved projects in controlled comparison", () => {
  it("rebuilds a simulator snapshot at common conditions without mutating it", () => {
    const template = getTemplate("dipole");
    const params = getDefaultParams(template);
    const project = createSimulatorProject(template.id, params, { type: "free_space" }, null, template.defaultFrequencyRange(params), []);
    const before = JSON.stringify(project);
    const conditions = { ...createDefaultComparisonConditions(), frequencyMhz: 7.1, ground: { kind: "perfect" as const } };
    const prepared = createSavedProjectComparisonRequest(project, conditions);
    expect(prepared.run.deck).toContain("FR 0 1 0 0 7.1");
    expect(prepared.run.deck).toContain("GN 1");
    expect(prepared.portCount).toBe(1);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("retains multiple-source semantics and reports the port count", () => {
    const template = getTemplate("dipole"); const params = getDefaultParams(template); const wires = template.generateGeometry(params);
    const project = createSimulatorProject(template.id, params, template.defaultGround, null, template.defaultFrequencyRange(params), []);
    project.mode = "editor"; project.simulator = undefined; project.editor = { wires, excitations: [{ wire_tag: wires[0]!.tag, segment: 1, voltage_real: 1, voltage_imag: 0 }, { wire_tag: wires[0]!.tag, segment: 3, voltage_real: 1, voltage_imag: 0 }], loads: [], transmissionLines: [], junctions: [], radialSystems: [], ground: { type: "perfect" }, frequencyRange: { start_mhz: 14.1, stop_mhz: 14.1, steps: 1 }, frequencySegments: [], designFrequencyMhz: 14.1 };
    expect(createSavedProjectComparisonRequest(project, createDefaultComparisonConditions()).portCount).toBe(2);
  });
});
