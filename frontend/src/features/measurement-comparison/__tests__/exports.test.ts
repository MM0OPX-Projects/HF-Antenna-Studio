import { describe, expect, it } from "vitest";
import { deriveAnalyserPointFromImpedance } from "../../frequency-analyser/math";
import type { AnalyserSweep } from "../../frequency-analyser/types";
import { compareMeasurementToSimulation } from "../comparison";
import { serializeMeasurementComparisonCsv, serializeMeasurementComparisonProject } from "../exports";
import { parseTouchstoneS1p } from "../touchstone";

describe("measurement comparison CSV", () => {
  it("labels sources, alignment and measurement-minus-simulation values", () => {
    const measurement = parseTouchstoneS1p("# MHz S RI R 50\n14.1 0 0\n", { fileName: "measured.s1p" });
    const point = deriveAnalyserPointFromImpedance(14.1, 45, 5, 50);
    const simulation: AnalyserSweep = { id: "sim", label: "SIMULATION", color: "blue", config: { mode: "start-stop", startMhz: 14, stopMhz: 14.2, points: 3, referenceOhms: 50 }, points: [point], rawFrequencyData: [], computedInMs: 1, engine: "fixture", warnings: [], createdAt: "now" };
    const comparison = compareMeasurementToSimulation(measurement, simulation, "exact");
    const csv = serializeMeasurementComparisonCsv(measurement, simulation, comparison);
    expect(csv).toContain("measurement_s11_real");
    expect(csv).toContain("simulation_alignment");
    expect(csv).toContain("measurement_minus_simulation_r_ohms");
    expect(csv).toContain('"exact"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("serializes infinite derived values explicitly instead of silently changing them to null", () => {
    const measurement = parseTouchstoneS1p("# MHz S RI R 50\n14.1 1 0\n", { fileName: "open.s1p" });
    const point = deriveAnalyserPointFromImpedance(14.1, 50, 0, 50);
    const simulation: AnalyserSweep = { id: "sim", label: "SIMULATION", color: "blue", config: { mode: "start-stop", startMhz: 14, stopMhz: 14.2, points: 3, referenceOhms: 50 }, points: [point], rawFrequencyData: [], computedInMs: 1, engine: "fixture", warnings: [], createdAt: "now" };
    const comparison = compareMeasurementToSimulation(measurement, simulation, "exact");
    const json = serializeMeasurementComparisonProject({ format: "hf-antenna-studio-measurement-comparison", version: 1, createdAt: "now", measurement, simulation, comparison });
    expect(json).toContain('"swr": "Infinity"');
    expect(JSON.parse(json).measurement.sourceText).toContain("14.1 1 0");
  });
});
