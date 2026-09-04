/**
 * Pre-simulation validation for antenna geometry.
 *
 * Checks NEC2 modelling rules and common mistakes before sending
 * a geometry to the simulation engine, giving users actionable
 * warnings instead of cryptic NEC2 failures or bad results.
 */

import type { WireGeometry, Excitation, GroundConfig, FrequencyRange, FrequencySegment } from "../templates/types";
import type { LumpedLoad, TransmissionLine } from "../api/nec";
import { MAX_FREQUENCY_MHZ, MIN_FREQUENCY_MHZ } from "./limits";
import type { GeometryGroundFlag } from "./geometry-ground";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  /** Severity: errors prevent simulation, warnings are advisory */
  severity: ValidationSeverity;
  /** Short machine-readable code */
  code: string;
  /** Human-readable explanation */
  message: string;
  /** Wire tag(s) involved, if applicable */
  wireTags?: number[];
}

export interface ValidationResult {
  /** All issues found */
  issues: ValidationIssue[];
  /** True if there are no errors (warnings are OK) */
  valid: boolean;
  /** Convenience: number of errors */
  errorCount: number;
  /** Convenience: number of warnings */
  warningCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wireLength(w: WireGeometry): number {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const dz = w.z2 - w.z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const GEOMETRY_TOLERANCE_M = 1e-6;
const PAIRWISE_WIRE_LIMIT = 500;

type Point = { x: number; y: number; z: number };

function endpoints(wire: WireGeometry): [Point, Point] {
  return [
    { x: wire.x1, y: wire.y1, z: wire.z1 },
    { x: wire.x2, y: wire.y2, z: wire.z2 },
  ];
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Point, b: Point): Point {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function norm(point: Point): number {
  return Math.hypot(point.x, point.y, point.z);
}

function hasCoincidentEndpoint(a: WireGeometry, b: WireGeometry): boolean {
  const aEnds = endpoints(a);
  const bEnds = endpoints(b);
  return aEnds.some((left) => bEnds.some((right) => distance(left, right) <= GEOMETRY_TOLERANCE_M));
}

/** Length of collinear overlap, or zero when segments are not collinear. */
function collinearOverlap(a: WireGeometry, b: WireGeometry): number {
  const [a0, a1] = endpoints(a);
  const [b0, b1] = endpoints(b);
  const direction = subtract(a1, a0);
  const length = norm(direction);
  if (length <= GEOMETRY_TOLERANCE_M) return 0;
  if (norm(cross(direction, subtract(b0, a0))) > GEOMETRY_TOLERANCE_M * length) return 0;
  if (norm(cross(direction, subtract(b1, a0))) > GEOMETRY_TOLERANCE_M * length) return 0;
  const lengthSquared = dot(direction, direction);
  const t0 = dot(subtract(b0, a0), direction) / lengthSquared;
  const t1 = dot(subtract(b1, a0), direction) / lengthSquared;
  const low = Math.max(0, Math.min(t0, t1));
  const high = Math.min(1, Math.max(t0, t1));
  return Math.max(0, high - low) * length;
}

/** Closest distance between two finite 3D line segments. */
function segmentDistance(a: WireGeometry, b: WireGeometry): number {
  const [p1, q1] = endpoints(a);
  const [p2, q2] = endpoints(b);
  const d1 = subtract(q1, p1);
  const d2 = subtract(q2, p2);
  const r = subtract(p1, p2);
  const aa = dot(d1, d1);
  const ee = dot(d2, d2);
  const ff = dot(d2, r);
  let s = 0;
  let t = 0;
  if (aa <= GEOMETRY_TOLERANCE_M ** 2 && ee <= GEOMETRY_TOLERANCE_M ** 2) return distance(p1, p2);
  if (aa <= GEOMETRY_TOLERANCE_M ** 2) t = Math.max(0, Math.min(1, ff / ee));
  else {
    const cc = dot(d1, r);
    if (ee <= GEOMETRY_TOLERANCE_M ** 2) s = Math.max(0, Math.min(1, -cc / aa));
    else {
      const bb = dot(d1, d2);
      const denominator = aa * ee - bb * bb;
      if (Math.abs(denominator) > Number.EPSILON) s = Math.max(0, Math.min(1, (bb * ff - cc * ee) / denominator));
      t = (bb * s + ff) / ee;
      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -cc / aa));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (bb - cc) / aa));
      }
    }
  }
  return distance(
    { x: p1.x + d1.x * s, y: p1.y + d1.y * s, z: p1.z + d1.z * s },
    { x: p2.x + d2.x * t, y: p2.y + d2.y * t, z: p2.z + d2.z * t },
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a simulation request before submission.
 * Returns issues sorted by severity (errors first).
 */
export function validateSimulationRequest(
  wires: WireGeometry[],
  excitations: Excitation[],
  ground: GroundConfig,
  frequency: FrequencyRange,
  loads: LumpedLoad[] = [],
  transmissionLines: TransmissionLine[] = [],
  frequencySegments: FrequencySegment[] = [],
  geometryGroundFlag?: GeometryGroundFlag,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const activeFrequencyRanges = frequencySegments.length > 0 ? frequencySegments : [frequency];

  if (ground.type === "custom") {
    const permittivity = ground.custom_permittivity;
    const conductivity = ground.custom_conductivity;
    if (!Number.isFinite(permittivity) || !Number.isFinite(conductivity) || (permittivity ?? 0) < 1 || (conductivity ?? -1) < 0) {
      issues.push({
        severity: "error",
        code: "ground_parameters_invalid",
        message: "Custom ground requires finite relative permittivity of at least 1 and non-negative conductivity.",
      });
    }
  }

  if (geometryGroundFlag !== undefined) {
    const electromagneticGroundPresent = ground.type !== "free_space";
    if ((geometryGroundFlag !== 0) !== electromagneticGroundPresent) {
      issues.push({
        severity: "error",
        code: "geometry_ground_flag_conflict",
        message: `GE ${geometryGroundFlag} conflicts with ${ground.type === "free_space" ? "free space" : "the selected electromagnetic ground"}. Use GE 0 for free space and GE -1 or GE 1 when ground is present.`,
      });
    }
    const touchesGround = wires.some(
      (wire) => Math.abs(wire.z1) <= GEOMETRY_TOLERANCE_M || Math.abs(wire.z2) <= GEOMETRY_TOLERANCE_M,
    );
    if (geometryGroundFlag === 1 && !touchesGround) {
      issues.push({
        severity: "warning",
        code: "geometry_ground_contact_unused",
        message: "GE 1 enables ground-contact current interpolation, but no wire endpoint is on z=0. GE -1 is normally clearer for elevated geometry.",
      });
    } else if (geometryGroundFlag === -1 && touchesGround) {
      issues.push({
        severity: "warning",
        code: "geometry_ground_contact_disabled",
        message: "A wire endpoint touches z=0 while GE -1 disables ground-contact current interpolation; verify this is intentional.",
      });
    }
  }

  // 1. No wires
  if (wires.length === 0) {
    issues.push({
      severity: "error",
      code: "no_wires",
      message: "No wires defined. Add at least one wire to simulate.",
    });
  }

  // 2. No excitation
  if (excitations.length === 0) {
    issues.push({
      severity: "error",
      code: "no_excitation",
      message: "No excitation source defined. Add a feedpoint to at least one wire.",
    });
  }

  // 3. Excitation references non-existent wire
  const wireTags = new Set(wires.map((w) => w.tag));
  if (wireTags.size !== wires.length) {
    const duplicates = [...new Set(wires.map((wire) => wire.tag).filter((tag, index, tags) => tags.indexOf(tag) !== index))];
    issues.push({
      severity: "error",
      code: "duplicate_wire_tag",
      message: `Wire tags must be unique. Duplicate tag${duplicates.length === 1 ? "" : "s"}: ${duplicates.join(", ")}.`,
      wireTags: duplicates,
    });
  }
  for (const exc of excitations) {
    if (!wireTags.has(exc.wire_tag)) {
      issues.push({
        severity: "error",
        code: "excitation_orphan",
        message: `Excitation references wire tag ${exc.wire_tag} which does not exist.`,
        wireTags: [exc.wire_tag],
      });
    }
  }

  // 4. Excitation segment out of range
  for (const exc of excitations) {
    const wire = wires.find((w) => w.tag === exc.wire_tag);
    if (wire && (!Number.isInteger(exc.segment) || exc.segment < 1 || exc.segment > wire.segments)) {
      issues.push({
        severity: "error",
        code: "excitation_segment_range",
        message: `Excitation on wire ${exc.wire_tag} references invalid segment ${exc.segment}; valid segments are 1-${wire.segments}.`,
        wireTags: [exc.wire_tag],
      });
    }
  }

  const sourcePositions = new Set<string>();
  for (const source of excitations) {
    const key = `${source.wire_tag}:${source.segment}`;
    if (sourcePositions.has(key)) {
      issues.push({
        severity: "error",
        code: "duplicate_excitation",
        message: `More than one voltage source is placed on wire ${source.wire_tag}, segment ${source.segment}.`,
        wireTags: [source.wire_tag],
      });
    }
    sourcePositions.add(key);
    if (!Number.isFinite(source.voltage_real) || !Number.isFinite(source.voltage_imag)) {
      issues.push({
        severity: "error",
        code: "excitation_non_finite",
        message: `Excitation on wire ${source.wire_tag} has a non-finite voltage.`,
        wireTags: [source.wire_tag],
      });
    }
  }

  // An NEC voltage source is applied across a segment. A source placed at the
  // end of an otherwise isolated wire is often an incomplete representation
  // of an end-fed system unless a counterpoise, feed line, or ground return is
  // modelled. This is advisory because some advanced models are intentional.
  for (const source of excitations) {
    const wire = wires.find((candidate) => candidate.tag === source.wire_tag);
    if (!wire || (source.segment !== 1 && source.segment !== wire.segments)) continue;
    const atStart = source.segment === 1;
    const point = atStart
      ? { x: wire.x1, y: wire.y1, z: wire.z1 }
      : { x: wire.x2, y: wire.y2, z: wire.z2 };
    const hasWireReturn = wires.some((candidate) => candidate.tag !== wire.tag && [
      { x: candidate.x1, y: candidate.y1, z: candidate.z1 },
      { x: candidate.x2, y: candidate.y2, z: candidate.z2 },
    ].some((endpoint) => Math.hypot(endpoint.x - point.x, endpoint.y - point.y, endpoint.z - point.z) <= 1e-6));
    const hasGroundReturn = ground.type !== "free_space" && Math.abs(point.z) <= 1e-6;
    const hasTransmissionLineReturn = transmissionLines.some((line) =>
      (line.wire_tag1 === wire.tag && line.segment1 === source.segment) ||
      (line.wire_tag2 === wire.tag && line.segment2 === source.segment));
    if (!hasWireReturn && !hasGroundReturn && !hasTransmissionLineReturn) {
      issues.push({
        severity: "warning",
        code: "end_feed_return_path",
        message: `Source on wire ${wire.tag}, segment ${source.segment} is at an isolated wire end. Verify that the model includes the intended counterpoise, feed-line/common-mode path, second conductor, or ground return.`,
        wireTags: [wire.tag],
      });
    }
  }

  // 5. Zero-length wires
  for (const w of wires) {
    const values = [w.x1, w.y1, w.z1, w.x2, w.y2, w.z2, w.radius, w.segments];
    if (values.some((value) => !Number.isFinite(value))) {
      issues.push({
        severity: "error",
        code: "wire_non_finite",
        message: `Wire ${w.tag} contains a non-finite coordinate, radius, or segment count.`,
        wireTags: [w.tag],
      });
      continue;
    }
    if (!Number.isInteger(w.segments) || w.segments < 1) {
      issues.push({
        severity: "error",
        code: "invalid_segment_count",
        message: `Wire ${w.tag} must have a positive integer segment count.`,
        wireTags: [w.tag],
      });
    }
    if (w.radius <= 0) {
      issues.push({
        severity: "error",
        code: "invalid_wire_radius",
        message: `Wire ${w.tag} radius must be greater than zero.`,
        wireTags: [w.tag],
      });
    }
    if (wireLength(w) < 1e-6) {
      issues.push({
        severity: "error",
        code: "zero_length_wire",
        message: `Wire ${w.tag} has zero or near-zero length. Remove it or adjust endpoints.`,
        wireTags: [w.tag],
      });
    }
  }

  // 6. Lambda/10 segmentation check
  const maxFreq = Math.max(...activeFrequencyRanges.flatMap((range) => [range.start_mhz, range.stop_mhz]));
  const wavelength = 300 / maxFreq; // metres
  const maxSegLen = wavelength / 10;
  for (const w of wires) {
    const len = wireLength(w);
    if (len < 1e-6) continue; // already flagged
    if (!Number.isInteger(w.segments) || w.segments < 1) continue;
    const segLen = len / w.segments;
    if (segLen > maxSegLen * 1.5) {
      // Allow 50% over before warning
      issues.push({
        severity: "warning",
        code: "segment_too_long",
        message: `Wire ${w.tag} segments are ${segLen.toFixed(3)}m long, exceeding lambda/10 (${maxSegLen.toFixed(3)}m) at ${maxFreq} MHz. Increase segments for accurate results.`,
        wireTags: [w.tag],
      });
    }
  }

  // 7. Wire radius ratio check (NEC2 guideline: radius < segment_length / 2)
  for (const w of wires) {
    const len = wireLength(w);
    if (len < 1e-6) continue;
    if (!Number.isInteger(w.segments) || w.segments < 1 || w.radius <= 0) continue;
    const segLen = len / w.segments;
    if (w.radius > segLen / 2) {
      issues.push({
        severity: "warning",
        code: "radius_too_large",
        message: `Wire ${w.tag} radius (${(w.radius * 1000).toFixed(1)}mm) exceeds half its segment length (${(segLen * 500).toFixed(1)}mm). This may cause inaccurate results.`,
        wireTags: [w.tag],
      });
    }
  }

  // 8. Wires below ground with non-free-space ground
  if (ground.type !== "free_space") {
    const belowGround: number[] = [];
    for (const w of wires) {
      if (w.z1 < -0.001 || w.z2 < -0.001) {
        belowGround.push(w.tag);
      }
    }
    const crossings = wires.filter((wire) =>
      (wire.z1 < -GEOMETRY_TOLERANCE_M && wire.z2 > GEOMETRY_TOLERANCE_M) ||
      (wire.z2 < -GEOMETRY_TOLERANCE_M && wire.z1 > GEOMETRY_TOLERANCE_M),
    );
    if (crossings.length > 0) {
      issues.push({
        severity: "error",
        code: "ground_intersection",
        message: `Wire${crossings.length === 1 ? "" : "s"} ${crossings.map((wire) => wire.tag).join(", ")} cross the ground plane. Split or reposition the geometry; buried-wire modelling is not supported.`,
        wireTags: crossings.map((wire) => wire.tag),
      });
    }
    if (belowGround.length > 0) {
      issues.push({
        severity: "error",
        code: "wires_below_ground",
        message: `${belowGround.length} wire(s) extend below ground (Z<0). NEC2 does not support buried wires with this ground model. Raise them above Z=0 or use free space.`,
        wireTags: belowGround,
      });
    }
  }

  // 9. All wires at Z=0 with ground model (likely produces no radiation)
  if (ground.type !== "free_space" && wires.length > 0) {
    const allAtGround = wires.every(
      (w) => Math.abs(w.z1) < 0.001 && Math.abs(w.z2) < 0.001
    );
    if (allAtGround) {
      issues.push({
        severity: "warning",
        code: "all_wires_at_ground",
        message: "All wires are at ground level (Z=0). The antenna may show no radiation. Raise it above ground.",
      });
    }
  }

  // 10. Total segment count
  const totalSegments = wires.reduce((sum, w) => sum + w.segments, 0);
  if (totalSegments > 2000) {
    issues.push({
      severity: "warning",
      code: "high_segment_count",
      message: `Total segment count is ${totalSegments}. Simulations with >2000 segments may be slow.`,
    });
  }
  if (totalSegments > 10000) {
    issues.push({
      severity: "error",
      code: "segment_limit",
      message: `Total segment count is ${totalSegments}, exceeding the 10000-segment limit. Reduce wire count or segment density.`,
    });
  }

  // 11. Frequency range validation
  if (!Number.isFinite(frequency.start_mhz) || !Number.isFinite(frequency.stop_mhz)) {
    issues.push({
      severity: "error",
      code: "frequency_non_finite",
      message: "Frequency values must be finite.",
    });
  } else if (frequency.start_mhz > frequency.stop_mhz || (frequency.steps > 1 && frequency.start_mhz === frequency.stop_mhz)) {
    issues.push({
      severity: "error",
      code: "frequency_range_invalid",
      message: "Start frequency must not exceed stop frequency, and a sweep needs a non-zero span.",
    });
  }
  if (!Number.isInteger(frequency.steps) || frequency.steps < 1) {
    issues.push({
      severity: "error",
      code: "frequency_steps_invalid",
      message: "Number of frequency steps must be at least 1.",
    });
  }

  // 12. Loads and transmission-line attachment points
  for (const load of loads) {
    const wire = wires.find((candidate) => candidate.tag === load.wire_tag);
    const appliesToAllSegments = load.wire_tag === 0 && load.segment_start === 0 && load.segment_end === 0;
    const appliesToWholeWire = Boolean(wire) && load.segment_start === 0 && load.segment_end === 0;
    if (!wire && !appliesToAllSegments) {
      issues.push({ severity: "error", code: "load_orphan", message: `Load references missing wire ${load.wire_tag}.`, wireTags: [load.wire_tag] });
      continue;
    }
    if (![0, 1, 4, 5].includes(load.load_type)) {
      issues.push({ severity: "error", code: "load_type_unsupported", message: `Load on wire ${load.wire_tag} uses unsupported NEC LD type ${load.load_type}.`, wireTags: [load.wire_tag] });
    }
    if (!appliesToAllSegments && !appliesToWholeWire && wire && (!Number.isInteger(load.segment_start) || !Number.isInteger(load.segment_end) || load.segment_start < 1 || load.segment_end < load.segment_start || load.segment_end > wire.segments)) {
      issues.push({ severity: "error", code: "load_segment_range", message: `Load on wire ${load.wire_tag} has invalid segment range ${load.segment_start}-${load.segment_end}; use 0-0 for all segments or 1-${wire.segments}.`, wireTags: [load.wire_tag] });
    }
    if (![load.param1, load.param2, load.param3].every(Number.isFinite)) {
      issues.push({ severity: "error", code: "load_non_finite", message: `Load on wire ${load.wire_tag} has a non-finite parameter.`, wireTags: [load.wire_tag] });
    }
    const physicalParameters = load.load_type === 0 || load.load_type === 1
      ? [load.param1, load.param2, load.param3]
      : load.load_type === 5
        ? [load.param1]
        : [];
    if (physicalParameters.some((value) => value < 0)) {
      issues.push({ severity: "error", code: "load_negative_parameter", message: `Load on wire ${load.wire_tag} requires non-negative physical parameters.`, wireTags: [load.wire_tag] });
    }
  }
  for (const range of activeFrequencyRanges) {
    if (range.start_mhz < MIN_FREQUENCY_MHZ || range.stop_mhz > MAX_FREQUENCY_MHZ) {
      issues.push({
        severity: "error",
        code: "frequency_out_of_engine_range",
        message: `Frequency ${range.start_mhz}-${range.stop_mhz} MHz is outside the supported ${MIN_FREQUENCY_MHZ}-${MAX_FREQUENCY_MHZ} MHz engine range. It was not clamped.`,
      });
    }
    if (!Number.isFinite(range.start_mhz) || !Number.isFinite(range.stop_mhz) || !Number.isInteger(range.steps) || range.steps < 1 || range.start_mhz > range.stop_mhz || (range.steps > 1 && range.start_mhz === range.stop_mhz)) {
      issues.push({
        severity: "error",
        code: "frequency_segment_invalid",
        message: `Frequency block ${range.start_mhz}-${range.stop_mhz} MHz with ${range.steps} steps is invalid.`,
      });
    }
  }

  for (const line of transmissionLines) {
    for (const endpoint of [
      { wireTag: line.wire_tag1, segment: line.segment1 },
      { wireTag: line.wire_tag2, segment: line.segment2 },
    ]) {
      const wire = wires.find((candidate) => candidate.tag === endpoint.wireTag);
      if (!wire || !Number.isInteger(endpoint.segment) || endpoint.segment < 1 || endpoint.segment > wire.segments) {
        issues.push({ severity: "error", code: "transmission_line_endpoint", message: `Transmission-line endpoint wire ${endpoint.wireTag}, segment ${endpoint.segment} is invalid.`, wireTags: [endpoint.wireTag] });
      }
    }
    const admittances = [
      line.shunt_admittance_real1 ?? 0,
      line.shunt_admittance_imag1 ?? 0,
      line.shunt_admittance_real2 ?? 0,
      line.shunt_admittance_imag2 ?? 0,
    ];
    if (!Number.isFinite(line.impedance) || Math.abs(line.impedance) < 1 || !Number.isFinite(line.length) || line.length < 0 || !admittances.every(Number.isFinite)) {
      issues.push({ severity: "error", code: "transmission_line_parameter", message: "Transmission-line |impedance| must be at least 1 ohm (negative selects NEC's crossed-line convention), and length must be non-negative." });
    }
  }

  // 13. Connectivity, duplicate/overlapping geometry, and interior crossings.
  const parent = wires.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]!));
  const unite = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };
  const pairLimit = Math.min(wires.length, PAIRWISE_WIRE_LIMIT);
  for (let i = 0; i < pairLimit; i++) {
    for (let j = i + 1; j < pairLimit; j++) {
      const a = wires[i]!;
      const b = wires[j]!;
      const connectedAtEndpoint = hasCoincidentEndpoint(a, b);
      if (connectedAtEndpoint) unite(i, j);
      const overlap = collinearOverlap(a, b);
      if (overlap > GEOMETRY_TOLERANCE_M) {
        const aLength = wireLength(a);
        const bLength = wireLength(b);
        const duplicate = Math.abs(overlap - aLength) <= GEOMETRY_TOLERANCE_M && Math.abs(overlap - bLength) <= GEOMETRY_TOLERANCE_M;
        issues.push({
          severity: "error",
          code: duplicate ? "overlapping_wires" : "overlapping_segments",
          message: duplicate
            ? `Wires ${a.tag} and ${b.tag} duplicate the same geometry.`
            : `Wires ${a.tag} and ${b.tag} overlap collinearly by ${overlap.toPrecision(4)} m. Split or remove the overlap before solving.`,
          wireTags: [a.tag, b.tag],
        });
      } else if (!connectedAtEndpoint && segmentDistance(a, b) <= GEOMETRY_TOLERANCE_M) {
        issues.push({
          severity: "warning",
          code: "interior_wire_intersection",
          message: `Wires ${a.tag} and ${b.tag} intersect away from a shared endpoint. NEC connectivity can depend on exact segment junction placement; split and connect them explicitly if an electrical junction is intended.`,
          wireTags: [a.tag, b.tag],
        });
      }
    }
  }
  if (wires.length > pairLimit) {
    issues.push({ severity: "warning", code: "pair_validation_limited", message: `Pairwise overlap and connectivity checks were limited to the first ${pairLimit} wires for responsiveness.` });
  }
  if (wires.length > 1) {
    const groups = new Map<number, number[]>();
    for (let index = 0; index < pairLimit; index++) {
      const root = find(index);
      const tags = groups.get(root) ?? [];
      tags.push(wires[index]!.tag);
      groups.set(root, tags);
    }
    if (groups.size > 1) {
      issues.push({
        severity: "warning",
        code: "disconnected_wire_groups",
        message: `Geometry contains ${groups.size} electrically disconnected endpoint groups. This can be intentional for parasitic elements; otherwise connect coincident endpoints explicitly.`,
        wireTags: [...groups.values()].flat(),
      });
    }
  }

  // Sort: errors first, then warnings, then info
  const severityOrder: Record<ValidationSeverity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    issues,
    valid: errorCount === 0,
    errorCount,
    warningCount,
  };
}
