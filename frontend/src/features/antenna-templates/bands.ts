import type { AmateurBandPreset } from "./schema";

export const HF_AMATEUR_BANDS: AmateurBandPreset[] = [
  { id: "160m", label: "160 m", frequencyHz: 1_900_000 },
  { id: "80m", label: "80 m", frequencyHz: 3_600_000 },
  { id: "60m", label: "60 m", frequencyHz: 5_350_000 },
  { id: "40m", label: "40 m", frequencyHz: 7_100_000 },
  { id: "30m", label: "30 m", frequencyHz: 10_120_000 },
  { id: "20m", label: "20 m", frequencyHz: 14_100_000 },
  { id: "17m", label: "17 m", frequencyHz: 18_100_000 },
  { id: "15m", label: "15 m", frequencyHz: 21_100_000 },
  { id: "12m", label: "12 m", frequencyHz: 24_900_000 },
  { id: "10m", label: "10 m", frequencyHz: 28_500_000 },
  { id: "6m", label: "6 m", frequencyHz: 50_100_000 },
];
