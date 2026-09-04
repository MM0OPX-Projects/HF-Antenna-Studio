import type { Excitation, WireGeometry } from "../../templates/types";
import { requestedFeedpointPosition } from "../../features/wire-editor/feedpoint";

/** Visual pattern origin. This never changes NEC geometry or results. */
export function patternOriginForExcitations(
  wires: WireGeometry[],
  excitations: Excitation[],
): [number, number, number] | null {
  const positions = excitations.flatMap((source) => {
    const wire = wires.find((candidate) => candidate.tag === source.wire_tag);
    return wire ? [requestedFeedpointPosition(source, wire)] : [];
  });
  if (positions.length === 0) return null;
  const total = positions.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y, z: sum.z + point.z }),
    { x: 0, y: 0, z: 0 },
  );
  const count = positions.length;
  return [total.x / count, total.z / count, -total.y / count];
}

/**
 * Return a visual-only radiation reference at the lowest physical antenna
 * point. NEC far-field patterns have no emission origin; this anchor prevents
 * a centre-fed or elevated source from making the surface appear detached
 * from the antenna. Coordinates returned are Three.js [x, z, -y].
 */
export function patternOriginForGeometry(wires: WireGeometry[]): [number, number, number] | null {
  if (wires.length === 0) return null;
  const points = wires.flatMap((wire) => [
    { x: wire.x1, y: wire.y1, z: wire.z1 },
    { x: wire.x2, y: wire.y2, z: wire.z2 },
  ]);
  const lowestZ = Math.min(...points.map((point) => point.z));
  const lowest = points.filter((point) => Math.abs(point.z - lowestZ) <= 1e-9);
  const mean = lowest.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return [mean.x / lowest.length, lowestZ, -(mean.y / lowest.length)];
}
