/**
 * Save/Load project files (.antennasim).
 *
 * A .antennasim file is a JSON document that captures the complete state
 * of either a simulator-mode or editor-mode session, so users don't lose
 * their work.
 */

import type { GroundConfig, FrequencyRange, FrequencySegment, Excitation, WireGeometry } from "../templates/types";
import type { LumpedLoad, TransmissionLine, SimulationResult } from "../api/nec";
import type { EditorJunction } from "./editor-junctions";
import type { NecImportState } from "../engine/types";
import type { GeometryGroundFlag } from "../engine/geometry-ground";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/** Current schema version. Increment when the format changes. */
export const PROJECT_SCHEMA_VERSION = 3;

/** File extension (without dot) */
export const PROJECT_FILE_EXTENSION = "antennasim";

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
  mode: "simulator" | "editor";

  /** Simulator mode state */
  simulator?: {
    templateId: string;
    params: Record<string, number>;
    ground: GroundConfig;
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

  /** Cached simulation result (optional — can be large) */
  result?: SimulationResult | null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate a parsed object looks like a ProjectFile. Throws on invalid. */
export function validateProjectFile(data: unknown): ProjectFile {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid project file: not an object");
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== "number") {
    throw new Error("Invalid project file: missing 'version' field");
  }
  if (obj.version > PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `Project file version ${obj.version} is newer than supported (${PROJECT_SCHEMA_VERSION}). Please update AntennaSim.`,
    );
  }
  if (obj.mode !== "simulator" && obj.mode !== "editor") {
    throw new Error("Invalid project file: 'mode' must be 'simulator' or 'editor'");
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

    // Junctions were introduced in schema v2. Treat their absence in v1 as
    // an unlocked project so existing user files remain fully compatible.
    if (obj.version < 2 && ed.junctions === undefined) {
      ed.junctions = [];
    }
    if (!Array.isArray(ed.junctions)) {
      throw new Error("Invalid project file: editor mode requires 'editor.junctions' array");
    }
    for (const collection of ["excitations", "loads", "transmissionLines"] as const) {
      if (ed[collection] === undefined && obj.version < 3) ed[collection] = [];
      if (!Array.isArray(ed[collection])) {
        throw new Error(`Invalid project file: editor.${collection} must be an array`);
      }
    }
    if (ed.frequencySegments === undefined && obj.version < 3) ed.frequencySegments = [];
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

  return data as ProjectFile;
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
): ProjectFile {
  return {
    version: PROJECT_SCHEMA_VERSION,
    app_version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown",
    created_at: new Date().toISOString(),
    mode: "simulator",
    simulator: { templateId, params: { ...params }, ground: { ...ground } },
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
  if (!file.name.endsWith(`.${PROJECT_FILE_EXTENSION}`) && !file.name.endsWith(".json")) {
    throw new Error(`Expected a .${PROJECT_FILE_EXTENSION} or .json file, got "${file.name}"`);
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

/**
 * Estimate the size of a project file in bytes (for UI hints).
 */
export function estimateProjectSize(project: ProjectFile): number {
  return JSON.stringify(project).length;
}
