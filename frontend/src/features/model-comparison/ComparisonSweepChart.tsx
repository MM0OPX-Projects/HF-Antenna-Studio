import { useState } from "react";
import { AnalyserChart, type AnalyserMetric } from "../frequency-analyser/AnalyserChart";
import type { ComparisonResult } from "./types";

const METRICS: Array<{ id: AnalyserMetric; label: string }> = [
  { id: "swr", label: "SWR" }, { id: "resistance", label: "R" }, { id: "reactance", label: "X" },
];

export function ComparisonSweepChart({ results }: { results: ComparisonResult[] }) {
  const sweeps = results.flatMap((result) => result.sweep ? [result.sweep] : []);
  const [metric, setMetric] = useState<AnalyserMetric>("swr");
  const [cursor, setCursor] = useState(() => sweeps[0]?.config.startMhz ?? 0);
  if (sweeps.length === 0) return <div className="flex h-64 items-center justify-center text-sm text-text-secondary" data-testid="comparison-sweep-empty">No compatible single-port impedance sweeps are available.</div>;
  const selected = Number.isFinite(cursor) && cursor > 0 ? cursor : sweeps[0]!.config.startMhz;
  return <div data-testid="comparison-sweep-chart">
    <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Frequency-sweep metric">{METRICS.map((item) => <button key={item.id} type="button" data-testid={`comparison-sweep-${item.id}`} aria-pressed={metric === item.id} onClick={() => setMetric(item.id)} className={`rounded border px-2 py-1 text-xs ${metric === item.id ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary"}`}>{item.label}</button>)}</div>
    <div className="sr-only" data-testid="comparison-sweep-series-count">{sweeps.length}</div>
    <AnalyserChart active={sweeps[0]!} saved={sweeps.slice(1)} metric={metric} selectedFrequencyMhz={selected} onCursorFrequency={setCursor} />
  </div>;
}
