import type { OptimisationResult } from "./types";

export function buildOptimisationExport(result: OptimisationResult): string {
  return JSON.stringify({ format: "hf-antenna-studio-antenna-optimisation", formatVersion: 1, claim: "Best solution found by the recorded bounded local search; no global optimum is established.", result }, null, 2);
}

export function exportOptimisationJson(result: OptimisationResult): void {
  const url = URL.createObjectURL(new Blob([buildOptimisationExport(result)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "hf-antenna-studio-antenna-optimisation.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
