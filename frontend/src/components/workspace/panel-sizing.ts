export type ResizeDirection = 1 | -1;

export function clampPanelSize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function resizePanelValue(
  startSize: number,
  pointerDelta: number,
  direction: ResizeDirection,
  min: number,
  max: number,
): number {
  return clampPanelSize(startSize + pointerDelta * direction, min, max);
}

export function keyboardResizeDelta(key: string, orientation: "horizontal" | "vertical"): number | null {
  if (orientation === "horizontal") {
    if (key === "ArrowLeft") return -16;
    if (key === "ArrowRight") return 16;
  } else {
    if (key === "ArrowUp") return -16;
    if (key === "ArrowDown") return 16;
  }
  return null;
}
