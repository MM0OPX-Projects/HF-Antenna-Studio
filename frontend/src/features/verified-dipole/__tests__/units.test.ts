import { describe, expect, it } from "vitest";
import { SPEED_OF_LIGHT_M_PER_S } from "../model";
import { hertzToMegahertz, lengthToMetres, megahertzToHertz, metresToLength, wavelengthMetres } from "../units";

describe("verified dipole units", () => {
  it("converts frequency between MHz and SI hertz", () => {
    expect(megahertzToHertz(14.1)).toBe(14_100_000);
    expect(hertzToMegahertz(14_100_000)).toBe(14.1);
  });

  it("uses the exact SI speed of light for wavelength", () => {
    expect(wavelengthMetres(10_000_000)).toBeCloseTo(SPEED_OF_LIGHT_M_PER_S / 10_000_000, 12);
  });

  it.each([
    [1, "m", 1],
    [1000, "mm", 1],
    [1, "ft", 0.3048],
    [1, "in", 0.0254],
  ] as const)("converts %s %s to metres", (value, unit, expectedM) => {
    expect(lengthToMetres(value, unit)).toBeCloseTo(expectedM, 12);
    expect(metresToLength(expectedM, unit)).toBeCloseTo(value, 12);
  });

  it("rejects a non-positive wavelength frequency", () => {
    expect(() => wavelengthMetres(0)).toThrow(/positive/);
  });
});
