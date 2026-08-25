/**
 * Save/load HF Antenna Studio project files (.hfas) and legacy .antennasim files.
 *
 * A project file is a JSON document that captures the complete state
 * of either a simulator-mode or editor-mode session, so users don't lose
 * their work.
 */

import type { GroundConfig, FrequencyRange, FrequencySegment, Excitation, WireGeometry } from "../templates/types";
import type { LumpedLoad, TransmissionLine, SimulationResult } from "../api/nec";
import type { EditorJunction } from "./editor-junctions";
import type { NecImportState } from "../engine/types";
import type { GeometryGroundFlag } from "../engine/geometry-ground";
import type { ComparisonConditions, ComparisonSlotDefinition } from "../features/model-comparison/types";
import type { SweepConfig } from "../features/frequency-analyser/types";
import type { ParameterSweepDefinition } from "../features/parameter-sweeps/types";
import type { OptimisationDefinition } from "../features/antenna-optimiser/types";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/** Current schema version. Increment when the format changes. */
export const PROJECT_SCHEMA_VERSION = 5;

/** File extension (without dot) */
export const PROJECT_FILE_EXTENSION = "hfas";
export const LEGACY_PROJECT_FILE_EXTENSION = "antennasim";
export const MAX_PROJECT_FILE_CHARACTERS = 5_000_000;

export function isSupportedProjectFilename(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return lowerName.endsWith(`.${PROJECT_FILE_EXTENSION}`) ||
    lowerName.endsWith(`.${LEGACY_PROJECT_FILE_EXTENSION}`) ||
    lowerName.endsWith(".json");
}

export interface ProjectEditorWire extends WireGeometry {
  segmentsManual?: boolean;
  lengthLocked?: boolean;
}

export interface ProjectFile {
  /** Schema version for forward compatibility */
  version: number;
  /** AntennaSim version that created this file */
  app_version: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** Which mode the project was saved from */
  mode: "simulator" | "editor" | "model-comparison" | "parameter-sweep" | "antenna-optimiser";

  /** Simulator mode state */
  simulator?: {
    templateId: string;
    params: Record<string, number>;
    ground: GroundConfig;
    /** Explicit sweep intent. Absent only on files migrated from schema 1-3. */
    frequencyRange?: FrequencyRange;
    /** Explicit multi-band sweep intent. Absent only on files migrated from schema 1-3. */
    frequencySegments?: FrequencySegment[];
  };

  /** Editor mode state */
  editor?: {
    wires: ProjectEditorWire[];
    excitations: Excitation[];
    loads: LumpedLoad[];
    transmissionLines: TransmissionLine[];
    /** Editor-only endpoint groups that move as one connection */
    junctions: EditorJunction[];
    ground: GroundConfig;
    /** Explicit NEC GE behavior, or null for automatic editor selection. */
    geometryGroundFlag?: GeometryGroundFlag | null;
    frequencyRange: FrequencyRange;
    frequencySegments?: FrequencySegment[];
    designFrequencyMhz: number;
    /** Optional browser-decoded imported NEC source plus its conversion report. */
    necImport?: NecImportState | null;
  };

  /** Reproducibility inputs only; calculated comparison results are cache data. */
  modelComparison?: {
    definitions: ComparisonSlotDefinition[];
    conditions: ComparisonConditions;
    sweep: SweepConfig;
  };

  parameterSweep?: { definition: ParameterSweepDefinition };
  antennaOptimiser?: { definition: OptimisationDefinition };

  /** Cached simulation result (optional — can be large) */
  result?: SimulationResult | null;
}

export interface ProjectMigrationResult {
  project: ProjectFile;
  sourceVersion: number;
  migrations: string[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate a parsed object looks like a ProjectFile. Throws on invalid. */
function validateCurrentProjectFile(data: unknown): ProjectFile {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid project file: not an object");
  }
  const obj = data as Record<string, unknown>;
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  const finiteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  const allowedFamilies = new Set(["dipole", "vertical", "yagi", "phased-array"]);
  const allowedParameterIds = new Set(["dipole-height", "dipole-length", "vertical-length", "radial-count", "yagi-director-spacing", "yagi-height", "array-spacing", "array-phase"]);
  const validGround = (value: unknown): boolean => isRecord(value) && (value.kind === "perfect" || (value.kind === "sommerfeld-norton" && finiteNumber(value.conductivitySPerM) && finiteNumber(value.relativePermittivity)));
  const hasRadialSchema = (value: unknown): boolean => {
    if (!isRecord(value) || value.schemaVersion !== 1) return false;
    if (value.verticalMode !== "elevated-independent" && value.verticalMode !== "near-surface") return false;
    if (!["perfect-ground-image", "elevated-independent", "near-surface-independent", "near-surface-shared"].includes(String(value.phasedMode))) return false;
    return ["radialLengthWavelengths", "radialDiameterM", "nearSurfaceClearanceM", "elevatedHeightWavelengths", "elevatedDroopAngleDeg", "phasedRadialCount"].every((field) => finiteNumber(value[field]));
  };

  if (typeof obj.version !== "number") {
    throw new Error("Invalid project file: missing 'version' field");
  }
  if (obj.version > PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `Project file version ${obj.version} is newer than supported (${PROJECT_SCHEMA_VERSION}). Please update HF Antenna Studio.`,
    );
  }
  if (!(["simulator", "editor", "model-comparison", "parameter-sweep", "antenna-optimiser"] as const).includes(obj.mode as ProjectFile["mode"])) {
    throw new Error("Invalid project file: 'mode' must be one of simulator, editor, model-comparison, parameter-sweep, or antenna-optimiser");
  }

  if (obj.mode === "simulator") {
    const sim = obj.simulator as Record<string, unknown> | undefined;
    if (!sim || typeof sim.templateId !== "string") {
      throw new Error("Invalid project file: simulator mode requires 'simulator.templateId'");
    }
    if (!sim.params || typeof sim.params !== "object") {
      throw new Error("Invalid project file: simulator mode requires 'simulator.params'");
    }
  }

  if (obj.mode === "editor") {
    const ed = obj.editor as Record<string, unknown> | undefined;
    if (!ed || !Array.isArray(ed.wires)) {
      throw new Error("Invalid project file: editor mode requires 'editor.wires' array");
    }
    if (ed.wires.length === 0) {
      throw new Error("Invalid project file: editor must have at least one wire");
    }

    if (!Array.isArray(ed.junctions)) {
      throw new Error("Invalid project file: editor mode requires 'editor.junctions' array");
    }
    for (const collection of ["excitations", "loads", "transmissionLines"] as const) {
      if (!Array.isArray(ed[collection])) {
        throw new Error(`Invalid project file: editor.${collection} must be an array`);
      }
    }
    if (ed.frequencySegments !== undefined && !Array.isArray(ed.frequencySegments)) {
      throw new Error("Invalid project file: editor.frequencySegments must be an array");
    }
    if (
      ed.geometryGroundFlag !== undefined &&
      ed.geometryGroundFlag !== null &&
      ed.geometryGroundFlag !== -1 &&
      ed.geometryGroundFlag !== 0 &&
      ed.geometryGroundFlag !== 1
    ) {
      throw new Error("Invalid project file: editor.geometryGroundFlag must be -1, 0, 1, or null");
    }

    if (ed.necImport !== undefined && ed.necImport !== null) {
      if (typeof ed.necImport !== "object") {
        throw new Error("Invalid project file: editor.necImport must be an object");
      }
      const necImport = ed.necImport as Record<string, unknown>;
      const document = necImport.document as Record<string, unknown> | undefined;
      if (typeof necImport.source_name !== "string" || typeof necImport.imported_model_fingerprint !== "string" || !document || typeof document.original_text !== "string" || !Array.isArray(document.cards) || !Array.isArray(document.diagnostics)) {
        throw new Error("Invalid project file: editor.necImport is incomplete");
      }
    }

    const wireTags = new Set<number>();
    for (const rawWire of ed.wires) {
      if (typeof rawWire !== "object" || rawWire === null) continue;
      const wire = rawWire as Record<string, unknown>;
      if (typeof wire.tag === "number") wireTags.add(wire.tag);
      for (const field of ["segmentsManual", "lengthLocked"] as const) {
        if (wire[field] !== undefined && typeof wire[field] !== "boolean") {
          throw new Error(`Invalid project file: editor wire ${field} must be boolean`);
        }
      }
    }
    const junctionIds = new Set<number>();
    const connectedEndpoints = new Set<string>();
    for (const rawJunction of ed.junctions) {
      if (typeof rawJunction !== "object" || rawJunction === null) {
        throw new Error("Invalid project file: junction must be an object");
      }
      const junction = rawJunction as Record<string, unknown>;
      if (!Number.isInteger(junction.id) || (junction.id as number) < 1) {
        throw new Error("Invalid project file: junction requires a positive integer 'id'");
      }
      if (junctionIds.has(junction.id as number)) {
        throw new Error("Invalid project file: junction IDs must be unique");
      }
      junctionIds.add(junction.id as number);
      if (!Array.isArray(junction.endpoints) || junction.endpoints.length < 2) {
        throw new Error("Invalid project file: junction requires at least two endpoints");
      }
      for (const rawEndpoint of junction.endpoints) {
        if (typeof rawEndpoint !== "object" || rawEndpoint === null) {
          throw new Error("Invalid project file: junction endpoint must be an object");
        }
        const endpoint = rawEndpoint as Record<string, unknown>;
        if (!wireTags.has(endpoint.wireTag as number)) {
          throw new Error("Invalid project file: junction references a missing wire");
        }
        if (endpoint.endpoint !== "start" && endpoint.endpoint !== "end") {
          throw new Error("Invalid project file: junction endpoint must be 'start' or 'end'");
        }
        const key = `${endpoint.wireTag}:${endpoint.endpoint}`;
        if (connectedEndpoints.has(key)) {
          throw new Error("Invalid project file: an endpoint cannot belong to multiple junctions");
        }
        connectedEndpoints.add(key);
      }
    }
  }

  if (obj.mode === "model-comparison") {
    const workspace = obj.modelComparison as Record<string, unknown> | undefined;
    const conditions = workspace?.conditions as Record<string, unknown> | undefined;
    const definitionsValid = Array.isArray(workspace?.definitions) && workspace.definitions.length === 4 && workspace.definitions.every((definition) => isRecord(definition) && typeof definition.id === "string" && allowedFamilies.has(String(definition.family)) && finiteNumber(definition.parameterValue));
    const sweep = workspace?.sweep as Record<string, unknown> | undefined;
    const conditionsValid = Boolean(conditions && finiteNumber(conditions.frequencyMhz) && validGround(conditions.ground) && hasRadialSchema(conditions.radialSystems) && (conditions.referenceImpedanceOhm === 50 || conditions.referenceImpedanceOhm === 75) && finiteNumber(conditions.azimuthElevationDeg) && finiteNumber(conditions.elevationBearingDeg));
    const sweepValid = Boolean(sweep && (sweep.mode === "start-stop" || sweep.mode === "center-span") && finiteNumber(sweep.startMhz) && finiteNumber(sweep.stopMhz) && finiteNumber(sweep.points) && finiteNumber(sweep.referenceOhms));
    if (!workspace || !definitionsValid || !conditionsValid || !sweepValid) {
      throw new Error("Invalid project file: model-comparison mode requires four definitions, conditions, and sweep settings");
    }
  }

  if (obj.mode === "parameter-sweep") {
    const definition = (obj.parameterSweep as Record<string, unknown> | undefined)?.definition as Record<string, unknown> | undefined;
    const axesValid = Array.isArray(definition?.axes) && definition.axes.every((axis) => isRecord(axis) && allowedParameterIds.has(String(axis.parameterId)) && finiteNumber(axis.start) && finiteNumber(axis.stop) && finiteNumber(axis.points));
    if (!definition || definition.schemaVersion !== 2 || (definition.mode !== "one-dimensional" && definition.mode !== "two-dimensional") || !allowedFamilies.has(String(definition.family)) || !finiteNumber(definition.frequencyMhz) || !validGround(definition.ground) || !hasRadialSchema(definition.radialSystems) || (definition.referenceImpedanceOhm !== 50 && definition.referenceImpedanceOhm !== 75) || !axesValid) throw new Error("Invalid project file: parameter-sweep mode requires a complete schema-v2 definition");
  }

  if (obj.mode === "antenna-optimiser") {
    const definition = (obj.antennaOptimiser as Record<string, unknown> | undefined)?.definition as Record<string, unknown> | undefined;
    const variablesValid = Array.isArray(definition?.variables) && definition.variables.every((variable) => isRecord(variable) && allowedParameterIds.has(String(variable.parameterId)) && finiteNumber(variable.minimum) && finiteNumber(variable.maximum));
    const objective = definition?.objective as Record<string, unknown> | undefined;
    const weights = objective?.weights as Record<string, unknown> | undefined;
    const objectiveValid = Boolean(objective && ["lowest-swr", "maximum-forward-gain", "maximum-front-to-back", "target-feed-resistance", "target-zero-reactance", "target-take-off-angle", "weighted-multi-objective"].includes(String(objective.kind)) && finiteNumber(objective.targetResistanceOhm) && finiteNumber(objective.targetTakeOffAngleDeg) && weights && ["swr", "gain", "frontToBack", "resistance", "reactance", "takeOffAngle"].every((field) => finiteNumber(weights[field])));
    const constraints = definition?.constraints as Record<string, unknown> | undefined;
    const constraintsValid = Boolean(constraints && ["maximumSwr", "minimumGainDbi", "minimumFrontToBackDb", "maximumTakeOffAngleDeg"].every((field) => constraints[field] === null || finiteNumber(constraints[field])));
    const algorithm = definition?.algorithm as Record<string, unknown> | undefined;
    const algorithmValid = Boolean(algorithm && algorithm.id === "bounded-coordinate-pattern-search-v1" && ["maximumEvaluations", "initialStepFraction", "stepShrinkFactor", "minimumStepFraction"].every((field) => finiteNumber(algorithm[field])));
    if (!definition || definition.schemaVersion !== 2 || !allowedFamilies.has(String(definition.family)) || !finiteNumber(definition.frequencyMhz) || !validGround(definition.ground) || !hasRadialSchema(definition.radialSystems) || (definition.referenceImpedanceOhm !== 50 && definition.referenceImpedanceOhm !== 75) || !variablesValid || !objectiveValid || !constraintsValid || !algorithmValid) throw new Error("Invalid project file: antenna-optimiser mode requires a complete schema-v2 definition");
  }

  return data as ProjectFile;
}

/**
 * Upgrade a parsed project on a detached copy. The caller's object is never
 * changed, which allows an imported older file to be retained byte-for-byte.
 */
export function migrateProjectFile(data: unknown): ProjectMigrationResult {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid project file: not an object");
  }
  const source = data as Record<string, unknown>;
  if (typeof source.version !== "number") {
    throw new Error("Invalid project file: missing 'version' field");
  }
  if (!Number.isInteger(source.version) || source.version < 1) {
    throw new Error("Invalid project file: 'version' must be a positive integer");
  }
  if (source.version > PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `Project file version ${source.version} is newer than supported (${PROJECT_SCHEMA_VERSION}). Please update HF Antenna Studio.`,
    );
  }

  const sourceVersion = source.version;
  const copy = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  const migrations: string[] = [];

  if (sourceVersion < 2 && copy.mode === "editor") {
    const editor = copy.editor as Record<string, unknown> | undefined;
    if (editor && editor.junctions === undefined) editor.junctions = [];
    migrations.push("v1 to v2: added an empty editor junction list");
  }
  if (sourceVersion < 3 && copy.mode === "editor") {
    const editor = copy.editor as Record<string, unknown> | undefined;
    if (editor) {
      if (editor.excitations === undefined) editor.excitations = [];
      if (editor.loads === undefined) editor.loads = [];
      if (editor.transmissionLines === undefined) editor.transmissionLines = [];
      if (editor.frequencySegments === undefined) editor.frequencySegments = [];
    }
    migrations.push("v2 to v3: added explicit sources, loads, transmission lines, and sweep segments");
  }
  if (sourceVersion < 4) {
    // v1-v3 simulator files did not record explicit frequency overrides. Do
    // not invent one: restore code intentionally uses the template-derived
    // range and the migration report explains the limitation.
    migrations.push("v3 to v4: retained legacy simulator frequency behaviour; explicit sweep intent was unavailable");
  }
  if (sourceVersion < 5) {
    migrations.push("v4 to v5: added project modes for comparison, parameter sweeps, and optimisation; legacy project inputs were retained unchanged");
  }

  copy.version = PROJECT_SCHEMA_VERSION;
  return {
    project: validateCurrentProjectFile(copy),
    sourceVersion,
    migrations,
  };
}

/** Validate and migrate a parsed project without mutating the input object. */
export function validateProjectFile(data: unknown): ProjectFile {
  return migrateProjectFile(data).project;
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/**
 * Create a ProjectFile from simulator mode state.
 */
export function createSimulatorProject(
  templateId: string,
  params: Record<string, number>,
  ground: GroundConfig,
  result?: SimulationResult | null,
  frequencyRange?: FrequencyRange,
  frequencySegments: FrequencySegment[] = [],
): ProjectFile {
  return {
    version: PROJECT_SCHEMA_VERSION,
    app_version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown",
    created_at: new Date().toISOString(),
    mode: "simulator",
    simulator: {
      templateId,
      params: { ...params },
      ground: { ...ground },
      ...(frequencyRange ? { frequencyRange: { ...frequencyRange } } : {}),
      frequencySegments: frequencySegments.map((segment) => ({ ...segment })),
    },
    result: result ?? null,
  };
}

/**
 * Create a ProjectFile from editor mode state.
 */
export function createEditorProject(
  wires: ProjectEditorWire[],
  excitations: Excitation[],
  loads: LumpedLoad[],
  transmissionLines: TransmissionLine[],
  ground: GroundConfig,
  frequencyRange: FrequencyRange,
  designFrequencyMhz: number,
  junctions: EditorJunction[] = [],
  result?: SimulationResult | null,
  necImport?: NecImportState | null,
  frequencySegments: FrequencySegment[] = [],
  geometryGroundFlag: GeometryGroundFlag | null = null,
): ProjectFile {
  return {
    version: PROJECT_SCHEMA_VERSION,
    app_version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown",
    created_at: new Date().toISOString(),
    mode: "editor",
    editor: {
      wires: wires.map((wire) => ({
        tag: wire.tag,
        segments: wire.segments,
        x1: wire.x1,
        y1: wire.y1,
        z1: wire.z1,
        x2: wire.x2,
        y2: wire.y2,
        z2: wire.z2,
        radius: wire.radius,
        ...(wire.segmentsManual !== undefined ? { segmentsManual: wire.segmentsManual } : {}),
        ...(wire.lengthLocked !== undefined ? { lengthLocked: wire.lengthLocked } : {}),
      })),
      excitations: excitations.map((e) => ({ ...e })),
      loads: loads.map((l) => ({ ...l })),
      transmissionLines: transmissionLines.map((t) => ({ ...t })),
      junctions: junctions.map((junction) => ({
        ...junction,
        endpoints: junction.endpoints.map((endpoint) => ({ ...endpoint })),
      })),
      ground: { ...ground },
      geometryGroundFlag,
      frequencyRange: { ...frequencyRange },
      frequencySegments: frequencySegments.map((segment) => ({ ...segment })),
      designFrequencyMhz,
      necImport: necImport ? {
        ...necImport,
        document: {
          ...necImport.document,
          cards: necImport.document.cards.map((card) => ({ ...card })),
          diagnostics: necImport.document.diagnostics.map((diagnostic) => ({ ...diagnostic })),
        },
      } : null,
    },
    result: result ?? null,
  };
}

function projectEnvelope(mode: ProjectFile["mode"]): Pick<ProjectFile, "version" | "app_version" | "created_at" | "mode"> {
  return {
    version: PROJECT_SCHEMA_VERSION,
    app_version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown",
    created_at: new Date().toISOString(),
    mode,
  };
}

export function createModelComparisonProject(definitions: ComparisonSlotDefinition[], conditions: ComparisonConditions, sweep: SweepConfig): ProjectFile {
  return { ...projectEnvelope("model-comparison"), modelComparison: { definitions: structuredClone(definitions), conditions: structuredClone(conditions), sweep: structuredClone(sweep) }, result: null };
}

export function createParameterSweepProject(definition: ParameterSweepDefinition): ProjectFile {
  return { ...projectEnvelope("parameter-sweep"), parameterSweep: { definition: structuredClone(definition) }, result: null };
}

export function createAntennaOptimiserProject(definition: OptimisationDefinition): ProjectFile {
  return { ...projectEnvelope("antenna-optimiser"), antennaOptimiser: { definition: structuredClone(definition) }, result: null };
}

/**
 * Serialize a project to JSON and trigger a browser download.
 */
export function downloadProject(project: ProjectFile, filename?: string): void {
  const name = filename ?? `antenna-${project.mode}-${Date.now()}.${PROJECT_FILE_EXTENSION}`;
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/**
 * Parse and validate a project file from a File object.
 * Returns the validated ProjectFile or throws with a user-friendly message.
 */
export async function loadProjectFile(file: File): Promise<ProjectFile> {
  if (!isSupportedProjectFilename(file.name)) {
    throw new Error(`Expected a .${PROJECT_FILE_EXTENSION}, .${LEGACY_PROJECT_FILE_EXTENSION}, or .json file, got "${file.name}"`);
  }

  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid project file: not valid JSON");
  }

  return validateProjectFile(parsed);
}

/** Parse a project while retaining the exact source text and migration report. */
export function parseProjectText(text: string): ProjectMigrationResult & { originalText: string } {
  if (text.length > MAX_PROJECT_FILE_CHARACTERS) {
    throw new Error(`Project file exceeds the ${MAX_PROJECT_FILE_CHARACTERS.toLocaleString()}-character safety limit.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid project file: not valid JSON");
  }
  return { ...migrateProjectFile(parsed), originalText: text };
}

/**
 * Estimate the size of a project file in bytes (for UI hints).
 */
export function estimateProjectSize(project: ProjectFile): number {
  return JSON.stringify(project).length;
}
