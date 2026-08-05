import type { WireData } from "./types";
import { getAntennaSpan } from "./visualScale";

function roundUpNice(value: number): number {
  const exponent = Math.floor(Math.log10(value));
  const scale = 10 ** exponent;
  const fraction = value / scale;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * scale;
}

/** Return a readable adaptive grid size and scale for the current antenna geometry. */
export function getGroundGridMetrics(wires: WireData[]) {
  if (wires.length === 0) {
    return { gridSize: 100, cellSize: 1, sectionSize: 5, fadeDistance: 80 };
  }

  let maxExtent = 0;
  for (const wire of wires) {
    maxExtent = Math.max(
      maxExtent,
      Math.abs(wire.x1),
      Math.abs(wire.x2),
      Math.abs(wire.y1),
      Math.abs(wire.y2),
    );
  }
  const antennaSpan = getAntennaSpan(wires);
  const gridSize = roundUpNice(Math.max(maxExtent * 4, antennaSpan * 4));
  const cellSize = roundUpNice(gridSize / 40);
  return { gridSize, cellSize, sectionSize: cellSize * 5, fadeDistance: gridSize * 0.8 };
}
