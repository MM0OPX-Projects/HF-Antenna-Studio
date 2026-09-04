export type EditorLengthUnit = "m" | "mm" | "ft" | "in";

const METRES_PER_UNIT: Record<EditorLengthUnit, number> = {
  m: 1,
  mm: 0.001,
  ft: 0.3048,
  in: 0.0254,
};

export function metresToEditorUnit(metres: number, unit: EditorLengthUnit): number {
  return metres / METRES_PER_UNIT[unit];
}

export function editorUnitToMetres(value: number, unit: EditorLengthUnit): number {
  return value * METRES_PER_UNIT[unit];
}

export function editorUnitDecimals(unit: EditorLengthUnit): number {
  return unit === "m" ? 4 : unit === "mm" ? 1 : unit === "ft" ? 3 : 2;
}
