import { describe, expect, it } from "vitest";
import { validateSimulationRequest } from "../../../engine/validation";
import { resolveGeometryGroundFlag } from "../../../engine/geometry-ground";
import type { WireGeometry } from "../../../templates/types";

const ground = { type: "perfect" as const };
const frequency = { start_mhz: 14.1, stop_mhz: 14.1, steps: 1 };

function wire(tag: number, x1: number, x2: number, y = 0, z = 10): WireGeometry {
  return { tag, segments: 11, x1, y1: y, z1: z, x2, y2: y, z2: z, radius: 0.001 };
}

describe("wire-editor geometry validation", () => {
  it("accepts an intentional one-point frequency run", () => {
    const result = validateSimulationRequest(
      [wire(1, -5, 5)],
      [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0 }],
      ground,
      frequency,
    );
    expect(result.issues.some((issue) => issue.code === "frequency_range_invalid")).toBe(false);
  });

  it("selects and validates NEC GE behavior without conflating it with GN", () => {
    const elevated = [wire(1, -5, 5)];
    const touching = [{ ...wire(1, 0, 0), x2: 0, z1: 0, z2: 5 }];
    expect(resolveGeometryGroundFlag(elevated, { type: "free_space" }, null)).toBe(0);
    expect(resolveGeometryGroundFlag(elevated, ground, null)).toBe(-1);
    expect(resolveGeometryGroundFlag(touching, ground, null)).toBe(1);

    const conflict = validateSimulationRequest(
      elevated,
      [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0 }],
      ground,
      frequency,
      [],
      [],
      [],
      0,
    );
    expect(conflict.issues.some((issue) => issue.code === "geometry_ground_flag_conflict")).toBe(true);
    expect(conflict.valid).toBe(false);
  });

  it("reports disconnected endpoint groups as an advisory, not a solver-blocking error", () => {
    const result = validateSimulationRequest(
      [wire(1, -5, 5), wire(2, -2, 2, 4)],
      [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0 }],
      ground,
      frequency,
    );
    const issue = result.issues.find((candidate) => candidate.code === "disconnected_wire_groups");
    expect(issue?.severity).toBe("warning");
    expect(result.valid).toBe(true);
  });

  it("rejects duplicate tags and exact or partial collinear overlap", () => {
    const result = validateSimulationRequest(
      [wire(1, 0, 10), wire(1, 0, 10), wire(3, 5, 12)],
      [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0 }],
      ground,
      frequency,
    );
    expect(result.issues.some((issue) => issue.code === "duplicate_wire_tag")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "overlapping_wires")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "overlapping_segments")).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("rejects a ground-plane crossing and an invalid source segment", () => {
    const crossing = { ...wire(1, 0, 0), x2: 0, z1: -1, z2: 1 };
    const result = validateSimulationRequest(
      [crossing],
      [{ wire_tag: 1, segment: 0, voltage_real: 1, voltage_imag: 0 }],
      ground,
      frequency,
    );
    expect(result.issues.some((issue) => issue.code === "ground_intersection")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "excitation_segment_range")).toBe(true);
  });

  it("rejects orphaned and out-of-range loads and transmission lines", () => {
    const result = validateSimulationRequest(
      [wire(1, -5, 5)],
      [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0 }],
      ground,
      frequency,
      [
        { load_type: 0, wire_tag: 1, segment_start: 0, segment_end: 20, param1: 50, param2: 0, param3: 0 },
        { load_type: 4, wire_tag: 99, segment_start: 1, segment_end: 1, param1: 10, param2: 2, param3: 0 },
      ],
      [{ wire_tag1: 1, segment1: 99, wire_tag2: 99, segment2: 1, impedance: 0, length: -1 }],
    );
    expect(result.issues.some((issue) => issue.code === "load_segment_range")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "load_orphan")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "transmission_line_endpoint")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "transmission_line_parameter")).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("accepts NEC's explicit all-segment load selector", () => {
    const result = validateSimulationRequest(
      [wire(1, -5, 5)],
      [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0 }],
      ground,
      frequency,
      [{ load_type: 5, wire_tag: 0, segment_start: 0, segment_end: 0, param1: 58_000_000, param2: 0, param3: 0 }],
      [{ wire_tag1: 1, segment1: 2, wire_tag2: 1, segment2: 10, impedance: -75, length: 2 }],
    );
    expect(result.issues.some((issue) => issue.code === "load_orphan" || issue.code === "load_segment_range")).toBe(false);
    expect(result.issues.some((issue) => issue.code === "transmission_line_parameter")).toBe(false);
  });

  it("validates every imported frequency block without clamping it", () => {
    const result = validateSimulationRequest(
      [wire(1, -5, 5)],
      [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0 }],
      ground,
      frequency,
      [],
      [],
      [
        { start_mhz: 7, stop_mhz: 7.2, steps: 3 },
        { start_mhz: 1999, stop_mhz: 2001, steps: 3 },
      ],
    );
    expect(result.issues.some((issue) => issue.code === "frequency_out_of_engine_range")).toBe(true);
  });
});
