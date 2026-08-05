import type { SegmentCurrent } from "../../api/nec";
import type { CurrentVisualData, CurrentVisualWire, ParametricCurrentPoint } from "./types";

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

export function adaptParametricCurrents(
  wires: Array<{ id: string; startM: { x: number; y: number; z: number }; endM: { x: number; y: number; z: number }; diameterM?: number }>,
  points: ParametricCurrentPoint[],
): CurrentVisualData {
  const pointsByWire = new Map<string, ParametricCurrentPoint[]>();
  for (const point of points) {
    const list = pointsByWire.get(point.wireId) ?? [];
    list.push(point);
    pointsByWire.set(point.wireId, list);
  }
  const currentWires: CurrentVisualWire[] = wires.map((wire, index) => ({
    id: wire.id,
    tag: pointsByWire.get(wire.id)?.[0]?.tag ?? index + 1,
    startM: { ...wire.startM },
    endM: { ...wire.endM },
    radiusM: wire.diameterM ? wire.diameterM / 2 : undefined,
  }));
  const wireMap = new Map(wires.map((wire) => [wire.id, wire]));
  const currents: SegmentCurrent[] = points.map((point) => {
    const wire = wireMap.get(point.wireId);
    if (!wire) throw new Error(`Current segment references unknown wire "${point.wireId}".`);
    const fraction = finite(point.fractionAlongWire, "Current fraction");
    if (fraction < 0 || fraction > 1) throw new Error(`Current segment ${point.segment} lies outside wire "${point.wireId}".`);
    const phaseRad = finite(point.phaseDeg, "Current phase") * Math.PI / 180;
    const magnitude = finite(point.magnitudeA, "Current magnitude");
    return {
      tag: point.tag,
      segment: point.segment,
      x: wire.startM.x + (wire.endM.x - wire.startM.x) * fraction,
      y: wire.startM.y + (wire.endM.y - wire.startM.y) * fraction,
      z: wire.startM.z + (wire.endM.z - wire.startM.z) * fraction,
      current_real: magnitude * Math.cos(phaseRad),
      current_imag: magnitude * Math.sin(phaseRad),
      current_magnitude: magnitude,
      current_phase_deg: point.phaseDeg,
    };
  });
  return { wires: currentWires, currents, source: "nec-solver" };
}

export function adaptExplicitCurrents(wires: CurrentVisualWire[], currents: SegmentCurrent[]): CurrentVisualData {
  return { wires, currents, source: "nec-solver" };
}

export function adaptPositionedCurrents(points: Array<{ wireId: string; tag: number; segment: number; positionM: { x: number; y: number; z: number }; magnitudeA: number; phaseDeg: number }>): CurrentVisualData {
  const groups = new Map<string, typeof points>();
  for (const point of points) groups.set(point.wireId, [...(groups.get(point.wireId) ?? []), point]);
  for (const values of groups.values()) values.sort((a, b) => a.segment - b.segment);
  const wires: CurrentVisualWire[] = [...groups.entries()].map(([wireId, values]) => ({
    id: wireId, tag: values[0]!.tag,
    startM: { ...values[0]!.positionM },
    endM: { ...values[values.length - 1]!.positionM },
  }));
  const currents: SegmentCurrent[] = points.map((point) => {
    const phase = point.phaseDeg * Math.PI / 180;
    return { tag: point.tag, segment: point.segment, ...point.positionM, current_real: point.magnitudeA * Math.cos(phase), current_imag: point.magnitudeA * Math.sin(phase), current_magnitude: point.magnitudeA, current_phase_deg: point.phaseDeg };
  });
  return { wires, currents, source: "nec-solver" };
}
