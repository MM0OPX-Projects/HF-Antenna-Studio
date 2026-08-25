export interface GroundRadialIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface NearSurfaceRadialPlane {
  wireAxisHeightM: number;
  wireDiameterM: number;
  wavelengthM: number;
}

/**
 * A conservative, visible starting clearance for NEC-2's raised-wire
 * approximation. This is not a claim that 10 mm represents a buried or
 * exactly-on-soil conductor.
 */
export function defaultNearSurfaceClearanceM(wireDiameterM: number): number {
  return Math.max(0.01, wireDiameterM * 2);
}

/**
 * Validate an explicit radial plane intended to approximate conductors laid
 * on real earth. NEC-2 requires the wire axes to remain above the interface.
 */
export function validateNearSurfaceRadialPlane(input: NearSurfaceRadialPlane): GroundRadialIssue[] {
  const { wireAxisHeightM, wireDiameterM, wavelengthM } = input;
  const issues: GroundRadialIssue[] = [];
  if (![wireAxisHeightM, wireDiameterM, wavelengthM].every(Number.isFinite) || wireDiameterM <= 0 || wavelengthM <= 0) {
    return [{ severity: "error", code: "surface-radial-finite", message: "Surface-radial clearance, diameter, and wavelength must be finite and positive." }];
  }
  if (wireAxisHeightM <= wireDiameterM / 2) {
    issues.push({ severity: "error", code: "surface-radial-intersection", message: "The radial wire surface intersects the NEC ground interface. Raise the wire-axis clearance above half the wire diameter." });
  } else if (wireAxisHeightM < wireDiameterM * 2) {
    issues.push({ severity: "warning", code: "surface-radial-radius-sensitivity", message: "The radial wire axis is less than two wire diameters above ground; repeat the model with increased clearance to check numerical sensitivity." });
  }
  if (wireAxisHeightM / wavelengthM > 0.005) {
    issues.push({ severity: "warning", code: "surface-radial-too-high", message: "The radial plane is above 0.005 wavelength and may behave as an elevated radial system rather than a near-surface approximation." });
  }
  issues.push({
    severity: "warning",
    code: "surface-radial-nec2-approximation",
    message: "NEC-2 cannot solve buried or exactly-on-soil wires. These current-carrying radials are explicitly raised above Sommerfeld/Norton ground; run clearance and segmentation sensitivity checks.",
  });
  return issues;
}
