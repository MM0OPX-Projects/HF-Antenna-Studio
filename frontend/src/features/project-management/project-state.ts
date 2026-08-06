import { useAntennaStore } from "../../stores/antennaStore";
import { useEditorStore } from "../../stores/editorStore";
import { useSimulationStore } from "../../stores/simulationStore";
import { getDefaultTemplate, getTemplate, templateMap } from "../../templates";
import { getDefaultParams } from "../../templates/types";
import {
  createEditorProject,
  createSimulatorProject,
  type ProjectFile,
} from "../../utils/project-file";

export type ManagedProjectMode = ProjectFile["mode"];

export function projectModeForRoute(pathname: string): ManagedProjectMode {
  return pathname.startsWith("/editor") ? "editor" : "simulator";
}

/** Capture only reproducibility inputs. Solver results are deliberately cache data. */
export function captureProject(mode: ManagedProjectMode): ProjectFile {
  if (mode === "editor") {
    const state = useEditorStore.getState();
    return createEditorProject(
      state.wires,
      state.excitations,
      state.loads,
      state.transmissionLines,
      state.ground,
      state.frequencyRange,
      state.designFrequencyMhz,
      state.junctions,
      null,
      state.necImport,
      state.frequencySegments,
      state.geometryGroundFlag,
    );
  }

  const state = useAntennaStore.getState();
  return createSimulatorProject(
    state.template.id,
    state.params,
    state.ground,
    null,
    state.frequencyRange,
    state.frequencySegments,
  );
}

export function restoreProject(project: ProjectFile): void {
  useSimulationStore.getState().reset();
  if (project.mode === "simulator") {
    const model = project.simulator;
    if (!model) throw new Error("The simulator project has no simulator model.");
    if (!templateMap.has(model.templateId)) {
      throw new Error(`Template "${model.templateId}" is not installed in this version.`);
    }
    const store = useAntennaStore.getState();
    store.setTemplate(getTemplate(model.templateId));
    useAntennaStore.getState().setParams({ ...useAntennaStore.getState().params, ...model.params });
    useAntennaStore.getState().setGround(model.ground);
    if (model.frequencyRange) useAntennaStore.getState().setFrequencyRange(model.frequencyRange);
    useAntennaStore.getState().setFrequencySegments(model.frequencySegments ?? []);
    return;
  }

  const model = project.editor;
  if (!model) throw new Error("The editor project has no editor model.");
  const store = useEditorStore.getState();
  store.clearAll();
  useEditorStore.getState().setDesignFrequency(model.designFrequencyMhz);
  useEditorStore.getState().setWires(
    model.wires.map((wire) => ({
      ...wire,
      selected: false,
      segmentsManual: wire.segmentsManual ?? Boolean(model.necImport),
    })),
    model.excitations,
    model.junctions,
  );
  for (const load of model.loads) useEditorStore.getState().addLoad(load);
  for (const line of model.transmissionLines) useEditorStore.getState().addTransmissionLine(line);
  useEditorStore.getState().setGround(model.ground);
  useEditorStore.getState().setGeometryGroundFlag(model.geometryGroundFlag ?? null);
  useEditorStore.getState().setFrequencyRange(model.frequencyRange);
  useEditorStore.getState().setFrequencySegments(model.frequencySegments ?? []);
  useEditorStore.getState().setNecImport(model.necImport ?? null);
}

export function createNewProject(mode: ManagedProjectMode): ProjectFile {
  if (mode === "simulator") {
    const template = getDefaultTemplate();
    useAntennaStore.getState().setTemplate(template);
    useAntennaStore.getState().setParams(getDefaultParams(template));
    useSimulationStore.getState().reset();
    return captureProject("simulator");
  }

  const template = getDefaultTemplate();
  const params = getDefaultParams(template);
  const geometry = template.generateGeometry(params);
  const rawExcitation = template.generateExcitation(params, geometry);
  const excitations = Array.isArray(rawExcitation) ? rawExcitation : [rawExcitation];
  const store = useEditorStore.getState();
  store.clearAll();
  useEditorStore.getState().setDesignFrequency(params.frequency ?? 14.1);
  useEditorStore.getState().setWires(geometry.map((wire) => ({ ...wire, selected: false })), excitations);
  useEditorStore.getState().setGround(template.defaultGround);
  useEditorStore.getState().setFrequencyRange(template.defaultFrequencyRange(params));
  useEditorStore.getState().setFrequencySegments([]);
  useSimulationStore.getState().reset();
  return captureProject("editor");
}
