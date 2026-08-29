export interface G3txqHexbeamPointM {
  x: number;
  y: number;
  z: number;
}

export interface G3txqHexbeamDimensions {
  drivenHalfLengthM: number;
  reflectorTotalLengthM: number;
  endSpacingM: number;
  feedGapM: number;
  heightM: number;
}

export type G3txqHexbeamConductorFamily = "driven" | "reflector";

export interface G3txqHexbeamSection {
  id: string;
  family: G3txqHexbeamConductorFamily;
  startM: G3txqHexbeamPointM;
  endM: G3txqHexbeamPointM;
  source?: true;
}

export interface G3txqHexbeamSupport {
  id: string;
  startM: G3txqHexbeamPointM;
  endM: G3txqHexbeamPointM;
}

export interface G3txqHexbeamGeometry {
  sections: G3txqHexbeamSection[];
  supports: G3txqHexbeamSupport[];
  frameRadiusM: number;
  drivenOuterLegM: number;
  reflectorTipOffsetM: number;
  canonical: boolean;
}

const SQRT_THREE = Math.sqrt(3);

function distance(a: G3txqHexbeamPointM, b: G3txqHexbeamPointM): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function pointAlong(a: G3txqHexbeamPointM, b: G3txqHexbeamPointM, distanceM: number): G3txqHexbeamPointM {
  const lengthM = distance(a, b);
  const fraction = lengthM === 0 ? 0 : distanceM / lengthM;
  return {
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
    z: a.z + (b.z - a.z) * fraction,
  };
}

function solveFrameRadius(dimensions: G3txqHexbeamDimensions): number {
  const { drivenHalfLengthM, reflectorTotalLengthM, endSpacingM, feedGapM } = dimensions;
  const residual = (radiusM: number) => {
    const innerLegM = Math.hypot(radiusM / 2 - feedGapM / 2, SQRT_THREE * radiusM / 2);
    const drivenOuterLegM = drivenHalfLengthM - feedGapM / 2 - innerLegM;
    const reflectorTipOffsetM = drivenOuterLegM + endSpacingM;
    return 5 * radiusM - 2 * reflectorTipOffsetM - reflectorTotalLengthM;
  };

  let low = Math.max(feedGapM * 0.5, 1e-6);
  let high = Math.max(drivenHalfLengthM, reflectorTotalLengthM, endSpacingM, feedGapM, 1) * 4;
  while (residual(high) < 0 && high < 1e6) high *= 2;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const mid = (low + high) / 2;
    if (residual(mid) < 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * Builds the single-band G3TXQ broadband Hexbeam wire path in plan view.
 *
 * The driven element retains the classic M shape. The reflector follows five
 * consecutive sides of the regular hexagonal support perimeter, with the two
 * element tips separated along the remaining front-side edges. The frame
 * radius is derived from the three published electrical dimensions so every
 * requested wire length and both tip gaps remain exact.
 */
export function buildG3txqBroadbandHexbeam(dimensions: G3txqHexbeamDimensions): G3txqHexbeamGeometry {
  const radiusM = solveFrameRadius(dimensions);
  const z = dimensions.heightM;
  const centre = { x: 0, y: 0, z };
  const feedLeft = { x: -dimensions.feedGapM / 2, y: 0, z };
  const feedRight = { x: dimensions.feedGapM / 2, y: 0, z };
  const frontLeft = { x: -radiusM / 2, y: SQRT_THREE * radiusM / 2, z };
  const frontRight = { x: radiusM / 2, y: SQRT_THREE * radiusM / 2, z };
  const left = { x: -radiusM, y: 0, z };
  const right = { x: radiusM, y: 0, z };
  const rearLeft = { x: -radiusM / 2, y: -SQRT_THREE * radiusM / 2, z };
  const rearRight = { x: radiusM / 2, y: -SQRT_THREE * radiusM / 2, z };

  const drivenInnerLegM = distance(feedLeft, frontLeft);
  const drivenOuterLegM = dimensions.drivenHalfLengthM - dimensions.feedGapM / 2 - drivenInnerLegM;
  const reflectorTipOffsetM = drivenOuterLegM + dimensions.endSpacingM;
  const driverLeftTip = pointAlong(frontLeft, left, drivenOuterLegM);
  const driverRightTip = pointAlong(frontRight, right, drivenOuterLegM);
  const reflectorLeftTip = pointAlong(frontLeft, left, reflectorTipOffsetM);
  const reflectorRightTip = pointAlong(frontRight, right, reflectorTipOffsetM);

  const sections: G3txqHexbeamSection[] = [
    { id: "driven-feed", family: "driven", startM: feedLeft, endM: feedRight, source: true },
    { id: "driven-left-inner", family: "driven", startM: feedLeft, endM: frontLeft },
    { id: "driven-left-outer", family: "driven", startM: frontLeft, endM: driverLeftTip },
    { id: "driven-right-inner", family: "driven", startM: feedRight, endM: frontRight },
    { id: "driven-right-outer", family: "driven", startM: frontRight, endM: driverRightTip },
    { id: "reflector-left-tip", family: "reflector", startM: reflectorLeftTip, endM: left },
    { id: "reflector-left-side", family: "reflector", startM: left, endM: rearLeft },
    { id: "reflector-rear", family: "reflector", startM: rearLeft, endM: rearRight },
    { id: "reflector-right-side", family: "reflector", startM: rearRight, endM: right },
    { id: "reflector-right-tip", family: "reflector", startM: right, endM: reflectorRightTip },
  ];

  const vertices = [frontRight, frontLeft, left, rearLeft, rearRight, right];
  const supports: G3txqHexbeamSupport[] = [
    ...vertices.map((vertex, index) => ({ id: `spreader-${index + 1}`, startM: centre, endM: vertex })),
    ...vertices.map((vertex, index) => ({ id: `perimeter-${index + 1}`, startM: vertex, endM: vertices[(index + 1) % vertices.length]! })),
  ];

  return {
    sections,
    supports,
    frameRadiusM: radiusM,
    drivenOuterLegM,
    reflectorTipOffsetM,
    canonical: Number.isFinite(radiusM)
      && drivenOuterLegM > 0
      && reflectorTipOffsetM > drivenOuterLegM
      && reflectorTipOffsetM < radiusM,
  };
}

export function g3txqFeedGapM(wavelengthM: number, wireDiameterM: number): number {
  return Math.max(wireDiameterM * 6, wavelengthM * 0.002);
}
