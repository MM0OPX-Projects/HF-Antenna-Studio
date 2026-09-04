import type { Excitation, WireGeometry } from "../../templates/types";

export function clampFeedRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5;
  return Math.min(1, Math.max(0, ratio));
}

/** Return the 1-based NEC segment containing a requested proportional point. */
export function segmentForFeedRatio(ratio: number, segments: number): number {
  const count = Math.max(1, Math.round(segments));
  const clamped = clampFeedRatio(ratio);
  if (clamped >= 1) return count;
  return Math.min(count, Math.max(1, Math.floor(clamped * count) + 1));
}

/** Return the actual proportional position of the selected NEC segment centre. */
export function segmentCentreRatio(segment: number, segments: number): number {
  const count = Math.max(1, Math.round(segments));
  const selected = Math.min(count, Math.max(1, Math.round(segment)));
  return (selected - 0.5) / count;
}

export function requestedFeedRatio(source: Excitation, segments: number): number {
  return source.position_ratio === undefined
    ? segmentCentreRatio(source.segment, segments)
    : clampFeedRatio(source.position_ratio);
}

export function wireLengthM(wire: Pick<WireGeometry, "x1" | "y1" | "z1" | "x2" | "y2" | "z2">): number {
  return Math.hypot(wire.x2 - wire.x1, wire.y2 - wire.y1, wire.z2 - wire.z1);
}

export function feedpointPlacement(source: Excitation, wire: WireGeometry) {
  const requestedRatio = requestedFeedRatio(source, wire.segments);
  const actualRatio = segmentCentreRatio(source.segment, wire.segments);
  const lengthM = wireLengthM(wire);
  return {
    requestedRatio,
    actualRatio,
    requestedDistanceM: requestedRatio * lengthM,
    actualDistanceM: actualRatio * lengthM,
    placementErrorM: Math.abs(requestedRatio - actualRatio) * lengthM,
  };
}

/** Physical connection requested by the user. NEC still applies EX at the mapped segment centre. */
export function requestedFeedpointPosition(source: Excitation, wire: WireGeometry) {
  const ratio = requestedFeedRatio(source, wire.segments);
  return {
    x: wire.x1 + (wire.x2 - wire.x1) * ratio,
    y: wire.y1 + (wire.y2 - wire.y1) * ratio,
    z: wire.z1 + (wire.z2 - wire.z1) * ratio,
  };
}
