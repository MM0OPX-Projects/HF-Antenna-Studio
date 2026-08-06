import { describe, expect, it } from "vitest";
import { parseTouchstoneS1p } from "../touchstone";

describe("Touchstone .s1p import", () => {
  it("preserves RI source records and derives S11, impedance and SWR", () => {
    const source = "! NanoVNA one-port export\r\n# MHz S RI R 50\r\n14.0 0 0\r\n14.1 0.5 0\r\n";
    const result = parseTouchstoneS1p(source, { fileName: "antenna.s1p" });
    expect(result.sourceText).toBe(source);
    expect(result.optionLine).toBe("# MHz S RI R 50");
    expect(result.points).toHaveLength(2);
    expect(result.points[1]).toMatchObject({ sourceLine: 4, rawLine: "14.1 0.5 0", frequencyHz: 14_100_000, s11Real: 0.5, swr: 3, resistanceOhms: 150, reactanceOhms: 0 });
  });

  it("converts MA and DB values without altering the original pair", () => {
    const ma = parseTouchstoneS1p("# MHz S MA R 50\n14 0.5 90\n", { fileName: "ma.s1p" }).points[0]!;
    expect(ma.originalValue1).toBe(0.5);
    expect(ma.originalValue2).toBe(90);
    expect(ma.s11Real).toBeCloseTo(0, 12);
    expect(ma.s11Imag).toBeCloseTo(0.5, 12);
    expect(ma.resistanceOhms).toBeCloseTo(30, 10);
    expect(ma.reactanceOhms).toBeCloseTo(40, 10);
    const db = parseTouchstoneS1p("# MHz S DB R 50\n14 -6.020599913 0\n", { fileName: "db.s1p" }).points[0]!;
    expect(db.s11Magnitude).toBeCloseTo(0.5, 10);
    expect(db.resistanceOhms).toBeCloseTo(150, 7);
  });

  it("accepts a conservative one-port Touchstone 2.0 subset", () => {
    const source = "[Version] 2.0\n# Hz S RI R 50\n[Number of Ports] 1\n[Number of Frequencies] 2\n[Reference] 75\n[Network Data]\n14000000 0 0\n14100000 .1 -.2\n[End]\n";
    const result = parseTouchstoneS1p(source, { fileName: "v2.s1p" });
    expect(result.touchstoneVersion).toBe("2.0");
    expect(result.referenceOhms).toBe(75);
    expect(result.points).toHaveLength(2);
  });

  it("retains mathematically invalid passive SWR as unavailable with a warning", () => {
    const result = parseTouchstoneS1p("# MHz S RI R 50\n14 1.1 0\n", { fileName: "active.s1p" });
    expect(result.points[0]!.swr).toBeNull();
    expect(result.warnings.join(" ")).toContain("greater than 1");
  });

  it.each([
    ["missing option", "14 0 0\n", "option line"],
    ["wrong parameter", "# MHz Z RI R 50\n14 50 0\n", "only S-parameter"],
    ["duplicate frequency", "# MHz S RI R 50\n14 0 0\n14 0 0\n", "strictly increasing"],
    ["malformed row", "# MHz S RI R 50\n14,0,0\n", "exactly frequency"],
    ["non-finite", "# MHz S RI R 50\n14 NaN 0\n", "not a valid finite"],
    ["two-port declaration", "[Version] 2.0\n# MHz S RI R 50\n[Number of Ports] 2\n", "only one-port"],
    ["unsupported keyword", "[Version] 2.0\n# MHz S RI R 50\n[Number of Ports] 1\n[Mixed-Mode Order] 1,2\n", "unsupported"],
    ["late reference", "[Version] 2.0\n# MHz S RI R 50\n[Number of Ports] 1\n[Network Data]\n14 0 0\n[Reference] 75\n[End]\n", "must precede [Network Data]"],
    ["missing end", "[Version] 2.0\n# MHz S RI R 50\n[Number of Ports] 1\n[Network Data]\n14 0 0\n", "no [End]"],
  ])("rejects %s input without repairing it", (_label, source, message) => {
    expect(() => parseTouchstoneS1p(source, { fileName: "bad.s1p" })).toThrow(message);
  });
});
