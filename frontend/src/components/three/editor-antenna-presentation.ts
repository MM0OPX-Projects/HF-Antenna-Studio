import type { EditorMode } from "../../stores/editorStore";
import type { WireEndpoint } from "../../utils/editor-junctions";

export const EDITOR_WIRE_VISUAL_RADIUS_MULTIPLIER = 1.45;

export function shouldShowEditorEndpointHandles(
  mode: EditorMode,
  endpointSelection: Partial<Record<WireEndpoint, 1 | 2>>,
): boolean {
  return mode === "add" || mode === "move" || endpointSelection.start !== undefined || endpointSelection.end !== undefined;
}
