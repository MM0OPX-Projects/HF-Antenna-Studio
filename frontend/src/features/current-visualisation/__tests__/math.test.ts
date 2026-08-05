import { describe, expect, it } from "vitest";
import type { SegmentCurrent } from "../../../api/nec";
import { formatCurrent, instantaneousNormalizedCurrent, maximumCurrentMagnitude, normalizePhaseDeg, normalizedCurrentMagnitude, phaseUnit } from "../math";

function current(magnitude: number, phase: number): SegmentCurrent {
  return { tag: 1, segment: 1, x: 0, y: 0, z: 0, current_real: magnitude * Math.cos(phase * Math.PI / 180), current_imag: magnitude * Math.sin(phase * Math.PI / 180), current_magnitude: magnitude, current_phase_deg: phase };
}

describe("NEC current visualisation math", () => {
  it("normalises circular phase without changing equivalent phasors", () => {
    expect(normalizePhaseDeg(0)).toBe(0);
    expect(normalizePhaseDeg(180)).toBe(-180);
    expect(normalizePhaseDeg(540)).toBe(-180);
    expect(normalizePhaseDeg(-270)).toBe(90);
    expect(phaseUnit(-180)).toBe(0);
    expect(phaseUnit(0)).toBe(0.5);
  });

  it("uses solver magnitudes for visual normalisation", () => {
    const values = [current(0.25, 0), current(1, 20), current(0.5, -30)];
    expect(maximumCurrentMagnitude(values)).toBe(1);
    expect(normalizedCurrentMagnitude(values[0]!, 1)).toBe(0.25);
    expect(normalizedCurrentMagnitude(current(2, 0), 1)).toBe(1);
  });

  it("animates the actual phasor phase rather than a wire-average flow assumption", () => {
    expect(instantaneousNormalizedCurrent(current(1, 0), 1, 0)).toBeCloseTo(1, 12);
    expect(instantaneousNormalizedCurrent(current(1, 90), 1, 0)).toBeCloseTo(0, 12);
    expect(instantaneousNormalizedCurrent(current(1, 180), 1, 0)).toBeCloseTo(-1, 12);
    expect(instantaneousNormalizedCurrent(current(0.25, 0), 1, 0.5)).toBeCloseTo(-0.25, 12);
  });

  it("formats amperes without changing the underlying value", () => {
    expect(formatCurrent(2)).toBe("2.0000 A");
    expect(formatCurrent(0.025)).toBe("25.000 mA");
    expect(formatCurrent(0.000002)).toBe("2.00 µA");
  });
});
