import { buildG3txqBroadbandHexbeam } from "../g3txq-hexbeam";

const INCH_M = 0.0254;
const length = (start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }) => Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);

describe("G3TXQ broadband Hexbeam geometry", () => {
  const dimensions = {
    drivenHalfLengthM: 218 * INCH_M,
    reflectorTotalLengthM: 412 * INCH_M,
    endSpacingM: 24 * INCH_M,
    feedGapM: 0.04,
    heightM: 10,
  };

  it("uses an M driver and a five-side perimeter reflector", () => {
    const geometry = buildG3txqBroadbandHexbeam(dimensions);
    expect(geometry.canonical).toBe(true);
    expect(geometry.sections.map((section) => section.id)).toEqual([
      "driven-feed", "driven-left-inner", "driven-left-outer", "driven-right-inner", "driven-right-outer",
      "reflector-left-tip", "reflector-left-side", "reflector-rear", "reflector-right-side", "reflector-right-tip",
    ]);
    expect(geometry.sections.filter((section) => section.family === "reflector")).toHaveLength(5);
    expect(geometry.supports.filter((support) => support.id.startsWith("spreader-"))).toHaveLength(6);
    expect(geometry.supports.filter((support) => support.id.startsWith("perimeter-"))).toHaveLength(6);
  });

  it("keeps the published wire lengths and both tip gaps exact", () => {
    const geometry = buildG3txqBroadbandHexbeam(dimensions);
    const section = (id: string) => geometry.sections.find((candidate) => candidate.id === id)!;
    const leftHalfM = length(section("driven-feed").startM, section("driven-feed").endM) / 2
      + length(section("driven-left-inner").startM, section("driven-left-inner").endM)
      + length(section("driven-left-outer").startM, section("driven-left-outer").endM);
    const reflectorM = geometry.sections.filter((candidate) => candidate.family === "reflector")
      .reduce((sum, candidate) => sum + length(candidate.startM, candidate.endM), 0);
    const leftGapM = length(section("driven-left-outer").endM, section("reflector-left-tip").startM);
    const rightGapM = length(section("driven-right-outer").endM, section("reflector-right-tip").endM);
    expect(leftHalfM).toBeCloseTo(dimensions.drivenHalfLengthM, 10);
    expect(reflectorM).toBeCloseTo(dimensions.reflectorTotalLengthM, 10);
    expect(leftGapM).toBeCloseTo(dimensions.endSpacingM, 10);
    expect(rightGapM).toBeCloseTo(dimensions.endSpacingM, 10);
  });

  it("is symmetric about the forward/rear Y axis", () => {
    const geometry = buildG3txqBroadbandHexbeam(dimensions);
    const left = geometry.sections.find((section) => section.id === "driven-left-outer")!;
    const right = geometry.sections.find((section) => section.id === "driven-right-outer")!;
    expect(left.startM.x).toBeCloseTo(-right.startM.x, 12);
    expect(left.endM.x).toBeCloseTo(-right.endM.x, 12);
    expect(left.startM.y).toBeCloseTo(right.startM.y, 12);
    expect(left.endM.y).toBeCloseTo(right.endM.y, 12);
  });
});
