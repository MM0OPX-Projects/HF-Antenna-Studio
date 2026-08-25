import { describe, expect, it } from "vitest";
import { defaultNearSurfaceClearanceM, validateNearSurfaceRadialPlane } from "../model";

describe("shared ground-radial validity", () => {
  it("uses a visible clearance that also scales for thick conductors", () => {
    expect(defaultNearSurfaceClearanceM(0.002)).toBe(0.01);
    expect(defaultNearSurfaceClearanceM(0.01)).toBe(0.02);
  });

  it("rejects wire surfaces that touch the NEC ground interface", () => {
    expect(validateNearSurfaceRadialPlane({ wireAxisHeightM: 0.001, wireDiameterM: 0.002, wavelengthM: 20 }))
      .toContainEqual(expect.objectContaining({ severity: "error", code: "surface-radial-intersection" }));
  });

  it("labels the raised-wire approximation and warns when it is no longer near-surface", () => {
    const issues = validateNearSurfaceRadialPlane({ wireAxisHeightM: 0.2, wireDiameterM: 0.002, wavelengthM: 20 });
    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "surface-radial-nec2-approximation" }));
    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "surface-radial-too-high" }));
  });
});
