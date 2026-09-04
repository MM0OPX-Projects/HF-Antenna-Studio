import type { LumpedLoad, TransmissionLine } from "../../api/nec";
import type { GeometryGroundFlag } from "../../engine/geometry-ground";
import type { EditorRadialSystem } from "../wire-editor/radial-system";
import type { EditorJunction } from "../../utils/editor-junctions";
import type { Excitation, FrequencyRange, FrequencySegment, GroundConfig, WireGeometry } from "../../templates/types";

export type ModelTransferFidelity =
  | "exact-editable"
  | "editable-with-losses"
  | "frozen-solved"
  | "blocked";

/** Durable evidence describing where an editor model came from. */
export interface ModelTransferProvenance {
  schemaVersion: 1;
  sourceModuleId: string;
  sourceModuleName: string;
  sourceModelKind: string;
  sourceModelSchemaVersion: number;
  transferredAt: string;
  fidelity: ModelTransferFidelity;
  referenceImpedanceOhm: 50 | 75;
  sourceParameters: Record<string, unknown>;
  sourceNecDeck: string;
  sourceModelFingerprint: string;
  editorModelFingerprint: string;
  warnings: string[];
  losses: string[];
}

export interface TransferEditorWire extends WireGeometry {
  selected?: boolean;
  segmentsManual?: boolean;
  lengthLocked?: boolean;
}

/** Solver-ready, editor-independent payload accepted by the wire workspace. */
export interface EditorModelTransfer {
  schemaVersion: 1;
  title: string;
  fidelity: ModelTransferFidelity;
  wires: TransferEditorWire[];
  excitations: Excitation[];
  loads: LumpedLoad[];
  transmissionLines: TransmissionLine[];
  junctions: EditorJunction[];
  radialSystems: EditorRadialSystem[];
  ground: GroundConfig;
  geometryGroundFlag: GeometryGroundFlag;
  frequencyRange: FrequencyRange;
  frequencySegments: FrequencySegment[];
  designFrequencyMhz: number;
  referenceImpedanceOhm: 50 | 75;
  provenance: ModelTransferProvenance;
  parity: {
    semanticMatch: boolean;
    summary: string;
    regeneratedCards: string[];
  };
}

export function cloneModelTransferProvenance(value: ModelTransferProvenance | null): ModelTransferProvenance | null {
  return value ? structuredClone(value) : null;
}
