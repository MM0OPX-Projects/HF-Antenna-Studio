import { describe, expect, it } from "vitest";
import { buildComparisonHtml } from "../exports";
import type { ComparisonResult, ComparisonRunConfig } from "../types";

const config: ComparisonRunConfig = { conditions: { frequencyMhz: 14.1, ground: { kind: "perfect" }, referenceImpedanceOhm: 50, azimuthElevationDeg: 10, elevationBearingDeg: 0 }, sweep: { mode: "start-stop", startMhz: 14, stopMhz: 14.2, points: 3, referenceOhms: 50 } };
const result: ComparisonResult = {
  slotId: "one", label: "Dipole <unsafe>", color: "#3b82f6", family: "dipole", definitionKey: "definition", conditionKey: "condition", conditions: config.conditions, sweepConfig: config.sweep,
  metrics: { gainDbi: 7, takeOffAngleDeg: 25, frontToBackDb: 0, beamwidthDeg: 90, resistanceOhm: 50, reactanceOhm: 2, swr: 1.04 },
  azimuthPattern: [{ angleDeg: 0, gainDbi: 7, normalizedDb: 0 }, { angleDeg: 180, gainDbi: 7, normalizedDb: 0 }],
  elevationPattern: [{ angleDeg: 0, gainDbi: 1, normalizedDb: -6 }, { angleDeg: 90, gainDbi: 7, normalizedDb: 0 }],
  radiationPattern: { theta_start: 0, theta_step: 90, theta_count: 2, phi_start: 0, phi_step: 180, phi_count: 2, gain_dbi: [[7, 7], [1, 1]] },
  sweep: null, sweepUnavailableReason: "No physical port <by design>", generatedNec: "CM <deck>\nEN\n", engine: "test", warnings: [],
};

describe("comparison HTML report", () => {
  it("exports a standalone, escaped report with metrics, plots, sweep limitations and decks", () => {
    const html = buildComparisonHtml([result], config, ["Different conditions <warning>"], "2026-08-06T00:00:00.000Z");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Dipole &lt;unsafe&gt;");
    expect(html).toContain("Different conditions &lt;warning&gt;");
    expect(html).toContain("No physical port &lt;by design&gt;");
    expect(html).toContain("CM &lt;deck&gt;");
    expect(html).not.toContain("<unsafe>");
  });
});
