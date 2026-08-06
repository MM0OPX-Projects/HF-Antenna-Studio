import { useCallback, type KeyboardEvent, type PointerEvent } from "react";
import { clampPanelSize, keyboardResizeDelta, resizePanelValue, type ResizeDirection } from "./panel-sizing";

interface PanelResizeHandleProps {
  orientation: "horizontal" | "vertical";
  value: number;
  min: number;
  max: number;
  direction?: ResizeDirection;
  label: string;
  onChange: (value: number) => void;
  onReset: () => void;
}

export function PanelResizeHandle({
  orientation,
  value,
  min,
  max,
  direction = 1,
  label,
  onChange,
  onReset,
}: PanelResizeHandleProps) {
  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startPosition = orientation === "horizontal" ? event.clientX : event.clientY;
    const startSize = value;
    const cursor = orientation === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      const position = orientation === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
      onChange(resizePanelValue(startSize, position - startPosition, direction, min, max));
    };
    const handleUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  }, [direction, max, min, onChange, orientation, value]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      onChange(min);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onChange(max);
      return;
    }
    const delta = keyboardResizeDelta(event.key, orientation);
    if (delta === null) return;
    event.preventDefault();
    onChange(clampPanelSize(value + delta * direction, min, max));
  }, [direction, max, min, onChange, orientation, value]);

  const vertical = orientation === "horizontal";
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      title={`${label}. Drag, use arrow keys, or double-click to reset.`}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      className={`group relative z-20 shrink-0 touch-none bg-border/70 outline-none transition-colors hover:bg-accent focus-visible:bg-accent ${
        vertical ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"
      }`}
    >
      <span className={`absolute rounded-full bg-text-secondary/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
        vertical ? "left-1/2 top-1/2 h-10 w-0.5 -translate-x-1/2 -translate-y-1/2" : "left-1/2 top-1/2 h-0.5 w-10 -translate-x-1/2 -translate-y-1/2"
      }`} />
    </div>
  );
}
