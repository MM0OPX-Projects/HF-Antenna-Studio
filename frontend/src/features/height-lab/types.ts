import type { VerifiedDipoleResult } from "../verified-dipole/result";

export type HeightUnit = "m" | "ft";
export type PatternDisplayMode = "absolute" | "normalised";
export type GroundPresetId = "perfect" | "average" | "pastoral" | "dry" | "custom";

export interface GroundPreset {
  id: GroundPresetId;
  label: string;
  conductivitySPerM: number | null;
  relativePermittivity: number | null;
}

export interface HeightLabTrace {
  id: string;
  modelKey: string;
  label: string;
  color: string;
  heightM: number;
  heightWavelengths: number;
  frequencyMhz: number;
  groundLabel: string;
  result: VerifiedDipoleResult;
}

export const GROUND_PRESETS: GroundPreset[] = [
  { id: "perfect", label: "Perfect ground", conductivitySPerM: null, relativePermittivity: null },
  { id: "average", label: "Average ground", conductivitySPerM: 0.005, relativePermittivity: 13 },
  { id: "pastoral", label: "Good pastoral ground", conductivitySPerM: 0.01, relativePermittivity: 14 },
  { id: "dry", label: "Dry / poor ground", conductivitySPerM: 0.001, relativePermittivity: 4 },
  { id: "custom", label: "Custom real ground", conductivitySPerM: 0.005, relativePermittivity: 13 },
];

export const HEIGHT_PRESETS = [0.1, 0.25, 0.5, 1, 2] as const;
export const TRACE_COLORS = ["#f97316", "#a855f7", "#14b8a6", "#eab308"] as const;
