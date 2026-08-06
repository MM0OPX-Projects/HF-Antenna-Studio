import { describe, expect, it } from "vitest";
import { buildParameterSweepExport } from "../exports";
import { createDefaultSweepDefinition, fingerprintText, parameterSweepDefinitionKey } from "../model";

describe("parameter sweep metadata export", () => {
  it("preserves the exact definition, point model, solver and NEC evidence", () => {
    const definition = createDefaultSweepDefinition();
    const deck = "CM exact model\nGW 1 3 -1 0 5 1 0 5 .001\nEN\n";
    const result = { schemaVersion: 1 as const, id: "test", definitionKey: parameterSweepDefinitionKey(definition), definition, createdAt: "2026-08-06T00:00:00.000Z", completedAt: "2026-08-06T00:00:01.000Z", elapsedMs: 1000, totalJobs: 1, cacheHits: 0, engines: ["fixture-nec"], warnings: [], points: [{ ordinal: 0, axisValues: [5], parameterValues: { "dipole-height": 5 }, modelKey: "exact-model", generatedNec: deck, necFingerprint: fingerprintText(deck), metrics: { swr: 1, gainDbi: 2.1, takeOffAngleDeg: 30, frontToBackDb: null, resistanceOhm: 50, reactanceOhm: 0 }, engine: "fixture-nec", computedInMs: 4, warnings: [], cached: false }] };
    const parsed = JSON.parse(buildParameterSweepExport(result));
    expect(parsed.format).toBe("hf-antenna-studio-parameter-sweep");
    expect(parsed.result.definition).toEqual(definition);
    expect(parsed.result.points[0].generatedNec).toBe(deck);
    expect(parsed.result.points[0].necFingerprint).toBe(fingerprintText(deck));
  });
});
