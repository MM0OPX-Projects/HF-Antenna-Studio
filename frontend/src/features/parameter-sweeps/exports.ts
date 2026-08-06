import type { ParameterSweepResult } from "./types";

export function buildParameterSweepExport(result: ParameterSweepResult): string {
  return JSON.stringify({
    format: "hf-antenna-studio-parameter-sweep",
    formatVersion: 1,
    notice: "Generated dimensions are model inputs, not construction recommendations or measured performance.",
    result,
  }, null, 2);
}

export function exportParameterSweepJson(result: ParameterSweepResult): void {
  const blob = new Blob([buildParameterSweepExport(result)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hf-antenna-studio-parameter-sweep.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
