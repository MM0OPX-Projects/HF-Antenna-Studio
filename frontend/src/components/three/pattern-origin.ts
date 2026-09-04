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
