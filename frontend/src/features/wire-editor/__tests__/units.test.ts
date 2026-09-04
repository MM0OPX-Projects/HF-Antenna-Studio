import { describe, expect, it } from "vitest";
import { editorUnitToMetres, metresToEditorUnit } from "../units";

describe("wire editor display units", () => {
  it.each([
    ["m", 1],
    ["mm", 1000],
    ["ft", 3.280839895013123],
    ["in", 39.37007874015748],
  ] as const)("round-trips metres through %s", (unit, displayed) => {
    expect(metresToEditorUnit(1, unit)).toBeCloseTo(displayed, 10);
    expect(editorUnitToMetres(displayed, unit)).toBeCloseTo(1, 10);
  });
});
