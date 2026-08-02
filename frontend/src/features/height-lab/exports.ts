import type { RefObject } from "react";
import type { HeightLabTrace } from "./types";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportHeightTracesCsv(traces: HeightLabTrace[]): void {
  const rows: string[][] = [[
    "trace_id", "label", "frequency_mhz", "height_m", "height_wavelengths",
    "ground", "plane", "angle_deg", "gain_dbi", "normalised_db",
  ]];
  for (const trace of traces) {
    for (const [plane, points] of [
      ["elevation", trace.result.elevationPattern],
      ["azimuth", trace.result.azimuthPattern],
    ] as const) {
      for (const point of points) {
        rows.push([
          trace.id, trace.label, trace.frequencyMhz.toString(), trace.heightM.toString(),
          trace.heightWavelengths.toString(), trace.groundLabel, plane,
          point.angleDeg.toString(), point.gainDbi.toString(), point.normalizedDb.toString(),
        ]);
      }
    }
  }
  const csv = rows.map((row) => row.map((cell) => `"${cell.split('"').join('""')}"`).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "dipole-height-comparison.csv");
}

export async function exportPolarPlotPng(
  svgRef: RefObject<SVGSVGElement | null>,
  filename = "dipole-height-elevation.png",
): Promise<void> {
  const svg = svgRef.current;
  if (!svg) throw new Error("The elevation plot is not ready to export.");
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const serialized = new XMLSerializer().serializeToString(clone);
  const source = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 760;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot create a PNG canvas.");
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim() || "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("PNG encoding failed.")),
      "image/png",
    ));
    downloadBlob(blob, filename);
  } finally {
    URL.revokeObjectURL(source);
  }
}
