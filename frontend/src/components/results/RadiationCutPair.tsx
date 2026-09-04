import { useMemo, useState } from "react";
import type { PatternData } from "../../api/nec";
import { HeightPolarPlot, type PolarSeries } from "../../features/height-lab/HeightPolarPlot";
import type { PatternDisplayMode } from "../../features/height-lab/types";
import { Card } from "../ui/Card";
import { radiationCutSeriesFromPattern } from "./radiation-cuts";

interface RadiationCutPairProps {
  pattern?: PatternData | null;
  azimuthSeries?: PolarSeries[];
  elevationSeries?: PolarSeries[];
  title?: string;
  context?: string;
  emptyMessage?: string;
  pending?: boolean;
  stale?: boolean;
  testId?: string;
  compact?: boolean;
}

export function RadiationCutPair({
  pattern,
  azimuthSeries,
  elevationSeries,
  title = "Radiation cuts",
  context,
  emptyMessage = "Run the current antenna model to calculate both radiation cuts.",
  pending = false,
  stale = false,
  testId = "radiation-cut-pair",
  compact = false,
}: RadiationCutPairProps) {
  const [mode, setMode] = useState<PatternDisplayMode>("absolute");
  const derived = useMemo(() => pattern ? radiationCutSeriesFromPattern(pattern) : null, [pattern]);
  const azimuth = azimuthSeries ?? derived?.azimuth ?? [];
  const elevation = elevationSeries ?? derived?.elevation ?? [];
  const available = azimuth.length > 0 && elevation.length > 0;
  const cutContext = context ?? (derived
    ? `Azimuth starts at the strongest ${derived.azimuthElevationDeg.toFixed(1)}° NEC row and can be changed below · elevation plane ${derived.elevationBearingDeg.toFixed(1)}° → ${((derived.elevationBearingDeg + 180) % 360).toFixed(1)}° bearing`
    : undefined);

  return <section className="space-y-2" data-testid={testId} aria-label={title}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <p className="mt-0.5 text-[10px] leading-4 text-text-secondary">{cutContext ?? "Azimuth and full 0–180° elevation views use the same solved NEC pattern grid."}</p>
      </div>
      <button
        type="button"
        data-testid={`${testId}-mode`}
        aria-label="Change radiation cut gain display"
        onClick={() => setMode((current) => current === "absolute" ? "normalised" : "absolute")}
        className="rounded border border-border bg-surface px-2 py-1 text-[10px] text-text-secondary hover:border-accent hover:text-text-primary"
      >
        {mode === "absolute" ? "Absolute gain (dBi)" : "Relative pattern (dB)"}
      </button>
    </div>
    {stale && <p role="status" className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-600">The displayed controls no longer match this pattern. Recalculate before using it for comparison.</p>}
    {!available && <Card className="grid min-h-32 place-items-center p-5 text-center text-xs text-text-secondary" data-testid={`${testId}-empty`}>
      {pending ? "Calculating azimuth and elevation cuts with NEC…" : emptyMessage}
    </Card>}
    {available && <div className={`grid gap-3 ${compact ? "lg:grid-cols-2" : "2xl:grid-cols-2"}`}>
      <Card className="overflow-hidden p-2" data-testid={`${testId}-azimuth`}><div className={compact ? "mx-auto w-full max-w-[500px]" : undefined}><HeightPolarPlot plane="azimuth" mode={mode} compactControls={compact} series={pattern && !azimuthSeries ? azimuth.map((item) => ({ ...item, pattern, azimuthConvention: "legacy-compass" as const })) : azimuth} /></div></Card>
      <Card className="overflow-hidden p-2" data-testid={`${testId}-elevation`}><div className={compact ? "mx-auto w-full max-w-[500px]" : undefined}><HeightPolarPlot plane="elevation" mode={mode} series={elevation} /></div></Card>
    </div>}
  </section>;
}
