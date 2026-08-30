import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "../components/layout/Navbar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { HeightGeometry3D } from "../features/height-lab/HeightGeometry3D";
import { HeightPolarPlot, type PolarSeries } from "../features/height-lab/HeightPolarPlot";
import { HeightRadiation3D } from "../features/height-lab/HeightRadiation3D";
import { SideViewDiagram } from "../features/height-lab/SideViewDiagram";
import { exportHeightTracesCsv, exportPolarPlotPng } from "../features/height-lab/exports";
import { lowAngleGainDbi } from "../features/height-lab/metrics";
import { createHeightLabModel } from "../features/height-lab/model";
import {
  GROUND_PRESETS,
  HEIGHT_PRESETS,
  TRACE_COLORS,
  type GroundPresetId,
  type HeightLabTrace,
  type HeightUnit,
  type PatternDisplayMode,
} from "../features/height-lab/types";
import { useHeightLabCalculation } from "../features/height-lab/useHeightLabCalculation";
import { wavelengthMetres } from "../features/verified-dipole/units";
import { assessDipoleModel } from "../features/verified-dipole/validation";

const DEFAULT_FREQUENCY_MHZ = 14.1;
const DEFAULT_HEIGHT_WAVELENGTHS = 0.5;
const METRES_PER_FOOT = 0.3048;

const PHASE_LABELS = {
  idle: "Waiting for valid inputs",
  debouncing: "Waiting for slider pause",
  calculating: "Calculating with local NEC…",
  success: "Current NEC result",
  cached: "Current result restored from cache",
  error: "Calculation failed",
} as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function groundLabel(id: GroundPresetId): string {
  return GROUND_PRESETS.find((preset) => preset.id === id)?.label ?? "Custom ground";
}

export function DipoleHeightLabPage() {
  const [frequencyMhz, setFrequencyMhz] = useState(DEFAULT_FREQUENCY_MHZ);
  const [heightWavelengths, setHeightWavelengths] = useState(DEFAULT_HEIGHT_WAVELENGTHS);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("m");
  const [groundPreset, setGroundPreset] = useState<GroundPresetId>("perfect");
  const [conductivity, setConductivity] = useState(0.005);
  const [permittivity, setPermittivity] = useState(13);
  const [mode, setMode] = useState<PatternDisplayMode>("absolute");
  const [comparisons, setComparisons] = useState<HeightLabTrace[]>([]);
  const [sweeping, setSweeping] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const elevationSvgRef = useRef<SVGSVGElement | null>(null);

  const model = useMemo(() => createHeightLabModel({
    frequencyMhz,
    heightWavelengths,
    groundPreset,
    conductivitySPerM: conductivity,
    relativePermittivity: permittivity,
  }), [conductivity, frequencyMhz, groundPreset, heightWavelengths, permittivity]);
  const assessment = useMemo(() => assessDipoleModel(model), [model]);
  const calculation = useHeightLabCalculation(model, assessment.valid);
  const wavelengthM = wavelengthMetres(model.frequencyHz);
  const heightM = model.heightM;
  const displayHeight = heightUnit === "m" ? heightM : heightM / METRES_PER_FOOT;
  const lowGain = calculation.result ? lowAngleGainDbi(calculation.result) : null;
  const alreadySaved = comparisons.some((trace) => trace.modelKey === calculation.key);

  const currentTrace = useMemo<HeightLabTrace | null>(() => calculation.result ? {
    id: "current",
    modelKey: calculation.key,
    label: `Current ${heightWavelengths.toFixed(2)}λ`,
    color: "#3b82f6",
    heightM,
    heightWavelengths,
    frequencyMhz,
    groundLabel: groundLabel(groundPreset),
    result: calculation.result,
  } : null, [calculation.key, calculation.result, frequencyMhz, groundPreset, heightM, heightWavelengths]);

  const polarSeries = useMemo<PolarSeries[]>(() => [
    ...comparisons.map((trace) => ({
      id: trace.id,
      label: trace.label,
      color: trace.color,
      points: trace.result.elevationPattern,
      pattern: trace.result.radiationPattern,
    })),
    ...(currentTrace ? [{
      id: currentTrace.id,
      label: currentTrace.label,
      color: currentTrace.color,
      points: currentTrace.result.elevationPattern,
      pattern: currentTrace.result.radiationPattern,
      current: true,
    }] : []),
  ], [comparisons, currentTrace]);
  const azimuthSeries = useMemo<PolarSeries[]>(() => polarSeries.map((series) => ({
    ...series,
    points: series.id === "current"
      ? currentTrace!.result.azimuthPattern
      : comparisons.find((trace) => trace.id === series.id)!.result.azimuthPattern,
  })), [comparisons, currentTrace, polarSeries]);

  const changeGroundPreset = useCallback((id: GroundPresetId) => {
    setGroundPreset(id);
    const preset = GROUND_PRESETS.find((item) => item.id === id);
    if (preset?.conductivitySPerM !== null && preset?.conductivitySPerM !== undefined) {
      setConductivity(preset.conductivitySPerM);
      setPermittivity(preset.relativePermittivity ?? 13);
    }
  }, []);

  const saveComparison = useCallback(() => {
    if (!currentTrace || comparisons.length >= 4 || alreadySaved) return;
    const color = TRACE_COLORS.find((candidate) => !comparisons.some((trace) => trace.color === candidate)) ?? "#eab308";
    setComparisons((items) => [...items, {
      ...currentTrace,
      id: `comparison-${Date.now()}`,
      color,
      label: `${currentTrace.heightWavelengths.toFixed(2)}λ · ${currentTrace.frequencyMhz.toFixed(1)} MHz · ${currentTrace.groundLabel}`,
    }]);
  }, [alreadySaved, comparisons, currentTrace]);

  const reset = useCallback(() => {
    setFrequencyMhz(DEFAULT_FREQUENCY_MHZ);
    setHeightWavelengths(DEFAULT_HEIGHT_WAVELENGTHS);
    setHeightUnit("m");
    setGroundPreset("perfect");
    setConductivity(0.005);
    setPermittivity(13);
    setMode("absolute");
    setComparisons([]);
    setSweeping(false);
    setExportError(null);
  }, []);

  useEffect(() => {
    if (!sweeping || !calculation.result || (calculation.phase !== "success" && calculation.phase !== "cached")) return;
    const index = HEIGHT_PRESETS.findIndex((height) => Math.abs(height - heightWavelengths) < 0.001);
    if (index < 0 || index === HEIGHT_PRESETS.length - 1) {
      const stopTimer = setTimeout(() => setSweeping(false), 0);
      return () => clearTimeout(stopTimer);
    }
    const timer = setTimeout(() => setHeightWavelengths(HEIGHT_PRESETS[index + 1]!), 900);
    return () => clearTimeout(timer);
  }, [calculation.phase, calculation.result, heightWavelengths, sweeping]);

  const statusIsPending = calculation.phase === "debouncing" || calculation.phase === "calculating";
  const plotLegend = [...comparisons, ...(currentTrace ? [currentTrace] : [])];

  return (
    <div className="flex h-dvh flex-col bg-background">
      <Navbar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1500px] space-y-5 px-3 py-5 sm:px-5">
          <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">Interactive NEC laboratory · local and offline</div>
              <h1 className="text-2xl font-bold">Dipole height laboratory</h1>
              <p className="mt-1 max-w-3xl text-sm text-text-secondary">Move a horizontal ½λ dipole between 0.05λ and 2λ. Geometry responds immediately; the real nec2c/Wasm pattern is calculated only after you pause.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={reset}>Reset</Button>
              <Button variant="secondary" size="sm" onClick={() => exportHeightTracesCsv(plotLegend)} disabled={plotLegend.length === 0} data-testid="export-csv">Export CSV</Button>
              <Button variant="secondary" size="sm" onClick={async () => {
                setExportError(null);
                try { await exportPolarPlotPng(elevationSvgRef); }
                catch (error) { setExportError(error instanceof Error ? error.message : "PNG export failed."); }
              }} disabled={polarSeries.length === 0} data-testid="export-png">Export PNG</Button>
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
            <Card className="h-fit p-4 xl:sticky xl:top-4">
              <h2 className="text-sm font-semibold">Height and environment</h2>
              <p className="mt-1 text-xs text-text-secondary">The wire is exactly 0.5 wavelength long and 1 mm in diameter.</p>
              <div className="mt-5 space-y-5">
                <label htmlFor="height-slider" className="block text-xs font-medium text-text-secondary">
                  Height slider
                  <input
                    id="height-slider"
                    data-testid="height-slider"
                    type="range"
                    min="0.05"
                    max="2"
                    step="0.01"
                    value={heightWavelengths}
                    onChange={(event) => { setSweeping(false); setHeightWavelengths(Number(event.target.value)); }}
                    className="mt-2 w-full accent-blue-500"
                    aria-valuetext={`${heightWavelengths.toFixed(2)} wavelengths, ${heightM.toFixed(2)} metres`}
                  />
                </label>
                <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                  <label htmlFor="exact-height" className="text-xs font-medium text-text-secondary">Exact numerical height
                    <input
                      id="exact-height"
                      data-testid="exact-height"
                      type="number"
                      min={heightUnit === "m" ? wavelengthM * 0.05 : wavelengthM * 0.05 / METRES_PER_FOOT}
                      max={heightUnit === "m" ? wavelengthM * 2 : wavelengthM * 2 / METRES_PER_FOOT}
                      step="0.01"
                      value={Number(displayHeight.toFixed(4))}
                      onChange={(event) => {
                        setSweeping(false);
                        const metres = Number(event.target.value) * (heightUnit === "m" ? 1 : METRES_PER_FOOT);
                        setHeightWavelengths(clamp(metres / wavelengthM, 0.05, 2));
                      }}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent"
                    />
                  </label>
                  <label htmlFor="height-unit" className="text-xs font-medium text-text-secondary">Units
                    <select id="height-unit" data-testid="height-unit" value={heightUnit} onChange={(event) => setHeightUnit(event.target.value as HeightUnit)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm">
                      <option value="m">metres</option><option value="ft">feet</option>
                    </select>
                  </label>
                </div>
                <div className="rounded-md border border-blue-500/25 bg-blue-500/5 p-3">
                  <div className="flex items-baseline justify-between"><span className="text-xs text-text-secondary">Height in wavelengths</span><b className="font-mono text-xl text-blue-500" data-testid="height-wavelengths">{heightWavelengths.toFixed(2)}λ</b></div>
                  <div className="mt-1 flex justify-between text-xs"><span className="text-text-secondary">SI model height</span><span className="font-mono" data-testid="height-metres">{heightM.toFixed(4)} m</span></div>
                </div>

                <fieldset><legend className="text-xs font-medium text-text-secondary">Height presets</legend><div className="mt-2 grid grid-cols-5 gap-1">{HEIGHT_PRESETS.map((height) => <button key={height} type="button" onClick={() => { setSweeping(false); setHeightWavelengths(height); }} className={`rounded border px-1 py-2 text-[11px] font-mono ${Math.abs(height - heightWavelengths) < 0.001 ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/50"}`} data-testid={`height-preset-${height}`}>{height}λ</button>)}</div></fieldset>

                <label htmlFor="lab-frequency" className="block text-xs font-medium text-text-secondary">Frequency
                  <div className="mt-1 flex"><input id="lab-frequency" data-testid="lab-frequency" type="number" min="1.8" max="54" step="0.1" value={frequencyMhz} onChange={(event) => setFrequencyMhz(clamp(Number(event.target.value), 1.8, 54))} className="min-w-0 flex-1 rounded-l-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent" /><span className="rounded-r-md border-y border-r border-border bg-surface-hover px-3 py-2 text-xs">MHz</span></div>
                  <span className="mt-1 block font-normal">λ = {wavelengthM.toFixed(3)} m; ratio is preserved when frequency changes.</span>
                </label>

                <label htmlFor="ground-preset" className="block text-xs font-medium text-text-secondary">Ground preset
                  <select id="ground-preset" data-testid="ground-preset" value={groundPreset} onChange={(event) => changeGroundPreset(event.target.value as GroundPresetId)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    {GROUND_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label htmlFor="lab-conductivity" className="text-xs text-text-secondary">Conductivity (S/m)<input id="lab-conductivity" data-testid="lab-conductivity" type="number" min="0" step="0.001" disabled={groundPreset === "perfect"} value={conductivity} onChange={(event) => { setGroundPreset("custom"); setConductivity(Math.max(0, Number(event.target.value))); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 font-mono disabled:opacity-50" /></label>
                  <label htmlFor="lab-permittivity" className="text-xs text-text-secondary">Relative εr<input id="lab-permittivity" data-testid="lab-permittivity" type="number" min="1" step="0.1" disabled={groundPreset === "perfect"} value={permittivity} onChange={(event) => { setGroundPreset("custom"); setPermittivity(Math.max(1, Number(event.target.value))); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 font-mono disabled:opacity-50" /></label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { if (sweeping) setSweeping(false); else { setHeightWavelengths(HEIGHT_PRESETS[0]); setSweeping(true); } }} data-testid="sweep-animation">{sweeping ? "Stop sweep" : "Auto sweep"}</Button>
                  <Button size="sm" onClick={saveComparison} disabled={!currentTrace || comparisons.length >= 4 || alreadySaved} data-testid="save-comparison">{alreadySaved ? "Saved" : `Save trace (${comparisons.length}/4)`}</Button>
                </div>
              </div>
            </Card>

            <div className="min-w-0 space-y-5">
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div aria-live="polite" role="status" data-testid="calculation-status">
                    <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${calculation.phase === "calculating" ? "animate-pulse bg-amber-400" : calculation.result ? "bg-emerald-500" : "bg-blue-500"}`} />
                    <b className="text-sm">{PHASE_LABELS[calculation.phase]}</b>
                    <p className="mt-1 text-xs text-text-secondary">Geometry is now at {heightWavelengths.toFixed(2)}λ. {statusIsPending ? "Any previous current trace is hidden." : `Cache contains ${calculation.cacheEntries} result${calculation.cacheEntries === 1 ? "" : "s"}.`}</p>
                  </div>
                  <div role="radiogroup" aria-label="Radiation pattern scale" className="flex rounded-md border border-border p-1">
                    <button type="button" role="radio" aria-checked={mode === "absolute"} onClick={() => setMode("absolute")} className={`rounded px-3 py-1.5 text-xs ${mode === "absolute" ? "bg-accent text-white" : "text-text-secondary"}`} data-testid="mode-absolute">Absolute dBi</button>
                    <button type="button" role="radio" aria-checked={mode === "normalised"} onClick={() => setMode("normalised")} className={`rounded px-3 py-1.5 text-xs ${mode === "normalised" ? "bg-accent text-white" : "text-text-secondary"}`} data-testid="mode-normalised">Relative to peak</button>
                  </div>
                </div>
                {calculation.error && <p role="alert" className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">{calculation.error}</p>}
                {exportError && <p role="alert" className="mt-3 text-xs text-red-600">{exportError}</p>}
                {assessment.warnings.length > 0 && <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">{assessment.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div>}
              </Card>

              <section className="grid gap-4 lg:grid-cols-2" aria-label="Immediate dipole geometry">
                <Card className="overflow-hidden p-3"><h2 className="px-1 pb-2 text-sm font-semibold">Side-view antenna diagram</h2><SideViewDiagram heightWavelengths={heightWavelengths} heightM={heightM} /></Card>
                <Card className="overflow-hidden p-3"><h2 className="px-1 pb-2 text-sm font-semibold">Interactive 3D geometry</h2><HeightGeometry3D heightWavelengths={heightWavelengths} /></Card>
              </section>

              <section className="grid gap-3 sm:grid-cols-3" aria-label="Calculated height metrics" data-testid={calculation.result ? "height-results" : undefined}>
                <Card className="p-4"><p className="text-xs text-text-secondary">Take-off angle</p><p className="mt-1 font-mono text-2xl font-semibold" data-testid="height-result-takeoff">{calculation.result?.takeOffAngleDeg == null ? "—" : `${calculation.result.takeOffAngleDeg.toFixed(1)}°`}</p><p className="mt-1 text-[11px] text-text-secondary">Elevation of the strongest sampled lobe.</p></Card>
                <Card className="p-4"><p className="text-xs text-text-secondary">Peak gain</p><p className="mt-1 font-mono text-2xl font-semibold" data-testid="height-result-gain">{calculation.result ? `${calculation.result.maximumGainDbi.toFixed(2)} dBi` : "—"}</p><p className="mt-1 text-[11px] text-text-secondary">Highest gain anywhere on the calculated grid.</p></Card>
                <Card className="p-4"><p className="text-xs text-text-secondary">Low-angle gain (0–10°)</p><p className="mt-1 font-mono text-2xl font-semibold" data-testid="height-result-low-gain">{lowGain == null ? "—" : `${lowGain.toFixed(2)} dBi`}</p><p className="mt-1 text-[11px] text-text-secondary">Best sampled gain near the horizon.</p></Card>
              </section>

              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Comparison traces</h2><p className="mt-1 text-xs text-text-secondary">Up to four saved NEC results remain dashed and labelled while the blue current result follows the controls.</p></div><span className="text-xs text-text-secondary">{comparisons.length}/4 saved</span></div>
                <div className="mt-3 flex min-h-9 flex-wrap gap-2" data-testid="comparison-traces">
                  {plotLegend.length === 0 && <span className="text-xs text-text-secondary">No calculated traces yet.</span>}
                  {plotLegend.map((trace) => <span key={trace.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"><i className="h-2.5 w-2.5 rounded-full" style={{ background: trace.color }} />{trace.label}{trace.id !== "current" && <button type="button" aria-label={`Remove ${trace.label}`} onClick={() => setComparisons((items) => items.filter((item) => item.id !== trace.id))} className="ml-1 text-text-secondary hover:text-red-500">×</button>}</span>)}
                </div>
              </Card>

              <section className="grid gap-4 2xl:grid-cols-2" aria-label="Polar radiation patterns">
                <Card className="overflow-hidden p-3"><HeightPolarPlot plane="elevation" mode={mode} series={polarSeries} svgRef={elevationSvgRef} /></Card>
                <Card className="overflow-hidden p-3"><HeightPolarPlot plane="azimuth" mode={mode} series={azimuthSeries} /></Card>
              </section>

              <Card className="overflow-hidden p-3"><div className="px-1 pb-3"><h2 className="text-sm font-semibold">Interactive 3D radiation pattern</h2><p className="mt-1 text-xs text-text-secondary">Shape and colour use the selected dB scale. The mesh is removed immediately when height changes.</p></div><HeightRadiation3D pattern={calculation.result?.radiationPattern ?? null} mode={mode} pending={statusIsPending} /></Card>

              <Card className="p-4"><h2 className="text-sm font-semibold">Reading the pattern</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Take-off angle", "The elevation angle of maximum gain; lower angles often favour longer terrestrial paths."],
                  ["Null", "A direction where direct and reflected fields cancel, producing very low radiation."],
                  ["Main lobe", "The broad region around the direction of strongest radiation."],
                  ["Low-angle radiation", "Energy close to the horizon, shown here by the 0–10° gain metric."],
                  ["High-angle radiation", "Energy launched steeply upward; often important for shorter HF paths."],
                  ["Ground reflection", "A reflected field combines with the direct field, creating height-dependent lobes and nulls."],
                ].map(([term, explanation]) => <div key={term} className="rounded-md border border-border bg-background/60 p-3"><b className="text-xs">{term}</b><p className="mt-1 text-[11px] leading-relaxed text-text-secondary">{explanation}</p></div>)}
              </div></Card>

              <details className="rounded-lg border border-border bg-surface p-4"><summary className="cursor-pointer text-sm font-semibold">Generated NEC model and limitations</summary><pre data-testid="height-generated-nec" className="mt-3 max-h-72 overflow-auto rounded bg-[#0b1020] p-4 text-xs leading-5 text-emerald-300">{calculation.result?.generatedNec ?? "The exact NEC deck will appear with the current result."}</pre><p className="mt-3 text-xs leading-relaxed text-text-secondary">NEC-2 is a thin-wire Method of Moments approximation. The ground is homogeneous and flat; buildings, terrain, feed line, losses and installation details are excluded. Five-degree pattern sampling limits reported angle precision.</p></details>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
