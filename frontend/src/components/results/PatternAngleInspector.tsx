import type { GainAtAngleReading } from "./pattern-angle";

export interface PatternAngleInspectorReading {
  id: string;
  label: string;
  color: string;
  reading: GainAtAngleReading | null;
}

interface PatternAngleInspectorProps {
  angleDeg: number;
  onAngleChange: (angleDeg: number) => void;
  readings: PatternAngleInspectorReading[];
  testId?: string;
}

function sourceLabel(reading: GainAtAngleReading): string {
  if (reading.method === "exact") return "Exact NEC sample";
  return `Interpolated between ${reading.lowerAngleDeg.toFixed(1)}° and ${reading.upperAngleDeg.toFixed(1)}° NEC samples`;
}

export function PatternAngleInspector({
  angleDeg,
  onAngleChange,
  readings,
  testId = "elevation-angle-inspector",
}: PatternAngleInspectorProps) {
  return (
    <section className="mt-2 rounded-md border border-border bg-background/60 p-2" data-testid={testId} aria-label="Gain at selected elevation angle">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
          Angle above horizon
          <span className="inline-flex items-center rounded border border-border bg-surface px-2 py-1">
            <input
              type="number"
              min={0}
              max={90}
              step={0.1}
              value={Number(angleDeg.toFixed(1))}
              onChange={(event) => {
                const next = event.currentTarget.valueAsNumber;
                if (Number.isFinite(next)) onAngleChange(Math.min(90, Math.max(0, next)));
              }}
              className="w-14 bg-transparent text-right font-mono text-xs outline-none"
              aria-label="Elevation angle above horizon"
              data-testid={`${testId}-input`}
            />
            <span className="text-xs text-text-secondary">°</span>
          </span>
        </label>
        <span className="text-[10px] text-text-secondary">Click or drag across the elevation plot, type an angle, or focus the plot and use the arrow keys.</span>
      </div>
      <div className="mt-2 grid gap-1" aria-live="polite">
        {readings.map(({ id, label, color, reading }) => (
          <div key={id} className="grid gap-x-2 rounded border border-border/70 px-2 py-1 text-[11px] sm:grid-cols-[minmax(7rem,1fr)_auto_auto_minmax(12rem,1.4fr)] sm:items-center" data-testid={`${testId}-reading-${id}`}>
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </span>
            {reading ? <>
              <span className="font-mono" data-testid={`${testId}-gain-${id}`}>{reading.gainDbi.toFixed(2)} dBi</span>
              <span className="font-mono text-text-secondary">{reading.normalizedDb.toFixed(2)} dB normalised</span>
              <span className={reading.method === "exact" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"} data-testid={`${testId}-source-${id}`}>{sourceLabel(reading)}</span>
            </> : <span className="text-text-secondary sm:col-span-3">No valid pattern samples bracket this angle.</span>}
          </div>
        ))}
        {readings.length === 0 && <p className="text-[11px] text-text-secondary">Run the current antenna model to inspect gain.</p>}
      </div>
    </section>
  );
}
