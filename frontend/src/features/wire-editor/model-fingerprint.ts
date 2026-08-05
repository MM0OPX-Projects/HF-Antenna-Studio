import type { LumpedLoad, TransmissionLine } from "../../api/nec";
import type {
  Excitation,
  FrequencyRange,
  GroundConfig,
  WireGeometry,
} from "../../templates/types";
import type { GeometryGroundFlag } from "../../engine/geometry-ground";

export interface FingerprintableEditorModel {
  wires: readonly WireGeometry[];
  excitations: readonly Excitation[];
  loads: readonly LumpedLoad[];
  transmissionLines: readonly TransmissionLine[];
  ground: GroundConfig;
  geometryGroundFlag?: GeometryGroundFlag | null;
  frequencyRange: FrequencyRange;
  frequencySegments?: readonly FrequencyRange[];
}

function sortedBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b)));
}

/**
 * Deterministic semantic identity used to decide whether an imported NEC
 * document is still the model that the user sees. It is not a security hash.
 */
export function editorModelFingerprint(model: FingerprintableEditorModel): string {
  return JSON.stringify({
    wires: sortedBy(model.wires, (wire) => String(wire.tag)).map((wire) => ({
      tag: wire.tag,
      segments: wire.segments,
      x1: wire.x1,
      y1: wire.y1,
      z1: wire.z1,
      x2: wire.x2,
      y2: wire.y2,
      z2: wire.z2,
      radius: wire.radius,
    })),
    excitations: sortedBy(
      model.excitations,
      (source) => `${source.wire_tag}:${source.segment}`,
    ),
    loads: sortedBy(
      model.loads,
      (load) => `${load.wire_tag}:${load.segment_start}:${load.segment_end}:${load.load_type}`,
    ),
    transmissionLines: sortedBy(
      model.transmissionLines,
      (line) => `${line.wire_tag1}:${line.segment1}:${line.wire_tag2}:${line.segment2}`,
    ),
    ground: model.ground,
    geometryGroundFlag: model.geometryGroundFlag ?? null,
    frequencyRange: model.frequencyRange,
    frequencySegments: model.frequencySegments ?? [],
  });
}
