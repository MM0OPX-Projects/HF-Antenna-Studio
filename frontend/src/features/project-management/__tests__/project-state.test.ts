import { useAntennaStore } from "../../../stores/antennaStore";
import { useEditorStore } from "../../../stores/editorStore";
import { createEditorProject, createSimulatorProject } from "../../../utils/project-file";
import { captureProject, restoreProject } from "../project-state";

describe("managed project state", () => {
  const originalSimulator = captureProject("simulator");
  const originalEditor = captureProject("editor");

  afterEach(() => {
    restoreProject(originalSimulator);
    restoreProject(originalEditor);
  });

  it("restores simulator parameters, ground, and explicit sweep intent", () => {
    const project = createSimulatorProject(
      "dipole",
      { ...useAntennaStore.getState().params, frequency: 7.1, height: 12.5 },
      { type: "perfect" },
      null,
      { start_mhz: 7, stop_mhz: 7.2, steps: 9 },
      [{ start_mhz: 14, stop_mhz: 14.35, steps: 15 }],
    );

    restoreProject(project);
    const captured = captureProject("simulator");

    expect(captured.simulator).toMatchObject({
      templateId: "dipole",
      params: { frequency: 7.1, height: 12.5 },
      ground: { type: "perfect" },
      frequencyRange: { start_mhz: 7, stop_mhz: 7.2, steps: 9 },
      frequencySegments: [{ start_mhz: 14, stop_mhz: 14.35, steps: 15 }],
    });
  });

  it("restores exact editor wires, source, ground, frequencies, and manual flags", () => {
    const project = createEditorProject(
      [{ tag: 7, segments: 9, segmentsManual: true, lengthLocked: true, x1: -2, y1: 0, z1: 4, x2: 2, y2: 0, z2: 4, radius: 0.0015 }],
      [{ wire_tag: 7, segment: 5, voltage_real: 1, voltage_imag: 0 }],
      [],
      [],
      { type: "custom", custom_conductivity: 0.005, custom_permittivity: 13 },
      { start_mhz: 20, stop_mhz: 22, steps: 11 },
      21.1,
      [],
      null,
      null,
      [{ start_mhz: 28, stop_mhz: 29, steps: 7 }],
      -1,
    );

    restoreProject(project);
    const state = useEditorStore.getState();

    expect(state.wires).toHaveLength(1);
    expect(state.wires[0]).toMatchObject({ tag: 7, segments: 9, segmentsManual: true, lengthLocked: true, z1: 4, z2: 4 });
    expect(state.excitations).toEqual([{ wire_tag: 7, segment: 5, voltage_real: 1, voltage_imag: 0 }]);
    expect(state.ground).toEqual({ type: "custom", custom_conductivity: 0.005, custom_permittivity: 13 });
    expect(state.frequencySegments).toEqual([{ start_mhz: 28, stop_mhz: 29, steps: 7 }]);
    expect(state.geometryGroundFlag).toBe(-1);
  });
});
