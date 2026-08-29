import type { PatternData } from "../../api/nec";

export type LoopBeamGround =
  | { kind: "perfect" }
  | { kind: "sommerfeld-norton"; conductivitySPerM: number; relativePermittivity: number };

interface CommonModel {
  schemaVersion: 1;
  frequencyHz: number;
  elementDiameterM: number;
  ground: LoopBeamGround;
  referenceImpedanceOhm: 50 | 75;
  provenance: { dimensionsAreStartingPoints: true; manualDimensions: boolean; reference?: string };
}

export interface SquareLoopModel extends CommonModel {
  kind: "square-loop";
  sideLengthM: number;
  bottomHeightM: number;
}

export type DeltaFeedLocation = "bottom" | "lower-corner" | "side-region";

export interface DeltaLoopModel extends CommonModel {
  kind: "delta-loop";
  baseWidthM: number;
  loopHeightM: number;
  apexOffsetM: number;
  bottomHeightM: number;
  feedLocation: DeltaFeedLocation;
}

export interface DiamondLoopModel extends CommonModel {
  kind: "diamond-loop";
  widthM: number;
  loopHeightM: number;
  bottomHeightM: number;
}

export interface CubicalQuadModel extends CommonModel {
  kind: "cubical-quad";
  loopCount: 2 | 3 | 4;
  drivenPerimeterM: number;
  reflectorPerimeterM: number;
  directorPerimetersM: number[];
  reflectorSpacingM: number;
  directorSpacingsM: number[];
  centreHeightM: number;
}

export type HexBand = "20m" | "17m" | "15m" | "12m" | "10m";

export interface HexbeamModel extends CommonModel {
  kind: "hexbeam";
  band: HexBand;
  drivenHalfLengthM: number;
  reflectorTotalLengthM: number;
  endSpacingM: number;
  heightM: number;
}

export type LoopBeamModel = SquareLoopModel | DeltaLoopModel | DiamondLoopModel | CubicalQuadModel | HexbeamModel;
export type LoopBeamFamily = "driven" | "reflector" | "director";
export interface LoopBeamPoint3M { x: number; y: number; z: number }
export interface LoopBeamWire {
  id: string;
  family: LoopBeamFamily;
  startM: LoopBeamPoint3M;
  endM: LoopBeamPoint3M;
  diameterM: number;
  source?: true;
}
export interface LoopBeamSupport {
  id: string;
  startM: LoopBeamPoint3M;
  endM: LoopBeamPoint3M;
}
export interface LoopBeamIssue { severity: "error" | "warning"; code: string; message: string }
export interface GeneratedLoopBeamModel {
  model: LoopBeamModel;
  wires: LoopBeamWire[];
  supports: LoopBeamSupport[];
  feedWireId: string;
  feedConductorOrientation: "horizontal" | "vertical" | "sloping";
  intendedForwardAxis: "+Y" | null;
  issues: LoopBeamIssue[];
}
export interface SegmentedLoopBeamWire extends LoopBeamWire { tag: number; segments: number; segmentLengthM: number }
export interface LoopBeamSegmentation {
  wires: SegmentedLoopBeamWire[];
  totalSegments: number;
  feed: { tag: number; segment: number; wireId: string };
  issues: LoopBeamIssue[];
}
export interface LoopBeamPatternPoint { angleDeg: number; gainDbi: number; normalizedDb: number }
export interface LoopBeamCurrentPoint {
  wireId: string;
  family: LoopBeamFamily;
  tag: number;
  segment: number;
  fractionAlongWire: number;
  magnitudeA: number;
  normalizedMagnitude: number;
  phaseDeg: number;
  positionM: LoopBeamPoint3M;
}
export interface LoopBeamSolverResult {
  modelKey: string;
  resistanceOhm: number;
  reactanceOhm: number;
  swr: number;
  maximumGainDbi: number;
  takeOffAngleDeg: number;
  forwardGainDbi: number | null;
  rearGainDbi: number | null;
  frontToBackDb: number | null;
  frontToRearDb: number | null;
  beamwidthDeg: number | null;
  azimuthPattern: LoopBeamPatternPoint[];
  elevationPattern: LoopBeamPatternPoint[];
  radiationPattern: PatternData;
  currentDistribution: LoopBeamCurrentPoint[];
  generatedNec: string;
  engine: string;
  computedInMs: number;
  warnings: string[];
}
