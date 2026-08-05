import type { SimulateAdvancedRequest } from "../../engine/types";
import type { AnalyserProject, AnalyserSweep } from "./types";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value: string | number): string {
  const text = typeof value === "number" && !Number.isFinite(value) ? "Infinity" : String(value);
  return `"${text.split('"').join('""')}"`;
}

export function exportAnalyserCsv(sweeps: AnalyserSweep[]): void {
  const rows: Array<Array<string | number>> = [[
    "sweep", "frequency_mhz", "reference_ohms", "resistance_ohms", "reactance_ohms",
    "impedance_magnitude_ohms", "swr", "reflection_real", "reflection_imag",
    "reflection_magnitude", "reflection_phase_deg", "return_loss_db",
  ]];
  for (const sweep of sweeps) {
    for (const point of sweep.points) {
      rows.push([
        sweep.label, point.frequencyMhz, sweep.config.referenceOhms, point.resistanceOhms,
        point.reactanceOhms, point.impedanceMagnitudeOhms, point.swr, point.reflectionReal,
        point.reflectionImag, point.reflectionMagnitude, point.reflectionPhaseDeg, point.returnLossDb,
      ]);
    }
  }
  downloadBlob(new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), "hf-antenna-studio-sweeps.csv");
}

export function exportAnalyserProject(
  antennaName: string,
  antennaSnapshot: SimulateAdvancedRequest,
  activeSweep: AnalyserSweep,
  savedSweeps: AnalyserSweep[],
): void {
  const project: AnalyserProject = {
    format: "hf-antenna-studio-frequency-analyser",
    version: 1,
    appVersion: __APP_VERSION__,
    createdAt: new Date().toISOString(),
    antennaName,
    antennaSnapshot,
    activeSweep,
    savedSweeps,
  };
  downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), "hf-antenna-studio-analyser.json");
}

export async function exportChartPng(container: HTMLElement): Promise<void> {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("The chart is not ready to export.");
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(900, Math.round(rect.width * 2));
  const height = Math.max(500, Math.round(rect.height * 2));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
  clone.setAttribute("style", "background:#ffffff;color:#111827;font-family:Arial,sans-serif");
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot create a PNG canvas.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG encoding failed.")), "image/png"));
    downloadBlob(blob, "hf-antenna-studio-analyser.png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
