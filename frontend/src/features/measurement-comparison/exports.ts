import type { MeasurementComparison, MeasurementComparisonExport, MeasurementDataset } from "./types";
import type { AnalyserSweep } from "../frequency-analyser/types";

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : typeof value === "number" && !Number.isFinite(value) ? "Infinity" : String(value);
  return `"${text.split('"').join('""')}"`;
}

export function serializeMeasurementComparisonCsv(measurement: MeasurementDataset, simulation: AnalyserSweep, comparison: MeasurementComparison): string {
  const rows: Array<Array<string | number | null>> = [[
    "frequency_mhz", "measurement_source_line", "measurement_format", "measurement_reference_ohms",
    "measurement_s11_real", "measurement_s11_imag", "measurement_swr", "measurement_r_ohms", "measurement_x_ohms",
    "simulation_alignment", "simulation_reference_ohms", "simulation_swr", "simulation_r_ohms", "simulation_x_ohms",
    "measurement_minus_simulation_swr", "measurement_minus_simulation_r_ohms", "measurement_minus_simulation_x_ohms",
  ]];
  for (const point of comparison.points) {
    rows.push([
      point.frequencyMhz, point.measurement.sourceLine, measurement.dataFormat, measurement.referenceOhms,
      point.measurement.s11Real, point.measurement.s11Imag, point.measurement.swr, point.measurement.resistanceOhms, point.measurement.reactanceOhms,
      point.alignment, simulation.config.referenceOhms, point.simulation?.swr ?? null, point.simulation?.resistanceOhms ?? null, point.simulation?.reactanceOhms ?? null,
      point.swrDifference, point.resistanceDifferenceOhms, point.reactanceDifferenceOhms,
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportMeasurementComparisonCsv(measurement: MeasurementDataset, simulation: AnalyserSweep, comparison: MeasurementComparison): void {
  download(new Blob([serializeMeasurementComparisonCsv(measurement, simulation, comparison)], { type: "text/csv;charset=utf-8" }), "hf-antenna-studio-measurement-comparison.csv");
}

export function exportMeasurementComparisonProject(measurement: MeasurementDataset, simulation: AnalyserSweep, comparison: MeasurementComparison): void {
  const data: MeasurementComparisonExport = { format: "hf-antenna-studio-measurement-comparison", version: 1, createdAt: new Date().toISOString(), measurement, simulation, comparison };
  download(new Blob([serializeMeasurementComparisonProject(data)], { type: "application/json;charset=utf-8" }), "hf-antenna-studio-measurement-comparison.json");
}

export function serializeMeasurementComparisonProject(data: MeasurementComparisonExport): string {
  return JSON.stringify(data, (_key, value) => typeof value === "number" && !Number.isFinite(value) ? String(value) : value, 2);
}
