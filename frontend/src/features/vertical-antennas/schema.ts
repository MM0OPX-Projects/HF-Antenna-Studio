import type { PatternData } from "../../api/nec";

export type VerticalConfiguration =
  | "ground-mounted-ideal"
  | "ground-mounted-explicit-radials"
  | "elevated-explicit-radials"
  | "nec-radial-screen-approximation";

export type VerticalGround =
  | { kind: "perfect" }
  | {
      kind: "sommerfeld-norton";
      conductivitySPerM: number;
      relativePermittivity: number;
    }
  | {
      kind: "reflection-coefficient";
      conductivitySPerM: number;
      relativePermittivity: number;
    };

export interface VerticalRadials {
  representation: "none" | "explicit-wires" | "nec-ground-screen";
  count: number;
  lengthM: number;
  droopAngleRad: number;
  diameterM: number;
}

export interface VerticalAntennaModel {
  schemaVersion: 1;
  kind: "quarter-wave-vertical-system";
  configuration: VerticalConfiguration;
  frequencyHz: number;
  radiatorLengthM: number;
  radiatorDiameterM: number;
  baseHeightM: number;
  radials: VerticalRadials;
  ground: VerticalGround;
  referenceImpedanceOhm: 50 | 75;
  provenance: {
    dimensionsAreStartingPoints: true;
    manualDimensions: boolean;
  };
}

export interface VerticalPoint3M { x: number; y: number; z: number }

export interface VerticalWire {
  id: string;
  family: "radiator" | "radial";
  startM: VerticalPoint3M;
  endM: VerticalPoint3M;
  diameterM: number;
}

export interface VerticalIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface GeneratedVerticalModel {
  model: VerticalAntennaModel;
  wires: VerticalWire[];
  issues: VerticalIssue[];
}

export interface SegmentedVerticalWire extends VerticalWire {
  tag: number;
  segments: number;
  segmentLengthM: number;
}

export interface VerticalSegmentation {
  wires: SegmentedVerticalWire[];
  totalSegments: number;
  feed: { tag: 1; segment: 1 };
  issues: VerticalIssue[];
}

export interface VerticalPatternPoint {
  angleDeg: number;
  gainDbi: number;
  normalizedDb: number;
}

export interface VerticalCurrentPoint {
  wireId: string;
  family: "radiator" | "radial";
  tag: number;
  segment: number;
  fractionAlongWire: number;
  distanceFromFeedM: number;
  magnitudeA: number;
  normalizedMagnitude: number;
  phaseDeg: number;
  positionM: VerticalPoint3M;
}

export interface VerticalSolverResult {
  resistanceOhm: number;
  reactanceOhm: number;
  swr: number;
  maximumGainDbi: number;
  takeOffAngleDeg: number;
  azimuthVariationDb: number;
  azimuthPattern: VerticalPatternPoint[];
  elevationPattern: VerticalPatternPoint[];
  radiationPattern: PatternData;
  currentDistribution: VerticalCurrentPoint[];
  generatedNec: string;
  engine: string;
  computedInMs: number;
  warnings: string[];
}
