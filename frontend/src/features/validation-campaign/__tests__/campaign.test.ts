import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeSwr } from "../../../utils/units";
import { DIPOLE_REGRESSION_CASES, PUBLISHED_NEC_REFERENCE } from "../../verified-dipole/validation-cases";
import { IDEAL_VERTICAL_REGRESSION_CASES } from "../../vertical-antennas/validation-cases";
import { LOOP_BEAM_PERFECT_GROUND_REGRESSION_CASES } from "../../loop-beams/validation-cases";
import { YAGI_PERFECT_GROUND_REGRESSION_CASES } from "../../yagi-beams/validation-cases";
import { PHASED_ARRAY_PERFECT_GROUND_CASES } from "../../phased-arrays/validation-cases";

interface CampaignCase {
  id: string;
  family: string;
  fixture: string;
  deckSha256: string;
  reference: { metrics: Record<string, number> };
  application: { metrics: Record<string, number> };
  differences: Record<string, number>;
  tolerances: Record<string, number>;
  classification: string;
  status: "pass" | "fail";
  investigation: string;
}

interface CampaignManifest {
  schemaVersion: number;
  allowedClassifications: string[];
  cases: CampaignCase[];
}

const manifestPath = new URL("../../../../../validation/campaign/reference-cases.json", import.meta.url);
const repositoryRoot = new URL("../../../../../", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CampaignManifest;
const byId = new Map(manifest.cases.map((item) => [item.id, item]));

describe("systematic validation campaign", () => {
  it("contains every requested family with explicit discrepancy classifications", () => {
    const requiredFamilies = [
      "free-space-dipole",
      "dipole-over-ground",
      "quarter-wave-vertical",
      "full-wave-loop",
      "delta-loop",
      "two-element-yagi",
      "three-element-yagi",
      "two-element-phased-vertical-array",
    ];
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.allowedClassifications).toEqual([
      "Bug",
      "Numerical tolerance",
      "Different solver implementation",
      "Different ground model",
      "Geometry difference",
      "Unknown",
    ]);
    expect(new Set(manifest.cases.map((item) => item.id)).size).toBe(manifest.cases.length);
    for (const family of requiredFamilies) expect(manifest.cases.some((item) => item.family === family), family).toBe(true);
    for (const item of manifest.cases) {
      expect(manifest.allowedClassifications, item.id).toContain(item.classification);
      expect(item.investigation.length, item.id).toBeGreaterThan(40);
      expect(item.status, item.id).toBe("pass");
    }
  });

  it("pins every exact NEC fixture by SHA-256", () => {
    for (const item of manifest.cases) {
      const bytes = readFileSync(new URL(item.fixture, repositoryRoot));
      const hash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
      expect(hash, item.id).toBe(item.deckSha256);
    }
  });

  it("records signed differences and keeps every metric inside its declared tolerance", () => {
    for (const item of manifest.cases) {
      for (const [metric, tolerance] of Object.entries(item.tolerances)) {
        const application = item.application.metrics[metric];
        const reference = item.reference.metrics[metric];
        expect(application, `${item.id} application ${metric}`).toBeTypeOf("number");
        expect(reference, `${item.id} reference ${metric}`).toBeTypeOf("number");
        if (application === undefined || reference === undefined) {
          throw new Error(`${item.id} is missing the compared metric ${metric}`);
        }
        const difference = application - reference;
        expect(item.differences[metric], `${item.id} recorded ${metric} difference`).toBeCloseTo(difference, 5);
        expect(Math.abs(difference), `${item.id} ${metric}`).toBeLessThanOrEqual(tolerance + 1e-9);
      }
    }
  });

  it("derives every recorded 50-ohm SWR from the recorded application R and X", () => {
    for (const item of manifest.cases) {
      const metrics = item.application.metrics;
      if (metrics.swr50 === undefined) continue;
      if (metrics.resistanceOhm === undefined || metrics.reactanceOhm === undefined) {
        throw new Error(`${item.id} records SWR without R/X source metrics`);
      }
      expect(computeSwr(metrics.resistanceOhm, metrics.reactanceOhm, 50), item.id).toBeCloseTo(metrics.swr50, 3);
    }
  });

  it("cannot drift away from the application family regression contracts", () => {
    expect(byId.get("free-space-dipole-published")?.reference.metrics).toMatchObject(PUBLISHED_NEC_REFERENCE.expected);
    expect(byId.get("dipole-half-lambda-perfect-ground")?.application.metrics).toMatchObject(
      DIPOLE_REGRESSION_CASES.find((item) => item.id === "height-half-wave")!.expected,
    );
    const vertical = IDEAL_VERTICAL_REGRESSION_CASES.find((item) => item.band === "20m")!.expected;
    expect(byId.get("quarter-wave-vertical-perfect-ground")?.application.metrics).toMatchObject({
      resistanceOhm: vertical.resistanceOhm, reactanceOhm: vertical.reactanceOhm,
      maximumGainDbi: vertical.gainDbi, takeOffAngleDeg: vertical.takeOffAngleDeg,
    });
    for (const [campaignId, kind] of [["full-wave-square-loop-perfect-ground", "square-loop"], ["delta-loop-bottom-feed-perfect-ground", "delta-loop"]] as const) {
      const expected = LOOP_BEAM_PERFECT_GROUND_REGRESSION_CASES.find((item) => item.kind === kind)!.expected;
      expect(byId.get(campaignId)?.application.metrics).toMatchObject({
        resistanceOhm: expected.resistanceOhm, reactanceOhm: expected.reactanceOhm,
        maximumGainDbi: expected.peakGainDbi, takeOffAngleDeg: expected.takeOffAngleDeg,
      });
    }
    expect(byId.get("two-element-yagi-perfect-ground")?.application.metrics).toMatchObject(
      YAGI_PERFECT_GROUND_REGRESSION_CASES.find((item) => item.elements === 2)!.expected,
    );
    expect(byId.get("three-element-yagi-perfect-ground")?.application.metrics).toMatchObject(
      YAGI_PERFECT_GROUND_REGRESSION_CASES.find((item) => item.elements === 3)!.expected,
    );
    for (const [campaignId, sourceId] of [["two-vertical-broadside-perfect-ground", "broadside"], ["two-vertical-endfire-perfect-ground", "endfire-forward"]] as const) {
      const expected = PHASED_ARRAY_PERFECT_GROUND_CASES.find((item) => item.id === sourceId)!.expected;
      expect(byId.get(campaignId)?.application.metrics).toMatchObject({
        forwardGainDbi: expected.forwardGainDbi, reverseGainDbi: expected.reverseGainDbi,
        frontToBackDb: expected.frontToBackDb, headingDeg: expected.headingDeg,
        takeOffAngleDeg: expected.takeOffAngleDeg,
      });
    }
  });
});
