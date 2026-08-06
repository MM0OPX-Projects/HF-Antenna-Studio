import type { ValidationResult } from "../../engine/validation";
import type { FrequencyRange, GroundConfig } from "../../templates/types";
import { useSimulationStore, type SimulationStatus } from "../../stores/simulationStore";
import { useUIStore } from "../../stores/uiStore";
import { applyMatching, formatGain, formatSwr, swrColorClass } from "../../utils/units";
import { HelpTip } from "./HelpTip";

const STATUS_COPY: Record<SimulationStatus, { label: string; detail: string; className: string }> = {
  idle: { label: "Not calculated", detail: "Inputs have changed or no run has started.", className: "text-text-secondary" },
  loading: { label: "Calculating", detail: "NEC-2 is solving the current model.", className: "text-accent" },
  success: { label: "Results current", detail: "Values correspond to the displayed model.", className: "text-swr-excellent" },
  error: { label: "Calculation failed", detail: "No calculated values are being presented.", className: "text-swr-bad" },
};

interface CalculationStatusProps {
  status: SimulationStatus;
  compact?: boolean;
}

export function CalculationStatus({ status, compact = false }: CalculationStatusProps) {
  const copy = STATUS_COPY[status];
  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite" data-testid="calculation-status">
      <span className={`relative grid h-5 w-5 place-items-center rounded-full border border-current ${copy.className}`} aria-hidden="true">
        {status === "loading" ? <span className="h-2 w-2 animate-pulse rounded-full bg-current" /> : status === "success" ? "✓" : status === "error" ? "!" : "–"}
      </span>
      <span>
        <span className={`block text-xs font-semibold ${copy.className}`}>{copy.label}</span>
        {!compact && <span className="block text-[10px] text-text-secondary">{copy.detail}</span>}
      </span>
    </div>
  );
}

interface EngineeringSummaryPanelProps {
  templateName: string;
  frequencyRange: FrequencyRange;
  ground: GroundConfig;
  modelSegments: number;
  validation: ValidationResult;
}

function Metric({ label, value, unit, className = "text-text-primary" }: { label: string; value: string; unit?: string; className?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{label}</dt>
      <dd className={`mt-1 font-mono text-lg font-semibold ${className}`}>
        {value}{unit && <span className="ml-1 text-[11px] font-medium text-text-secondary">{unit}</span>}
      </dd>
    </div>
  );
}

export function EngineeringSummaryPanel({ templateName, frequencyRange, ground, modelSegments, validation }: EngineeringSummaryPanelProps) {
  const status = useSimulationStore((state) => state.status);
  const result = useSimulationStore((state) => state.result);
  const error = useSimulationStore((state) => state.error);
  const selected = useSimulationStore((state) => state.getSelectedFrequencyResult());
  const matching = useUIStore((state) => state.matching);
  const matched = selected ? applyMatching(selected.impedance.real, selected.impedance.imag, matching) : null;
  const issues = validation.issues;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-accent">Calculated values</p>
            <h2 className="mt-0.5 text-sm font-semibold">Engineering summary</h2>
          </div>
          <HelpTip label="About calculated values">Calculated values come from the local NEC-2 result. When model inputs change, stale values are removed instead of being shown against the new geometry.</HelpTip>
        </div>
        <div className="mt-3 rounded-lg border border-border bg-background/60 p-3">
          <CalculationStatus status={status} />
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section aria-labelledby="model-input-summary">
          <h3 id="model-input-summary" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Input conditions</h3>
          <dl className="mt-2 space-y-2 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-text-secondary">Antenna</dt><dd className="text-right font-medium">{templateName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-text-secondary">Sweep</dt><dd className="text-right font-mono">{frequencyRange.start_mhz.toFixed(3)}–{frequencyRange.stop_mhz.toFixed(3)} MHz</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-text-secondary">Ground</dt><dd className="text-right capitalize">{ground.type.replace(/_/g, " ")}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-text-secondary">Segments</dt><dd className="text-right font-mono">{modelSegments}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="primary-result-summary">
          <div className="flex items-center justify-between gap-2">
            <h3 id="primary-result-summary" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Selected-frequency result</h3>
            {selected && <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px]">{selected.frequency_mhz.toFixed(3)} MHz</span>}
          </div>
          {status === "success" && selected && matched ? (
            <dl className="mt-2 grid grid-cols-2 gap-2">
              <Metric label="SWR" value={formatSwr(matched.swr)} unit={`at ${matching.feedlineZ0} Ω`} className={swrColorClass(matched.swr)} />
              <Metric label="Peak gain" value={formatGain(selected.gain_max_dbi).replace(" dBi", "")} unit="dBi" />
              <Metric label="Resistance R" value={matched.real.toFixed(1)} unit="Ω" />
              <Metric label="Reactance X" value={`${matched.imag >= 0 ? "+" : ""}${matched.imag.toFixed(1)}`} unit="Ω" />
              <div className="col-span-2 rounded-lg border border-border/70 bg-background/60 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Complex impedance</dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-text-primary">
                  {matched.real.toFixed(1)} {matched.imag >= 0 ? "+" : "-"} j{Math.abs(matched.imag).toFixed(1)} Ω
                </dd>
              </div>
              <div className="col-span-2 rounded-lg border border-border/70 bg-background/60 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Peak direction</dt>
                <dd className="mt-1 font-mono text-sm">θ {selected.gain_max_theta.toFixed(1)}° · φ {selected.gain_max_phi.toFixed(1)}°</dd>
              </div>
            </dl>
          ) : (
            <div className="mt-2 rounded-lg border border-dashed border-border p-4 text-center text-xs leading-5 text-text-secondary">
              {status === "error" ? error ?? "The solver did not return a result." : "Run the current model to populate calculated values."}
            </div>
          )}
        </section>

        <section aria-labelledby="model-diagnostics">
          <div className="flex items-center justify-between gap-2">
            <h3 id="model-diagnostics" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Model diagnostics</h3>
            <span className="text-[10px] text-text-secondary">{issues.length} modelling · {result?.warnings.length ?? 0} solver</span>
          </div>
          {issues.length === 0 && (result?.warnings.length ?? 0) === 0 ? (
            <p className="mt-2 rounded-lg border border-swr-excellent/25 bg-swr-excellent/5 p-3 text-xs text-text-secondary"><strong className="text-swr-excellent">No reported warnings.</strong> This does not prove the model is physically valid.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {issues.slice(0, 4).map((issue, index) => <li key={`${issue.message}-${index}`} className="rounded-lg border border-swr-warning/30 bg-swr-warning/5 p-2 text-xs leading-5"><strong className="mr-1 text-swr-warning">{issue.severity === "error" ? "Error:" : "Warning:"}</strong>{issue.message}</li>)}
              {result?.warnings.slice(0, 3).map((warning, index) => <li key={`${warning}-${index}`} className="rounded-lg border border-swr-warning/30 bg-swr-warning/5 p-2 text-xs leading-5"><strong className="mr-1 text-swr-warning">NEC warning:</strong>{warning}</li>)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
