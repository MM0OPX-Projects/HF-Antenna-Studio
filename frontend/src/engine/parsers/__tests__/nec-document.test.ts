import { describe, expect, it } from "vitest";
import { buildCardDeck } from "../nec-input";
import { parseNecFile } from "../nec-file";

const SUPPORTED_DECK = [
  "CM loss-aware round trip",
  "CE",
  "GW 1 301 -5 0 10 5 0 10 0.00001",
  "GW 2 11 5 0 10 5 2 10 0.001",
  "GE -1",
  "GN 2 0 0 0 13.5 0.006",
  "LD 0 1 151 151 50 0.000001 2.5e-11",
  "TL 1 301 2 1 75 2.5 0.01 0.02 0.03 0.04",
  "EX 0 1 151 0 1 -0.25",
  "EX 0 2 6 0 0.5 0.25",
  "FR 0 3 0 0 7 0.1",
  "FR 0 2 0 0 14 0.2",
  "RP 0 19 36 1000 0 0 5 10",
  "EN",
  "",
].join("\r\n");

describe("loss-aware NEC document import", () => {
  it("preserves exact source text and supported values without clamping", () => {
    const parsed = parseNecFile(SUPPORTED_DECK);

    expect(parsed.nec_document?.original_text).toBe(SUPPORTED_DECK);
    expect(parsed.nec_document?.structured_editable).toBe(true);
    expect(parsed.wires[0]).toMatchObject({ tag: 1, segments: 301, radius: 0.00001 });
    expect(parsed.excitations).toEqual([
      { wire_tag: 1, segment: 151, voltage_real: 1, voltage_imag: -0.25 },
      { wire_tag: 2, segment: 6, voltage_real: 0.5, voltage_imag: 0.25 },
    ]);
    expect(parsed.loads).toEqual([
      { load_type: 0, wire_tag: 1, segment_start: 151, segment_end: 151, param1: 50, param2: 0.000001, param3: 2.5e-11 },
    ]);
    expect(parsed.transmission_lines?.[0]).toMatchObject({
      wire_tag1: 1,
      segment1: 301,
      wire_tag2: 2,
      segment2: 1,
      impedance: 75,
      length: 2.5,
      shunt_admittance_imag2: 0.04,
    });
    expect(parsed.ground).toEqual({ type: "custom", custom_permittivity: 13.5, custom_conductivity: 0.006 });
    expect(parsed.frequency_segments).toEqual([
      { start_mhz: 7, stop_mhz: 7.2, steps: 3 },
      { start_mhz: 14, stop_mhz: 14.2, steps: 2 },
    ]);
  });

  it("round-trips the complete supported structured subset semantically", () => {
    const imported = parseNecFile(SUPPORTED_DECK);
    const generated = buildCardDeck({
      wires: imported.wires,
      excitations: imported.excitations,
      loads: imported.loads,
      transmission_lines: imported.transmission_lines,
      ground: imported.ground!,
      geometry_ground_flag: imported.geometry_ground_flag,
      frequency: imported.frequency_segments![0]!,
      frequencySegments: imported.frequency_segments,
    });
    const reparsed = parseNecFile(generated);

    expect(reparsed.wires).toEqual(imported.wires);
    expect(reparsed.excitations).toEqual(imported.excitations);
    expect(reparsed.loads).toEqual(imported.loads);
    expect(reparsed.transmission_lines).toEqual(imported.transmission_lines);
    expect(reparsed.ground).toEqual(imported.ground);
    expect(reparsed.geometry_ground_flag).toBe(-1);
    expect(reparsed.frequency_segments).toEqual(imported.frequency_segments);
  });

  it("does not invent an excitation or silently default frequency/ground", () => {
    const parsed = parseNecFile("CM bare wire\nCE\nGW 1 3 0 0 1 1 0 1 0.001\nGE 0\nEN\n");
    expect(parsed.excitations).toEqual([]);
    expect(parsed.nec_document?.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["source_missing", "frequency_defaulted", "ground_defaulted"]),
    );
  });

  it("blocks structured conversion for unsupported geometry while retaining all decoded source text", () => {
    const source = "CM arc\r\nCE\r\nGA 1 21 5 0 180 0.001\r\nGE 0\r\nFR 0 1 0 0 14 0\r\nEX 0 1 11 0 1 0\r\nEN\r\n";
    const parsed = parseNecFile(source);
    expect(parsed.nec_document?.structured_editable).toBe(false);
    expect(parsed.nec_document?.original_text).toBe(source);
    expect(parsed.nec_document?.cards.find((card) => card.card === "GA")?.disposition).toBe("blocking");
    expect(parsed.nec_document?.diagnostics.some((item) => item.code === "unsupported_card")).toBe(true);
  });

  it("reports malformed supported cards instead of skipping or repairing them", () => {
    const parsed = parseNecFile("CM malformed\nCE\nGW 1 0 0 0 1 1 0 1 -0.1\nEN\n");
    expect(parsed.wires).toEqual([]);
    expect(parsed.nec_document?.structured_editable).toBe(false);
    expect(parsed.nec_document?.diagnostics.some((item) => item.code === "malformed_card")).toBe(true);
  });

  it("retains all-segment LD selection but blocks unstable absolute-segment selection", () => {
    const globalLoad = parseNecFile("CM global load\nCE\nGW 1 3 0 0 1 1 0 1 .001\nGE 0\nGN -1\nLD 5 0 0 0 58000000 0 0\nEX 0 1 2 0 1 0\nFR 0 1 0 0 14 0\nEN\n");
    expect(globalLoad.nec_document?.structured_editable).toBe(true);
    expect(globalLoad.loads?.[0]).toMatchObject({ wire_tag: 0, segment_start: 0, segment_end: 0 });

    const absoluteLoad = parseNecFile("CM absolute load\nCE\nGW 1 3 0 0 1 1 0 1 .001\nGE 0\nGN -1\nLD 4 0 2 2 50 0 0\nEX 0 1 2 0 1 0\nFR 0 1 0 0 14 0\nEN\n");
    expect(absoluteLoad.nec_document?.structured_editable).toBe(false);
    expect(absoluteLoad.nec_document?.diagnostics.some((item) => item.code === "malformed_card")).toBe(true);
  });

  it("blocks contradictory geometry and ground control instead of choosing one silently", () => {
    const parsed = parseNecFile("CM conflict\nCE\nGW 1 3 0 0 1 1 0 1 .001\nGE 0\nGN 1 0 0 0 0 0\nFR 0 1 0 0 14 0\nEX 0 1 2 0 1 0\nEN\n");
    expect(parsed.nec_document?.structured_editable).toBe(false);
    expect(parsed.nec_document?.diagnostics.some((item) => item.code === "ground_card_conflict")).toBe(true);
  });

  it("represents the GE 1 current-expansion choice for ground-contact geometry", () => {
    const parsed = parseNecFile("CM monopole\nCE\nGW 1 21 0 0 0 0 0 5 .001\nGE 1\nGN 1 0 0 0 0 0\nEX 0 1 1 0 1 0\nFR 0 1 0 0 14 0\nEN\n");
    expect(parsed.nec_document?.structured_editable).toBe(true);
    expect(parsed.geometry_ground_flag).toBe(1);
    expect(parsed.nec_document?.cards.find((card) => card.card === "GE")?.disposition).toBe("represented");
  });

  it("blocks a document without a geometry-end card", () => {
    const parsed = parseNecFile("CM missing GE\nCE\nGW 1 3 0 0 1 1 0 1 .001\nGN -1\nEX 0 1 2 0 1 0\nFR 0 1 0 0 14 0\nEN\n");
    expect(parsed.nec_document?.structured_editable).toBe(false);
    expect(parsed.nec_document?.diagnostics.some((item) => item.code === "geometry_end_missing")).toBe(true);
  });

  it("expands supported SY expressions only with an explicit diagnostic", () => {
    const parsed = parseNecFile([
      "CM symbols",
      "SY H=10, L=5*2",
      "CE",
      "GW 1 21 -L/2 0 H L/2 0 H 0.001",
      "GE 0",
      "GN -1",
      "EX 0 1 11 0 1 0",
      "FR 0 1 0 0 14 0",
      "EN",
    ].join("\n"));
    expect(parsed.wires[0]).toMatchObject({ x1: -5, x2: 5, z1: 10, z2: 10 });
    expect(parsed.nec_document?.diagnostics.some((item) => item.code === "symbols_expanded")).toBe(true);
  });
});
