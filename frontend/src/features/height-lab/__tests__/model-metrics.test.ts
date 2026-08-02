import { describe, expect, it } from "vitest";
import type { VerifiedDipoleResult } from "../../verified-dipole/result";
import { wavelengthMetres } from "../../verified-dipole/units";
import { lowAngleGainDbi, normaliseGainGrid } from "../metrics";
import { createHeightLabModel } from "../model";

describe("dipole height laboratory model", () => {
  it("converts MHz to SI and keeps both wire length and height wavelength-relative", () => {
    const model = createHeightLabModel({
      frequencyMhz: 14.1,
      heightWavelengths: 0.25,
      groundPreset: "perfect",
      conductivitySPerM: 0.005,
      relativePermittivity: 13,
    });
    const wavelengthM = wavelengthMetres(14_100_000);
    expect(model.frequencyHz).toBe(14_100_000);
    expect(model.totalLengthM).toBeCloseTo(wavelengthM * 0.5, 10);
    expect(model.heightM).toBeCloseTo(wavelengthM * 0.25, 10);
    expect(model.wireDiameterM).toBe(0.001);
    expect(model.ground).toEqual({ kind: "perfect" });
  });

  it("passes custom real-ground conductivity and permittivity without unit changes", () => {
    const model = createHeightLabModel({
      frequencyMhz: 7.1,
      heightWavelengths: 1,
      groundPreset: "custom",
      conductivitySPerM: 0.0123,
      relativePermittivity: 17.5,
    });
    expect(model.ground).toEqual({
      kind: "real",
      conductivitySPerM: 0.0123,
      relativePermittivity: 17.5,
    });
  });
});

describe("height pattern metrics", () => {
  it("reports the best absolute gain in the inclusive 0 to 10 degree window", () => {
    const result = {
      elevationPattern: [
        { angleDeg: 0, gainDbi: -4, normalizedDb: -10 },
        { angleDeg: 5, gainDbi: 1.5, normalizedDb: -4.5 },
        { angleDeg: 10, gainDbi: 0.5, normalizedDb: -5.5 },
        { angleDeg: 15, gainDbi: 8, normalizedDb: 0 },
      ],
    } as VerifiedDipoleResult;
    expect(lowAngleGainDbi(result)).toBe(1.5);
  });

  it("normalises a complete 3D grid to its own peak without changing shape", () => {
    expect(normaliseGainGrid([[-10, 2], [7, -999.99]])).toEqual([[-17, -5], [0, -40]]);
  });
});
