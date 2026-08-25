import { useAntennaStore } from "../../../stores/antennaStore";
import { useEditorStore } from "../../../stores/editorStore";
import { createAntennaOptimiserProject, createEditorProject, createModelComparisonProject, createParameterSweepProject, createSimulatorProject } from "../../../utils/project-file";
import { clonePreset, createDefaultComparisonConditions, createDefaultComparisonSweep } from "../../model-comparison/model";
import { createDefaultSweepDefinition } from "../../parameter-sweeps/model";
import { createDefaultOptimisationDefinition } from "../../antenna-optimiser/model";
import { captureProject, projectModeForRoute, restoreProject, routeForProjectMode } from "../project-state";

describe("managed project state", () => {
  const originalSimulator = captureProject("simulator");
  const originalEditor = captureProject("editor");
  const originalComparison = captureProject("model-comparison");
  const originalSweep = captureProject("parameter-sweep");
  const originalOptimiser = captureProject("antenna-optimiser");

  afterEach(() => {
    restoreProject(originalSimulator);
    restoreProject(originalEditor);
    restoreProject(originalComparison);
    restoreProject(originalSweep);
    restoreProject(originalOptimiser);
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

  it("restores comparison radial topology and maps every managed workflow route", () => {
    const conditions = createDefaultComparisonConditions();
    conditions.ground = { kind: "sommerfeld-norton", conductivitySPerM: 0.002, relativePermittivity: 15 };
    conditions.radialSystems = { ...conditions.radialSystems, verticalMode: "near-surface", phasedMode: "near-surface-shared", phasedRadialCount: 24 };
    restoreProject(createModelComparisonProject(clonePreset("vertical"), conditions, createDefaultComparisonSweep()));
    const captured = captureProject("model-comparison");
    expect(captured.modelComparison?.conditions.radialSystems).toMatchObject({ verticalMode: "near-surface", phasedMode: "near-surface-shared", phasedRadialCount: 24 });
    expect(projectModeForRoute("/model-comparison")).toBe("model-comparison");
    expect(projectModeForRoute("/parameter-sweeps")).toBe("parameter-sweep");
    expect(projectModeForRoute("/antenna-optimiser")).toBe("antenna-optimiser");
    expect(routeForProjectMode("model-comparison")).toBe("/model-comparison");
  });

  it("restores parameter-sweep and optimiser input definitions without cached results", () => {
    const sweep = createDefaultSweepDefinition();
    sweep.family = "phased-array";
    sweep.ground = { kind: "sommerfeld-norton", conductivitySPerM: 0.003, relativePermittivity: 18 };
    sweep.radialSystems = { ...sweep.radialSystems, phasedMode: "near-surface-shared", phasedRadialCount: 20 };
    sweep.axes = [{ parameterId: "array-phase", start: 0, stop: 360, points: 5 }];
    restoreProject(createParameterSweepProject(sweep));
    expect(captureProject("parameter-sweep").parameterSweep?.definition).toMatchObject({ family: "phased-array", radialSystems: { phasedMode: "near-surface-shared", phasedRadialCount: 20 } });

    const optimiser = createDefaultOptimisationDefinition();
    optimiser.family = "phased-array";
    optimiser.ground = structuredClone(sweep.ground);
    optimiser.radialSystems = structuredClone(sweep.radialSystems);
    optimiser.variables = [{ parameterId: "array-phase", minimum: 0, maximum: 360 }];
    optimiser.objective.kind = "maximum-forward-gain";
    optimiser.objective.weights = { ...optimiser.objective.weights, swr: 0, resistance: 0, reactance: 0 };
    restoreProject(createAntennaOptimiserProject(optimiser));
    expect(captureProject("antenna-optimiser").antennaOptimiser?.definition).toMatchObject({ family: "phased-array", radialSystems: { phasedMode: "near-surface-shared", phasedRadialCount: 20 } });
  });
});
