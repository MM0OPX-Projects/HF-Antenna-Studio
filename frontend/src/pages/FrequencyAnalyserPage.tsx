import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SmithChart } from "../components/results/SmithChart";
import { Card } from "../components/ui/Card";
import { useAntennaStore } from "../stores/antennaStore";
import type { SimulateAdvancedRequest } from "../engine/types";
import { getBandsForRegion } from "../utils/ham-bands";
import { AnalyserChart, type AnalyserMetric } from "../features/frequency-analyser/AnalyserChart";
import { centerSpanToStartStop, deriveAnalyserPoints, nearestPointIndex, startStopToCenterSpan, validateSweepConfig } from "../features/frequency-analyser/math";
import { runAnalyserSweep } from "../features/frequency-analyser/service";
import { exportAnalyserCsv, exportAnalyserProject, exportChartPng } from "../features/frequency-analyser/exports";
import type { AnalyserSweep, SweepConfig, SweepEntryMode } from "../features/frequency-analyser/types";

const DEFAULT_CONFIG: SweepConfig = { mode: "start-stop", startMhz: 14, stopMhz: 14.35, points: 81, referenceOhms: 50 };
const METRICS: Array<{ id: AnalyserMetric; label: string }> = [
  { id: "swr", label: "SWR" }, { id: "resistance", label: "R" }, { id: "reactance", label: "X" },
  { id: "magnitude", label: "|Z|" }, { id: "returnLoss", label: "Return loss" }, { id: "reflection", label: "|Γ|" },
];

function numberText(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "∞";
}

function NumericInput({ label, value, onChange, min, max, step = "any", testId }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number | "any"; testId?: string }) {
  return <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</span><input data-testid={testId} type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.valueAsNumber)} className="w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent" /></label>;
}

export function FrequencyAnalyserPage() {
  const template = useAntennaStore((state) => state.template);
  const wires = useAntennaStore((state) => state.wireGeometry);
  const excitations = useAntennaStore((state) => state.excitations);
  const ground = useAntennaStore((state) => state.ground);
  const loads = useAntennaStore((state) => state.loads);
  const transmissionLines = useAntennaStore((state) => state.transmissionLines);
  const [config, setConfig] = useState<SweepConfig>(DEFAULT_CONFIG);
  const [metric, setMetric] = useState<AnalyserMetric>("swr");
  const [activeSweep, setActiveSweep] = useState<AnalyserSweep | null>(null);
  const [savedSweeps, setSavedSweeps] = useState<AnalyserSweep[]>([]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [showSmith, setShowSmith] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "cancelled" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const jobRef = useRef(0);
  const chartRef = useRef<HTMLDivElement>(null);

  const antennaSnapshot = useMemo<SimulateAdvancedRequest>(() => ({
    wires, excitations, ground,
    frequency: { start_mhz: config.startMhz, stop_mhz: config.stopMhz, steps: config.points },
    loads: loads.length ? loads : undefined,
    transmission_lines: transmissionLines.length ? transmissionLines : undefined,
    compute_currents: false,
    compute_pattern: false,
  }), [wires, excitations, ground, config.startMhz, config.stopMhz, config.points, loads, transmissionLines]);
  const validationErrors = useMemo(() => validateSweepConfig(config), [config]);
  const longestSegmentWavelengths = useMemo(() => {
    if (!Number.isFinite(config.stopMhz) || config.stopMhz <= 0 || wires.length === 0) return 0;
    const wavelengthM = 299.792458 / config.stopMhz;
    return Math.max(...wires.map((wire) => Math.hypot(wire.x2 - wire.x1, wire.y2 - wire.y1, wire.z2 - wire.z1) / wire.segments / wavelengthM));
  }, [config.stopMhz, wires]);
  const centerSpan = startStopToCenterSpan(config.startMhz, config.stopMhz);
  const selectedPoint = activeSweep?.points[Math.min(cursorIndex, Math.max(0, activeSweep.points.length - 1))] ?? null;
  const overlaySweeps = savedSweeps.filter((sweep) => sweep.id !== activeSweep?.id);
  const stale = activeSweep ? activeSweep.config.startMhz !== config.startMhz || activeSweep.config.stopMhz !== config.stopMhz || activeSweep.config.points !== config.points : false;

  useEffect(() => () => controllerRef.current?.abort(), []);

  const setMode = (mode: SweepEntryMode) => setConfig((current) => ({ ...current, mode }));
  const updateRange = (partial: Partial<SweepConfig>) => setConfig((current) => ({ ...current, ...partial }));
  const setReference = (referenceOhms: number) => {
    setConfig((current) => ({ ...current, referenceOhms }));
    if (Number.isFinite(referenceOhms) && referenceOhms > 0 && referenceOhms <= 1000) {
      setActiveSweep((current) => current ? { ...current, config: { ...current.config, referenceOhms }, points: deriveAnalyserPoints(current.rawFrequencyData, referenceOhms) } : current);
    }
  };

  const runSweep = useCallback(async () => {
    if (validationErrors.length) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const job = ++jobRef.current;
    setStatus("running");
    setError(null);
    try {
      const result = await runAnalyserSweep(antennaSnapshot, config, { signal: controller.signal, colorIndex: 0 });
      if (job !== jobRef.current || controller.signal.aborted) return;
      setActiveSweep(result);
      const best = result.points.reduce((bestIndex, point, index, all) => point.swr < all[bestIndex]!.swr ? index : bestIndex, 0);
      setCursorIndex(best);
      setStatus("success");
    } catch (caught) {
      if (job !== jobRef.current) return;
      if (controller.signal.aborted) {
        setStatus("cancelled");
        setError(null);
      } else {
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "Sweep failed.");
      }
    }
  }, [antennaSnapshot, config, validationErrors]);

  const cancelSweep = () => {
    jobRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("cancelled");
  };

  const handleCursor = (frequencyMhz: number) => {
    if (!activeSweep) return;
    const index = nearestPointIndex(activeSweep.points, frequencyMhz);
    if (index >= 0) setCursorIndex(index);
  };

  const saveOverlay = () => {
    if (!activeSweep || savedSweeps.some((sweep) => sweep.id === activeSweep.id) || savedSweeps.length >= 4) return;
    setSavedSweeps((current) => [...current, { ...activeSweep, color: ["#f59e0b", "#10b981", "#a855f7", "#ef4444"][current.length]! }]);
  };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-5" data-testid="frequency-analyser-page">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Virtual antenna analyser</p><h1 className="text-2xl font-bold text-text-primary">Frequency Analyser</h1><p className="mt-1 max-w-3xl text-sm text-text-secondary">One impedance-only NEC batch runs off the main UI thread. SWR, return loss and reflection coefficient are derived from solved complex impedance at the selected reference impedance.</p></div>
          <div className="rounded-md border border-border bg-surface px-3 py-2 text-right"><div className="text-[10px] uppercase text-text-secondary">Antenna under test</div><div className="text-sm font-semibold text-text-primary">{template.name}</div><div className="text-[10px] text-text-secondary">Current Simulator model · {wires.length} wires · {wires.reduce((sum, wire) => sum + wire.segments, 0)} segments</div><Link className="text-[10px] text-accent hover:underline" to="/">Edit in Simulator</Link></div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="space-y-4 p-4">
              <div className="flex rounded-md border border-border p-1">{(["start-stop", "center-span"] as SweepEntryMode[]).map((mode) => <button key={mode} type="button" onClick={() => setMode(mode)} className={`flex-1 rounded px-2 py-1.5 text-xs ${config.mode === mode ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-hover"}`}>{mode === "start-stop" ? "Start / stop" : "Centre / span"}</button>)}</div>
              {config.mode === "start-stop" ? <div className="grid grid-cols-2 gap-3"><NumericInput label="Start (MHz)" value={config.startMhz} min={1.8} max={54} step={0.001} testId="sweep-start" onChange={(startMhz) => updateRange({ startMhz })} /><NumericInput label="Stop (MHz)" value={config.stopMhz} min={1.8} max={54} step={0.001} testId="sweep-stop" onChange={(stopMhz) => updateRange({ stopMhz })} /></div> : <div className="grid grid-cols-2 gap-3"><NumericInput label="Centre (MHz)" value={centerSpan.centerMhz} min={1.8} max={54} step={0.001} testId="sweep-centre" onChange={(centerMhz) => updateRange(centerSpanToStartStop(centerMhz, centerSpan.spanMhz))} /><NumericInput label="Span (MHz)" value={centerSpan.spanMhz} min={0.001} max={52.2} step={0.001} testId="sweep-span" onChange={(spanMhz) => updateRange(centerSpanToStartStop(centerSpan.centerMhz, spanMhz))} /></div>}
              <div className="grid grid-cols-2 gap-3"><NumericInput label="Number of points" value={config.points} min={3} max={401} step={1} testId="sweep-points" onChange={(points) => updateRange({ points })} /><NumericInput label="Reference Z₀ (Ω)" value={config.referenceOhms} min={1} max={1000} step={1} testId="reference-ohms" onChange={setReference} /></div>
              <div className="flex gap-2">{[50, 75].map((z0) => <button key={z0} onClick={() => setReference(z0)} className={`rounded border px-3 py-1 text-xs ${config.referenceOhms === z0 ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary"}`}>{z0} Ω</button>)}</div>
              <div><div className="mb-2 text-[10px] uppercase tracking-wide text-text-secondary">Region 1 band presets</div><div className="grid grid-cols-6 gap-1">{getBandsForRegion("r1").filter((band) => band.stop_mhz <= 54).map((band) => <button key={`${band.label}-${band.region}`} type="button" onClick={() => updateRange({ startMhz: band.start_mhz, stopMhz: band.stop_mhz, points: 81 })} className="rounded border border-border px-1 py-1.5 text-[10px] text-text-secondary hover:border-accent hover:text-accent">{band.label}</button>)}</div></div>
              {validationErrors.length > 0 && <ul className="space-y-1 rounded border border-red-500/30 bg-red-500/5 p-2 text-[10px] text-red-500">{validationErrors.map((message) => <li key={message}>{message}</li>)}</ul>}
              <p className={`rounded border p-2 text-[10px] leading-relaxed ${longestSegmentWavelengths > 0.1 ? "border-amber-500/40 bg-amber-500/5 text-amber-500" : "border-border text-text-secondary"}`}>Geometry and segmentation remain fixed across the sweep. At the stop frequency the longest segment is {longestSegmentWavelengths.toFixed(3)}λ{longestSegmentWavelengths > 0.1 ? "; this exceeds the usual λ/10 sanity threshold and requires model review." : "."}</p>
              <div className="flex gap-2">{status === "running" ? <button data-testid="cancel-sweep" type="button" onClick={cancelSweep} className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500">Cancel sweep</button> : <button data-testid="run-sweep" type="button" disabled={validationErrors.length > 0 || excitations.length === 0} onClick={runSweep} className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Run sweep</button>}</div>
              <div data-testid="sweep-status" aria-live="polite" className="text-xs text-text-secondary">{status === "running" ? "Calculating batched NEC sweep…" : status === "cancelled" ? "Sweep cancelled; no partial result was published." : status === "error" ? error : activeSweep ? `${activeSweep.points.length} points · ${activeSweep.computedInMs} ms · ${activeSweep.engine}` : "Ready."}</div>
            </Card>

            <Card className="space-y-3 p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Saved overlays</h2><span className="text-[10px] text-text-secondary">{savedSweeps.length}/4</span></div><button type="button" disabled={!activeSweep || savedSweeps.length >= 4 || savedSweeps.some((sweep) => sweep.id === activeSweep.id)} onClick={saveOverlay} className="w-full rounded border border-border px-2 py-1.5 text-xs text-text-secondary hover:border-accent disabled:opacity-40">Save current sweep</button>{savedSweeps.length === 0 ? <p className="text-[10px] text-text-secondary">Run and save a sweep, change the antenna or range, then run again to overlay it.</p> : savedSweeps.map((sweep) => <div key={sweep.id} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: sweep.color }} /><span className="min-w-0 flex-1 truncate">{sweep.label}</span><button aria-label={`Remove ${sweep.label}`} onClick={() => setSavedSweeps((current) => current.filter((item) => item.id !== sweep.id))} className="text-text-secondary hover:text-red-500">×</button></div>)}</Card>
          </aside>

          <section className="min-w-0 space-y-4">
            {!activeSweep ? <Card className="flex min-h-[480px] items-center justify-center p-8 text-center"><div><div className="mx-auto mb-4 h-14 w-14 rounded-full border-4 border-accent/20 border-t-accent" /><h2 className="text-lg font-semibold">Ready to sweep {template.name}</h2><p className="mt-2 max-w-xl text-sm text-text-secondary">The solver will receive one linear FR card containing all requested points. Radiation patterns and segment-current tables are deliberately omitted from analyser runs.</p></div></Card> : <>
              <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">Sweep traces</h2>{stale && <p className="text-[10px] text-amber-500">Controls have changed; chart shows the last completed sweep until you run again.</p>}</div><div className="flex flex-wrap gap-1">{METRICS.map((item) => <button key={item.id} type="button" onClick={() => setMetric(item.id)} className={`rounded border px-2 py-1 text-[10px] ${metric === item.id ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary"}`}>{item.label}</button>)}</div></div>
                <div ref={chartRef}><AnalyserChart active={activeSweep} saved={overlaySweeps} metric={metric} selectedFrequencyMhz={selectedPoint?.frequencyMhz ?? activeSweep.points[0]!.frequencyMhz} onCursorFrequency={handleCursor} /></div>
              </Card>

              {selectedPoint && <Card className="p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Cursor inspection</h2><p className="font-mono text-xs text-accent">{selectedPoint.frequencyMhz.toFixed(6)} MHz · Z₀ {activeSweep.config.referenceOhms} Ω</p></div><input aria-label="Cursor frequency point" type="range" min={0} max={activeSweep.points.length - 1} value={cursorIndex} onChange={(event) => setCursorIndex(event.target.valueAsNumber)} className="w-48 accent-accent" /></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{[
                ["SWR", numberText(selectedPoint.swr, 3)], ["R", `${numberText(selectedPoint.resistanceOhms)} Ω`], ["X", `${selectedPoint.reactanceOhms >= 0 ? "+" : ""}${numberText(selectedPoint.reactanceOhms)} Ω`], ["|Z|", `${numberText(selectedPoint.impedanceMagnitudeOhms)} Ω`], ["Return loss", `${numberText(selectedPoint.returnLossDb)} dB`], ["|Γ|", numberText(selectedPoint.reflectionMagnitude, 5)], ["∠Γ", `${numberText(selectedPoint.reflectionPhaseDeg, 2)}°`],
              ].map(([label, value]) => <div key={label} className="rounded bg-background p-2"><div className="text-[9px] uppercase text-text-secondary">{label}</div><div className="font-mono text-sm font-semibold text-text-primary">{value}</div></div>)}</div><p className="mt-2 text-[10px] text-text-secondary">Complex impedance: {numberText(selectedPoint.resistanceOhms)} {selectedPoint.reactanceOhms >= 0 ? "+" : "−"} j{numberText(Math.abs(selectedPoint.reactanceOhms))} Ω · Γ = {numberText(selectedPoint.reflectionReal, 5)} {selectedPoint.reflectionImag >= 0 ? "+" : "−"} j{numberText(Math.abs(selectedPoint.reflectionImag), 5)}</p></Card>}

              <Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={showSmith} onChange={(event) => setShowSmith(event.target.checked)} /> Optional Smith chart</label><div className="flex flex-wrap gap-2"><button onClick={() => exportAnalyserCsv([activeSweep, ...overlaySweeps])} className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:border-accent">Export CSV</button><button onClick={() => chartRef.current && exportChartPng(chartRef.current).catch((caught) => setExportError(caught instanceof Error ? caught.message : "PNG export failed."))} className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:border-accent">Export PNG</button><button onClick={() => exportAnalyserProject(template.name, { ...antennaSnapshot, frequency: { start_mhz: activeSweep.config.startMhz, stop_mhz: activeSweep.config.stopMhz, steps: activeSweep.config.points } }, activeSweep, savedSweeps)} className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:border-accent">Export project data</button></div></div>{exportError && <p className="mt-2 text-xs text-red-500">{exportError}</p>}{showSmith && <div className="mt-4 h-[460px] min-h-[360px]"><SmithChart data={activeSweep.rawFrequencyData} z0={activeSweep.config.referenceOhms} selectedIndex={cursorIndex} onFrequencyClick={setCursorIndex} responsive size={620} /></div>}</Card>
              {activeSweep.warnings.length > 0 && <Card className="border-amber-500/40 p-4"><h2 className="text-sm font-semibold text-amber-500">NEC warnings</h2><ul className="mt-2 space-y-1 font-mono text-[10px] text-text-secondary">{activeSweep.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></Card>}
            </>}
          </section>
        </div>
      </div>
    </main>
  );
}
