import { describe, expect, it } from "vitest";
import { applyConductorToDeck, applyConductorToLoads, conductorFromLoads, conductorLabel, conductorLoad, CONDUCTOR_PRESETS, DEFAULT_CONDUCTOR, LEGACY_CONDUCTOR } from "./conductor";

describe("global conductor material", () => {
  it("uses copper for new work and retains the agreed preset conductivities", () => {
    expect(DEFAULT_CONDUCTOR).toEqual({ id: "copper", conductivitySPerM: 5.8e7 });
    expect(Object.fromEntries(CONDUCTOR_PRESETS.map((item) => [item.id, item.conductivitySPerM]))).toMatchObject({
      copper: 5.8e7, aluminum: 3.54e7, steel: 1.03e7, stainless_steel: 1.1e6, perfect: null,
    });
  });

  it("inserts one global LD 5 card before excitation and preserves line endings", () => {
    const deck = "CM test\r\nGW 1 3 0 0 1 0 0 2 .001\r\nGE 0\r\nEX 0 1 2 0 1 0\r\nEN\r\n";
    const applied = applyConductorToDeck(deck, DEFAULT_CONDUCTOR);
    expect(applied).toContain("LD 5 0 0 0 58000000 0 0\r\nEX");
    expect(applied.match(/^LD 5/gm)).toHaveLength(1);
  });

  it("does not override an imported or model-specific conductivity card", () => {
    const deck = "GW 1 3 0 0 1 0 0 2 .001\nGE 0\nLD 5 1 1 3 1100000 0 0\nEX 0 1 2 0 1 0\nEN\n";
    expect(applyConductorToDeck(deck, DEFAULT_CONDUCTOR)).toBe(deck);
    const loads = [{ load_type: 5, wire_tag: 1, segment_start: 1, segment_end: 3, param1: 1.1e6, param2: 0, param3: 0 }];
    expect(applyConductorToLoads(loads, DEFAULT_CONDUCTOR)).toBe(loads);
  });

  it("maps imports without LD 5 to legacy perfect conductor and recognises presets", () => {
    expect(conductorFromLoads([])).toEqual(LEGACY_CONDUCTOR);
    expect(conductorFromLoads([{ load_type: 5, wire_tag: 0, segment_start: 0, segment_end: 0, param1: 3.54e7, param2: 0, param3: 0 }])).toEqual({ id: "aluminum", conductivitySPerM: 3.54e7 });
    expect(conductorFromLoads([{ load_type: 5, wire_tag: 0, segment_start: 0, segment_end: 0, param1: 2.2e7, param2: 0, param3: 0 }])).toEqual({ id: "custom", conductivitySPerM: 2.2e7 });
  });

  it("rejects invalid custom conductivity instead of silently calculating losslessly", () => {
    expect(() => conductorLoad({ id: "custom", conductivitySPerM: Number.NaN })).toThrow(/positive number/i);
    expect(() => conductorLoad({ id: "custom", conductivitySPerM: 0 })).toThrow(/positive number/i);
    expect(conductorLoad(LEGACY_CONDUCTOR)).toBeNull();
    expect(conductorLabel(DEFAULT_CONDUCTOR)).toContain("S/m");
  });
});
