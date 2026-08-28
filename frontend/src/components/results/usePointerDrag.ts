import { useRef, type MouseEvent, type PointerEvent } from "react";

/**
 * Keep a primary-button pointer gesture active until release or cancellation.
 * Pointer capture makes an angle drag continuous even when the pointer moves
 * outside the SVG before returning.
 */
export function usePointerDrag<T extends Element>(
  updateFromPointer: (event: PointerEvent<T>) => void,
) {
  const activePointerId = useRef<number | null>(null);

  const finish = (event: PointerEvent<T>) => {
    if (activePointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointerId.current = null;
  };

  return {
    onClick: (event: MouseEvent<T>) => event.stopPropagation(),
    onPointerDown: (event: PointerEvent<T>) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      activePointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateFromPointer(event);
    },
    onPointerMove: (event: PointerEvent<T>) => {
      if (activePointerId.current !== event.pointerId) return;
      if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
        finish(event);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      updateFromPointer(event);
    },
    onPointerUp: (event: PointerEvent<T>) => {
      if (activePointerId.current !== event.pointerId) return;
      event.stopPropagation();
      updateFromPointer(event);
      finish(event);
    },
    onPointerCancel: finish,
    onLostPointerCapture: (event: PointerEvent<T>) => {
      if (activePointerId.current === event.pointerId) activePointerId.current = null;
    },
  };
}
