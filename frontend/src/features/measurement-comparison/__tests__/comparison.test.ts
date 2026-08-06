import { describe, expect, it } from "vitest";
import { deriveAnalyserPointFromImpedance } from "../../frequency-analyser/math";
import type { AnalyserSweep } from "../../frequency-analyser/types";
import { compareMeasurementToSimulation } from "../comparison";
import { parseTouchstoneS1p } from "../touchstone";

function sweep(referenceOhms = 50): AnalyserSweep {
  return {
    id: "simulation-1", label: "SIMULATION fixture", color: "#00f",
    config: { mode: "start-stop", startMhz: 14, stopMhz: 14.2, points: 3, referenceOhms },
    points: [
      deriveAnalyserPointFromImpedance(14, 40, -20, referenceOhms),
      deriveAnalyserPointFromImpedance(14.1, 50, 0, referenceOhms),
      deriveAnalyserPointFromImpedance(14.2, 60, 20, referenceOhms),
    ],
    rawFrequencyData: [], computedInMs: 1, engine: "fixture-nec", warnings: [], createdAt: "2026-08-06T00:00:00.000Z",
  };
}

describe("measurement/simulation alignment", () => {
  it("uses exact frequencies without interpolation", () => {
    const measurement = parseTouchstoneS1p("# MHz S RI R 50\n14.1 0 0\n14.15 0 0\n", { fileName: "exact.s1p" });
    const comparison = compareMeasurementToSimulation(measurement, sweep(), "exact");
    expect(comparison.alignedPointCount).toBe(1);
    expect(comparison.points[0]!.alignment).toBe("exact");
    expect(comparison.points[1]!.simulation).toBeNull();
  });

  it("linearly interpolates simulation R/X onto unchanged measured frequencies without extrapolation", () => {
    const measurement = parseTouchstoneS1p("# MHz S RI R 50\n13.9 0 0\n14.05 0 0\n14.15 0 0\n14.3 0 0\n", { fileName: "linear.s1p" });
    const comparison = compareMeasurementToSimulation(measurement, sweep(), "linear-simulation");
    expect(comparison.alignedPointCount).toBe(2);
    expect(comparison.points[0]!.simulation).toBeNull();
    expect(comparison.points[1]!.simulation?.frequencyMhz).toBe(14.05);
    expect(comparison.points[1]!.simulation?.resistanceOhms).toBeCloseTo(45, 10);
    expect(comparison.points[1]!.simulation?.reactanceOhms).toBeCloseTo(-10, 10);
    expect(comparison.points[2]!.simulation?.frequencyMhz).toBe(14.15);
    expect(comparison.points[2]!.simulation?.resistanceOhms).toBeCloseTo(55, 10);
    expect(comparison.points[2]!.simulation?.reactanceOhms).toBeCloseTo(10, 10);
    expect(comparison.points[3]!.simulation).toBeNull();
    expect(comparison.alignmentLabel).toContain("original measurement frequencies");
    expect(measurement.points.map((point) => point.frequencyMhz)).toEqual([13.9, 14.05, 14.15, 14.3]);
  });

  it("warns rather than treating unlike SWR reference impedances as matched", () => {
    const measurement = parseTouchstoneS1p("# MHz S RI R 75\n14.1 0 0\n", { fileName: "75ohm.s1p" });
    const comparison = compareMeasurementToSimulation(measurement, sweep(50), "exact");
    expect(comparison.referenceImpedanceMatches).toBe(false);
    expect(comparison.points[0]!.swrDifference).toBeNull();
    expect(comparison.warnings.join(" ")).toContain("SWR difference is not condition-matched");
  });
});
