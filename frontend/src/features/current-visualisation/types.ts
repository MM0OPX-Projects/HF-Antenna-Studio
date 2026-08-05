import type { SegmentCurrent } from "../../api/nec";

export type CurrentVisualMode = "magnitude" | "phase" | "combined";

export interface CurrentVisualWire {
  id: string;
  tag: number;
  startM: { x: number; y: number; z: number };
  endM: { x: number; y: number; z: number };
  radiusM?: number;
}

export interface ParametricCurrentPoint {
  wireId: string;
  tag: number;
  segment: number;
  fractionAlongWire: number;
  magnitudeA: number;
  phaseDeg: number;
}

export interface CurrentVisualData {
  wires: CurrentVisualWire[];
  currents: SegmentCurrent[];
  source: "nec-solver";
}
