import type { PatternData } from "../../api/nec";

export type PhasedArrayMode = "ideal-current-phase" | "physical-feed-network";
export type PhasedArrayGround =
  | { kind: "perfect" }
  | { kind: "sommerfeld-norton"; conductivitySPerM: number; relativePermittivity: number };
export type RadialRepresentation = "perfect-ground-image" | "explicit-wires";
export interface PhasedRadials { representation: RadialRepresentation; count: number; lengthM: number; droopAngleRad: number; diameterM: number }
export interface IdealExcitation { amplitude1: number; amplitude2: number; phase1Deg: number; phase2Deg: number }
export type FeedTopology = "parallel-junction" | "series-cascade";
export type LineLengthInput = "physical" | "electrical" | "delay";
export interface PhysicalFeedNetwork {
  topology: FeedTopology;
  characteristicImpedanceOhm: number;
  velocityFactor: number;
  lengthInput: LineLengthInput;
  line1Value: number;
  line2Value: number;
  sourceTerminationOhm: number | null;
  port1TerminationOhm: number | null;
  port2TerminationOhm: number | null;
}
export interface PhasedArrayModel {
  schemaVersion: 1;
  kind: "two-element-phased-vertical-array";
  mode: PhasedArrayMode;
  frequencyHz: number;
  elementLengthM: number;
  elementBaseHeightM: number;
  elementDiameterM: number;
  spacingM: number;
  bearingDeg: number;
  ideal: IdealExcitation;
  physical: PhysicalFeedNetwork;
  ground: PhasedArrayGround;
  radials: PhasedRadials;
  provenance: { dimensionsAreStartingPoints: true; manualDimensions: boolean };
}
export interface PhasedPoint3M { x: number; y: number; z: number }
export type PhasedWireFamily = "element-1" | "element-2" | "radial-1" | "radial-2" | "source-junction";
export interface PhasedWire { id: string; family: PhasedWireFamily; startM: PhasedPoint3M; endM: PhasedPoint3M; diameterM: number }
export interface PhasedNetworkPath { id: string; kind: "transmission-line"; fromM: PhasedPoint3M; toM: PhasedPoint3M; line: 1 | 2 }
export interface PhasedIssue { severity: "error" | "warning"; code: string; message: string }
export interface GeneratedPhasedArray { model: PhasedArrayModel; wires: PhasedWire[]; networkPaths: PhasedNetworkPath[]; issues: PhasedIssue[] }
export interface SegmentedPhasedWire extends PhasedWire { tag: number; segments: number; segmentLengthM: number }
export interface PhasedSegmentation { wires: SegmentedPhasedWire[]; totalSegments: number; feeds: [{ tag: number; segment: 1 }, { tag: number; segment: 1 }]; sourceJunction: { tag: number; segment: 1 } | null; issues: PhasedIssue[] }
export interface LineMetrics { physicalLengthM: number; electricalLengthDeg: number; delayS: number; necEquivalentLengthM: number }
export interface ComplexValue { real: number; imag: number }
export interface PhasedPatternPoint { angleDeg: number; gainDbi: number; normalizedDb: number }
export interface PhasedCurrentPoint { wireId: string; family: PhasedWireFamily; tag: number; segment: number; fractionAlongWire: number; magnitudeA: number; normalizedMagnitude: number; phaseDeg: number; positionM: PhasedPoint3M }
export interface ElementFeedCurrent { element: 1 | 2; magnitudeA: number; phaseDeg: number; complex: ComplexValue }
export interface PhasedArraySolverResult {
  modelKey: string;
  forwardGainDbi: number;
  reverseGainDbi: number;
  maximumRearGainDbi: number;
  frontToBackDb: number;
  frontToRearDb: number;
  beamHeadingDeg: number;
  beamHeadingAmbiguous: boolean;
  takeOffAngleDeg: number;
  azimuthPattern: PhasedPatternPoint[];
  elevationPattern: PhasedPatternPoint[];
  radiationPattern: PatternData;
  currentDistribution: PhasedCurrentPoint[];
  elementFeedCurrents: [ElementFeedCurrent, ElementFeedCurrent];
  requiredSourceVoltages: [ComplexValue, ComplexValue] | null;
  networkInputImpedance: ComplexValue | null;
  lineMetrics: [LineMetrics, LineMetrics] | null;
  generatedNec: string;
  calibrationDecks: [string, string] | null;
  engine: string;
  computedInMs: number;
  warnings: string[];
}
export interface SavedPhasedTrace { id: string; label: string; color: string; model: PhasedArrayModel; result: PhasedArraySolverResult }
