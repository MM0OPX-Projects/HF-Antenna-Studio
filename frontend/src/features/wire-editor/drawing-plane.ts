export type DrawingPlane = "xz" | "yz" | "xy";

interface PlaneDefinition {
  label: string;
  description: string;
  horizontal: "x" | "y";
  vertical: "y" | "z";
  fixed: "x" | "y" | "z";
}

export interface DrawingPoint3 { x: number; y: number; z: number }
export interface DrawingPoint2 { u: number; v: number }

export const DRAWING_PLANES: Record<DrawingPlane, PlaneDefinition> = {
  xz: { label: "Front X/Z", description: "height view", horizontal: "x", vertical: "z", fixed: "y" },
  yz: { label: "Side Y/Z", description: "height view", horizontal: "y", vertical: "z", fixed: "x" },
  xy: { label: "Top X/Y", description: "ground plan", horizontal: "x", vertical: "y", fixed: "z" },
};

export function projectPoint(point: DrawingPoint3, plane: DrawingPlane): DrawingPoint2 {
  const definition = DRAWING_PLANES[plane];
  return { u: point[definition.horizontal], v: point[definition.vertical] };
}

export function expandPoint(point: DrawingPoint2, plane: DrawingPlane, fixedCoordinate: number): DrawingPoint3 {
  const definition = DRAWING_PLANES[plane];
  return {
    x: definition.fixed === "x" ? fixedCoordinate : definition.horizontal === "x" ? point.u : point.v,
    y: definition.fixed === "y" ? fixedCoordinate : definition.horizontal === "y" ? point.u : point.v,
    z: definition.fixed === "z" ? fixedCoordinate : point.v,
  };
}

export function endpointFromLengthAngle(
  start: DrawingPoint2,
  lengthM: number,
  angleDeg: number,
): DrawingPoint2 {
  const length = Math.max(0, Number.isFinite(lengthM) ? lengthM : 0);
  const radians = (Number.isFinite(angleDeg) ? angleDeg : 0) * Math.PI / 180;
  return {
    u: start.u + length * Math.cos(radians),
    v: start.v + length * Math.sin(radians),
  };
}
