import type { ParameterSweepPoint, SweepMetricId } from "./types";

export const SWEEP_METRICS: Record<SweepMetricId, { label: string; unit: string; value: (point: ParameterSweepPoint) => number | null }> = {
  swr: { label: "SWR", unit: ":1", value: (point) => point.metrics.swr },
  gain: { label: "Gain", unit: "dBi", value: (point) => point.metrics.gainDbi },
  "take-off": { label: "Take-off angle", unit: "°", value: (point) => point.metrics.takeOffAngleDeg },
  "front-to-back": { label: "Front-to-back", unit: "dB", value: (point) => point.metrics.frontToBackDb },
  resistance: { label: "Feed resistance", unit: "Ω", value: (point) => point.metrics.resistanceOhm },
  reactance: { label: "Feed reactance", unit: "Ω", value: (point) => point.metrics.reactanceOhm },
};
