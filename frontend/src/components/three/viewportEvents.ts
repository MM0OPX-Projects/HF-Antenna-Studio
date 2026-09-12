import type { MouseEvent, WheelEvent } from "react";

/** Keep wheel zoom inside a 3D viewport instead of scrolling its page parent. */
export function preventViewportScroll(event: WheelEvent<HTMLElement>): void {
  event.preventDefault();
  event.stopPropagation();
}

/** Prevent Firefox/Chromium middle-click auto-scroll from taking over the page. */
export function preventViewportAutoScroll(event: MouseEvent<HTMLElement>): void {
  if (event.button !== 1) return;
  event.preventDefault();
  event.stopPropagation();
}
