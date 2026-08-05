import type { GroundConfig, WireGeometry } from "../templates/types";

export type GeometryGroundFlag = -1 | 0 | 1;

const GROUND_TOLERANCE_M = 1e-6;

/**
 * Resolve NEC's GE geometry-ground flag for editor models.
 *
 * Explicit imported/user values always win. Automatic mode uses GE 0 in
 * free space, GE 1 when geometry touches z=0, and GE -1 for elevated
 * geometry above an electromagnetic ground.
 */
export function resolveGeometryGroundFlag(
  wires: readonly WireGeometry[],
  ground: GroundConfig,
  explicit: GeometryGroundFlag | null | undefined,
): GeometryGroundFlag {
  if (explicit !== null && explicit !== undefined) return explicit;
  if (ground.type === "free_space") return 0;
  const touchesGround = wires.some(
    (wire) => Math.abs(wire.z1) <= GROUND_TOLERANCE_M || Math.abs(wire.z2) <= GROUND_TOLERANCE_M,
  );
  return touchesGround ? 1 : -1;
}
