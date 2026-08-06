/**
 * Bottom status bar — shows sim info, timing, segments, frequency, cache status.
 */

import { useSimulationStore } from "../../stores/simulationStore";
import { useAntennaStore } from "../../stores/antennaStore";

export function StatusBar() {
  const result = useSimulationStore((s) => s.result);
  const status = useSimulationStore((s) => s.status);
  const template = useAntennaStore((s) => s.template);
  const wireGeometry = useAntennaStore((s) => s.wireGeometry);

  const totalSegments = wireGeometry.reduce((sum, w) => sum + w.segments, 0);
  const statusLabel = status === "loading"
    ? "Calculating current model"
    : status === "success"
      ? "Results current"
      : status === "error"
        ? "Calculation failed"
        : "Ready — not calculated";

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-surface px-4 font-mono text-[11px] text-text-secondary" aria-label="Calculation and model status">
      <span className={status === "success" ? "text-swr-excellent" : status === "error" ? "text-swr-bad" : status === "loading" ? "animate-pulse text-accent" : "text-text-secondary"} role="status" aria-live="polite">
        {statusLabel}
      </span>
      <span className="text-border" aria-hidden="true">|</span>
      {/* Template */}
      <span>{template.nameShort}</span>
      <span className="text-border" aria-hidden="true">|</span>

      {/* Segments */}
      <span>{totalSegments} segments</span>
      <span className="text-border" aria-hidden="true">|</span>

      {/* Engine */}
      <span title="Calculation remains on this computer">Local NEC-2 engine</span>

      {/* Simulation result info */}
      {result && status === "success" && (
        <>
          <span className="text-border" aria-hidden="true">|</span>
          <span className="text-swr-excellent">
            {result.computed_in_ms.toFixed(0)}ms
          </span>
          <span className="text-border" aria-hidden="true">|</span>
          <span title={`${result.frequency_data.length} frequency points`}>
            {result.frequency_data.length} freq pts
          </span>
          {result.cached && (
            <>
              <span className="text-border" aria-hidden="true">|</span>
              <span className="text-swr-warning">Cached result</span>
            </>
          )}
        </>
      )}

    </footer>
  );
}
