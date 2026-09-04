import { useAntennaStore } from "../../stores/antennaStore";
import { useEditorStore } from "../../stores/editorStore";
import { useSimulationStore } from "../../stores/simulationStore";
import { useUIStore } from "../../stores/uiStore";
import { getDefaultTemplate, getTemplate, templateMap } from "../../templates";
import { getDefaultParams } from "../../templates/types";
import {
  createAntennaOptimiserProject,
  createEditorProject,
  createModelComparisonProject,
  createParameterSweepProject,
  createSimulatorProject,
  type ProjectFile,
} from "../../utils/project-file";
import { clonePreset, createDefaultComparisonConditions, createDefaultComparisonSweep } from "../model-comparison/model";
import type { ComparisonConditions, ComparisonSlotDefinition } from "../model-comparison/types";
import type { SweepConfig } from "../frequency-analyser/types";
import { createDefaultSweepDefinition } from "../parameter-sweeps/model";
import type { ParameterSweepDefinition } from "../parameter-sweeps/types";
import { createDefaultOptimisationDefinition } from "../antenna-optimiser/model";
import type { OptimisationDefinition } from "../antenna-optimiser/types";

export type ManagedProjectMode = ProjectFile["mode"];

export interface ComparisonWorkspaceState {
  definitions: ComparisonSlotDefinition[];
  conditions: ComparisonConditions;
  sweep: SweepConfig;
}

let comparisonWorkspace: ComparisonWorkspaceState = { definitions: clonePreset("mixed"), conditions: createDefaultComparisonConditions(), sweep: createDefaultComparisonSweep() };
let parameterSweepWorkspace = createDefaultSweepDefinition();
let optimiserWorkspace = createDefaultOptimisationDefinition();

export function getComparisonWorkspace(): ComparisonWorkspaceState { return structuredClone(comparisonWorkspace); }
export function setComparisonWorkspace(state: ComparisonWorkspaceState): void { comparisonWorkspace = structuredClone(state); }
export function getParameterSweepWorkspace(): ParameterSweepDefinition { return structuredClone(parameterSweepWorkspace); }
export function setParameterSweepWorkspace(definition: ParameterSweepDefinition): void { parameterSweepWorkspace = structuredClone(definition); }
export function getOptimiserWorkspace(): OptimisationDefinition { return structuredClone(optimiserWorkspace); }
export function setOptimiserWorkspace(definition: OptimisationDefinition): void { optimiserWorkspace = structuredClone(definition); }

export function routeForProjectMode(mode: ManagedProjectMode): string {
  if (mode === "editor") return "/editor";
  if (mode === "model-comparison") return "/model-comparison";
  if (mode === "parameter-sweep") return "/parameter-sweeps";
  if (mode === "antenna-optimiser") return "/antenna-optimiser";
  return "/";
}

export function projectModeForRoute(pathname: string): ManagedProjectMode {
  if (pathname.startsWith("/editor")) return "editor";
  if (pathname.startsWith("/model-comparison")) return "model-comparison";
  if (pathname.startsWith("/parameter-sweeps")) return "parameter-sweep";
  if (pathname.startsWith("/antenna-optimiser")) return "antenna-optimiser";
  return "simulator";
}

export function isManagedProjectRoute(pathname: string): boolean {
  return ["/", "/editor", "/model-comparison", "/parameter-sweeps", "/antenna-optimiser"].includes(pathname);
}

/** Capture only reproducibility inputs. Solver results are deliberately cache data. */
export function captureProject(mode: ManagedProjectMode): ProjectFile {
  const withConductor = (project: ProjectFile): ProjectFile => ({ ...project, conductor: { ...useUIStore.getState().conductor } });
  if (mode === "model-comparison") return withConductor(createModelComparisonProject(comparisonWorkspace.definitions, comparisonWorkspace.conditions, comparisonWorkspace.sweep));
  if (mode === "parameter-sweep") return withConductor(createParameterSweepProject(parameterSweepWorkspace));
  if (mode === "antenna-optimiser") return withConductor(createAntennaOptimiserProject(optimiserWorkspace));
  if (mode === "editor") {
    const state = useEditorStore.getState();
    return withConductor(createEditorProject(
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
      state.radialSystems,
      state.modelTransfer,
    ));
  }

  const state = useAntennaStore.getState();
  return withConductor(createSimulatorProject(
    state.template.id,
    state.params,
    state.ground,
    null,
    state.frequencyRange,
    state.frequencySegments,
  ));
}

export function restoreProject(project: ProjectFile): void {
  useSimulationStore.getState().reset();
  useUIStore.getState().setConductor(project.conductor);
  if (project.mode === "model-comparison") {
    if (!project.modelComparison) throw new Error("The model-comparison project has no comparison definition.");
    setComparisonWorkspace(project.modelComparison);
    return;
  }
  if (project.mode === "parameter-sweep") {
    if (!project.parameterSweep) throw new Error("The parameter-sweep project has no sweep definition.");
    setParameterSweepWorkspace(project.parameterSweep.definition);
    return;
  }
  if (project.mode === "antenna-optimiser") {
    if (!project.antennaOptimiser) throw new Error("The optimiser project has no optimisation definition.");
    setOptimiserWorkspace(project.antennaOptimiser.definition);
    return;
  }
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
    model.radialSystems,
  );
  for (const load of model.loads) useEditorStore.getState().addLoad(load);
  for (const line of model.transmissionLines) useEditorStore.getState().addTransmissionLine(line);
  useEditorStore.getState().setGround(model.ground);
  useEditorStore.getState().setGeometryGroundFlag(model.geometryGroundFlag ?? null);
  useEditorStore.getState().setFrequencyRange(model.frequencyRange);
  useEditorStore.getState().setFrequencySegments(model.frequencySegments ?? []);
  useEditorStore.getState().setNecImport(model.necImport ?? null);
  useEditorStore.getState().setModelTransfer(model.modelTransfer ?? null);
  if (model.modelTransfer) useUIStore.getState().setMatching({ type: "none", ratio: 1, feedlineZ0: model.modelTransfer.referenceImpedanceOhm });
}

export function createNewProject(mode: ManagedProjectMode): ProjectFile {
  if (mode === "model-comparison") {
    setComparisonWorkspace({ definitions: clonePreset("mixed"), conditions: createDefaultComparisonConditions(), sweep: createDefaultComparisonSweep() });
    return captureProject(mode);
  }
  if (mode === "parameter-sweep") {
    setParameterSweepWorkspace(createDefaultSweepDefinition());
    return captureProject(mode);
  }
  if (mode === "antenna-optimiser") {
    setOptimiserWorkspace(createDefaultOptimisationDefinition());
    return captureProject(mode);
  }
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
