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

  it("treats a balanced junction source as one differential comparison port", () => {
    const template = getTemplate("dipole"); const params = getDefaultParams(template); const wires = template.generateGeometry(params);
    const project = createSimulatorProject(template.id, params, template.defaultGround, null, template.defaultFrequencyRange(params), []);
    project.mode = "editor"; project.simulator = undefined; project.editor = {
      wires: [
        { ...wires[0]!, tag: 1, segments: 5, x1: 0, y1: 0, z1: 0, x2: 0, y2: 0, z2: 5 },
        { ...wires[0]!, tag: 2, segments: 5, x1: 0, y1: 0, z1: 0, x2: 0, y2: 0, z2: -5 },
      ],
      excitations: [{ wire_tag: 1, segment: 1, voltage_real: 1, voltage_imag: 0, position_ratio: 0, feed_mode: "junction-differential", junction_endpoints: [
        { wire_tag: 1, segment: 1, endpoint: "start", polarity: 1 },
        { wire_tag: 2, segment: 1, endpoint: "start", polarity: -1 },
      ] }], loads: [], transmissionLines: [], junctions: [], radialSystems: [], ground: { type: "perfect" },
      frequencyRange: { start_mhz: 14.1, stop_mhz: 14.1, steps: 1 }, frequencySegments: [], designFrequencyMhz: 14.1,
    };
    const prepared = createSavedProjectComparisonRequest(project, createDefaultComparisonConditions());
    expect(prepared.portCount).toBe(1);
    expect(prepared.run.deck.match(/^EX /gm)).toHaveLength(2);
  });

  it("preserves an elevated Wire Editor loop's explicit GE flag and saved conditions", () => {
    const template = getTemplate("dipole"); const params = getDefaultParams(template);
    const project = createSimulatorProject(template.id, params, { type: "perfect" }, null, template.defaultFrequencyRange(params), []);
    project.mode = "editor"; project.simulator = undefined;
    project.editor = {
      wires: [
        { tag: 1, segments: 9, x1: 0, y1: 0, z1: 8, x2: 4, y2: 0, z2: 8, radius: 0.0005 },
        { tag: 2, segments: 9, x1: 4, y1: 0, z1: 8, x2: 4, y2: 0, z2: 11, radius: 0.0005 },
        { tag: 3, segments: 9, x1: 4, y1: 0, z1: 11, x2: 0, y2: 0, z2: 11, radius: 0.0005 },
        { tag: 4, segments: 9, x1: 0, y1: 0, z1: 11, x2: 0, y2: 0, z2: 8, radius: 0.0005 },
      ],
      excitations: [{ wire_tag: 1, segment: 5, voltage_real: 1, voltage_imag: 0 }], loads: [], transmissionLines: [], junctions: [], radialSystems: [],
      ground: { type: "free_space" }, geometryGroundFlag: -1,
      frequencyRange: { start_mhz: 14.1, stop_mhz: 14.1, steps: 1 }, frequencySegments: [], designFrequencyMhz: 14.1,
    };
    const conditions = { ...createDefaultComparisonConditions(), frequencyMhz: 7.1, ground: { kind: "perfect" as const } };
    const exact = createSavedProjectComparisonRequest(project, conditions, "saved");
    const common = createSavedProjectComparisonRequest(project, conditions, "common");
    expect(exact.run.deck).toContain("GE -1");
    expect(exact.run.deck).toContain("GN -1");
    expect(exact.run.deck).toContain("FR 0 1 0 0 14.1");
    expect(common.run.deck).toContain("GE -1");
    expect(common.run.deck).toContain("GN 1");
    expect(common.run.deck).toContain("FR 0 1 0 0 7.1");
  });
});
