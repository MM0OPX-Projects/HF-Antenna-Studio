import { describe, expect, it } from "vitest";
import { EDITOR_WIRE_VISUAL_RADIUS_MULTIPLIER, shouldShowEditorEndpointHandles } from "../editor-antenna-presentation";

describe("Wire Editor 3D presentation", () => {
  it("hides endpoint spheres during ordinary viewing but exposes smaller editing handles when required", () => {
    expect(shouldShowEditorEndpointHandles("select", {})).toBe(false);
    expect(shouldShowEditorEndpointHandles("add", {})).toBe(true);
    expect(shouldShowEditorEndpointHandles("move", {})).toBe(true);
    expect(shouldShowEditorEndpointHandles("select", { start: 1 })).toBe(true);
  });

  it("uses a visual-only conductor emphasis greater than physical scale", () => {
    expect(EDITOR_WIRE_VISUAL_RADIUS_MULTIPLIER).toBeGreaterThan(1);
    expect(EDITOR_WIRE_VISUAL_RADIUS_MULTIPLIER).toBeLessThanOrEqual(1.5);
  });
});
