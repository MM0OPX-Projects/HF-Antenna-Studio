import type { PatternData } from "../../api/nec";

export type YagiGround =
  | { kind: "perfect" }
  | { kind: "sommerfeld-norton"; conductivitySPerM: number; relativePermittivity: number };

export interface YagiDirector {
  id: string;
  lengthM: number;
  spacingFromPreviousM: number;
}

export interface YagiAntennaModel {
  schemaVersion: 1;
  kind: "horizontal-yagi-uda";
  frequencyHz: number;
  drivenElementLengthM: number;
  reflectorLengthM: number;
  reflectorSpacingM: number;
  directors: YagiDirector[];
  boomHeightM: number;
  elementDiameterM: number;
  ground: YagiGround;
  referenceImpedanceOhm: 50 | 75;
  provenance: {
    dimensionsAreStartingPoints: true;
    manualDimensions: boolean;
  };
}

export interface YagiPoint3M { x: number; y: number; z: number }

export interface YagiWire {
  id: string;
  family: "reflector" | "driven" | "director";
  startM: YagiPoint3M;
  endM: YagiPoint3M;
  diameterM: number;
}

export interface YagiIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface GeneratedYagiModel {
  model: YagiAntennaModel;
  wires: YagiWire[];
  issues: YagiIssue[];
}

export interface SegmentedYagiWire extends YagiWire {
  tag: number;
  segments: number;
  segmentLengthM: number;
}

export interface YagiSegmentation {
  wires: SegmentedYagiWire[];
  totalSegments: number;
  feed: { tag: number; segment: number };
  issues: YagiIssue[];
}

export interface YagiPatternPoint {
  angleDeg: number;
  gainDbi: number;
  normalizedDb: number;
}

export interface YagiCurrentPoint {
  wireId: string;
  family: YagiWire["family"];
  tag: number;
  segment: number;
  fractionAlongWire: number;
  magnitudeA: number;
  normalizedMagnitude: number;
  phaseDeg: number;
  positionM: YagiPoint3M;
}

export interface YagiSolverResult {
  modelKey: string;
  resistanceOhm: number;
  reactanceOhm: number;
  swr: number;
  forwardGainDbi: number;
  rearGainDbi: number;
  maximumRearGainDbi: number;
  frontToBackDb: number;
  frontToRearDb: number;
  beamwidthDeg: number | null;
  takeOffAngleDeg: number;
  forwardBearingDeg: number;
  azimuthPattern: YagiPatternPoint[];
  elevationPattern: YagiPatternPoint[];
  radiationPattern: PatternData;
  currentDistribution: YagiCurrentPoint[];
  generatedNec: string;
  engine: string;
  computedInMs: number;
  warnings: string[];
}

export interface SavedYagiTrace {
  id: string;
  label: string;
  color: string;
  model: YagiAntennaModel;
  result: YagiSolverResult;
}
