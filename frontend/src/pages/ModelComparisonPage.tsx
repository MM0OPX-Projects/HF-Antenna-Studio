import { useMemo, useRef, useState } from "react";
import { Card } from "../components/ui/Card";
import { HeightPolarPlot, type PolarSeries } from "../features/height-lab/HeightPolarPlot";
import type { PatternDisplayMode } from "../features/height-lab/types";
import { ComparisonSweepChart } from "../features/model-comparison/ComparisonSweepChart";
import { exportComparisonHtml } from "../features/model-comparison/exports";
import { COMPARISON_COLORS, COMPARISON_PRESETS, FAMILY_PARAMETERS, clonePreset, comparisonConditionKey, comparisonConditionWarnings, comparisonDefinitionKey, validateComparisonDefinition } from "../features/model-comparison/model";
import { runComparisonSlot } from "../features/model-comparison/service";
import type { ComparisonConditions, ComparisonFamily, ComparisonResult, ComparisonRunPhase, ComparisonSlotDefinition } from "../features/model-comparison/types";
import { validateSweepConfig } from "../features/frequency-analyser/math";
import type { SweepConfig } from "../features/frequency-analyser/types";

const DEFAULT_CONDITIONS: ComparisonConditions = { frequencyMhz: 14.1, ground: { kind: "perfect" }, referenceImpedanceOhm: 50, azimuthElevationDeg: 10, elevationBearingDeg: 0 };
const DEFAULT_SWEEP: SweepConfig = { mode: "start-stop", startMhz: 13.8, stopMhz: 14.4, points: 11, referenceOhms: 50 };

function NumericInput({ label, value, onChange, min, max, step, testId }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number; testId: string }) {
  return <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</span><input data-testid={testId} type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.valueAsNumber)} className="w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-sm outline-none focus:border-accent" /></label>;
}

function metric(value: number | null, digits: number, unit: string) {
  return value === null || !Number.isFinite(value) ? <span className="text-text-secondary">N/A</span> : <>{value.toFixed(digits)}{unit}</>;
}

export function ModelComparisonPage() {
  const [definitions, setDefinitions] = useState<ComparisonSlotDefinition[]>(() => clonePreset("mixed"));
  const [conditions, setConditions] = useState<ComparisonConditions>(DEFAULT_CONDITIONS);
  const [sweep, setSweep] = useState<SweepConfig>(DEFAULT_SWEEP);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [phase, setPhase] = useState<ComparisonRunPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [patternMode, setPatternMode] = useState<PatternDisplayMode>("normalised");
  const controllerRef = useRef<AbortController | null>(null);

  const validationErrors = useMemo(() => [
    ...definitions.flatMap((definition, index) => validateComparisonDefinition(definition).map((message) => `Model ${index + 1}: ${message}`)),
    ...(!Number.isFinite(conditions.frequencyMhz) || conditions.frequencyMhz < 1.8 || conditions.frequencyMhz > 54 ? ["Common frequency must be from 1.8 to 54 MHz."] : []),
    ...(!Number.isFinite(conditions.azimuthElevationDeg) || conditions.azimuthElevationDeg < 10 || conditions.azimuthElevationDeg > 90 || conditions.azimuthElevationDeg % 10 !== 0 ? ["Azimuth-cut elevation must be a 10° increment from 10° to 90° so every family uses the same solved grid sample."] : []),
    ...(!Number.isFinite(conditions.elevationBearingDeg) || conditions.elevationBearingDeg < 0 || conditions.elevationBearingDeg > 350 || conditions.elevationBearingDeg % 10 !== 0 ? ["Elevation-cut bearing must be a 10° increment from 0° to 350° so every family uses the same solved grid sample."] : []),
    ...(conditions.ground.kind === "sommerfeld-norton" && (!Number.isFinite(conditions.ground.conductivitySPerM) || conditions.ground.conductivitySPerM < 0.00001 || conditions.ground.conductivitySPerM > 10) ? ["Ground conductivity must be from 0.00001 to 10 S/m."] : []),
    ...(conditions.ground.kind === "sommerfeld-norton" && (!Number.isFinite(conditions.ground.relativePermittivity) || conditions.ground.relativePermittivity < 1 || conditions.ground.relativePermittivity > 100) ? ["Relative permittivity must be from 1 to 100."] : []),
    ...validateSweepConfig(sweep),
  ], [conditions, definitions, sweep]);
  const warnings = useMemo(() => comparisonConditionWarnings(results, definitions, conditions, sweep), [conditions, definitions, results, sweep]);
  const currentConditionKey = comparisonConditionKey(conditions, sweep);
  const compatibleResults = results.filter((result) => result.conditionKey === currentConditionKey && result.definitionKey === comparisonDefinitionKey(definitions.find((definition) => definition.id === result.slotId)!));
  const polarSeries: PolarSeries[] = compatibleResults.map((result) => ({ id: result.slotId, label: result.label, color: result.color, points: result.azimuthPattern }));
  const elevationSeries: PolarSeries[] = compatibleResults.map((result) => ({ id: result.slotId, label: result.label, color: result.color, points: result.elevationPattern }));

  const updateConditions = (update: Partial<ComparisonConditions>) => setConditions((current) => ({ ...current, ...update }));
  const updateFrequency = (frequencyMhz: number) => {
    updateConditions({ frequencyMhz });
    if (Number.isFinite(frequencyMhz)) setSweep((current) => ({ ...current, startMhz: Math.max(1.8, Number((frequencyMhz * 0.975).toFixed(6))), stopMhz: Math.min(54, Number((frequencyMhz * 1.025).toFixed(6))) }));
  };
  const updateSlot = (id: string, update: Partial<ComparisonSlotDefinition>) => setDefinitions((current) => current.map((definition) => definition.id === id ? { ...definition, ...update } : definition));
  const chooseFamily = (id: string, family: ComparisonFamily) => updateSlot(id, { family, parameterValue: family === "dipole" || family === "yagi" ? 10 : family === "vertical" ? 4 : 90 });

  const runAll = async () => {
    if (validationErrors.length) return;
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    setPhase("running"); setProgress(0); setError(null); setResults([]);
    const completed: ComparisonResult[] = [];
    try {
      for (let index = 0; index < definitions.length; index += 1) {
        const result = await runComparisonSlot(definitions[index]!, conditions, { ...sweep, referenceOhms: conditions.referenceImpedanceOhm }, { signal: controller.signal, colorIndex: index });
        if (controller.signal.aborted) throw new Error("Comparison cancelled.");
        completed.push(result); setResults([...completed]); setProgress(index + 1);
      }
      setPhase("complete");
    } catch (caught) {
      if (controller.signal.aborted) { setPhase("cancelled"); setResults([]); }
      else { setPhase("error"); setResults([]); setError(caught instanceof Error ? caught.message : String(caught)); }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const applyPreset = (name: keyof typeof COMPARISON_PRESETS) => { controllerRef.current?.abort(); setDefinitions(clonePreset(name)); setResults([]); setPhase("idle"); setProgress(0); setError(null); };
  const groundText = conditions.ground.kind === "perfect" ? "Perfect ground" : `Sommerfeld/Norton · εr ${conditions.ground.relativePermittivity} · σ ${conditions.ground.conductivitySPerM} S/m`;

  return <main className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-5" data-testid="model-comparison-page">
    <div className="mx-auto max-w-[1600px] space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Controlled NEC comparison</p><h1 className="text-2xl font-bold">Model Comparison</h1><p className="mt-1 max-w-4xl text-sm text-text-secondary">Solve four antenna models under one frequency and ground definition. Only matching, current results share radiation and sweep overlays; incompatible snapshots remain visibly warned.</p></div><button data-testid="export-comparison-html" type="button" disabled={results.length === 0 || phase === "running"} onClick={() => exportComparisonHtml(results, { conditions, sweep }, warnings)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-text-secondary hover:border-accent disabled:opacity-40">Export HTML report</button></header>

      <Card className="space-y-4 p-4" data-testid="comparison-conditions"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Common comparison conditions</h2><p className="text-xs text-text-secondary">These controls apply to every model in the next run. Existing snapshots are retained only to expose a mismatch.</p></div><span className="text-xs text-accent" data-testid="comparison-condition-summary">{conditions.frequencyMhz.toFixed(3)} MHz · {groundText} · {conditions.referenceImpedanceOhm} Ω</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <NumericInput label="Frequency (MHz)" value={conditions.frequencyMhz} min={1.8} max={54} step={0.001} testId="comparison-frequency" onChange={updateFrequency} />
          <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-text-secondary">Ground model</span><select data-testid="comparison-ground" value={conditions.ground.kind} onChange={(event) => updateConditions({ ground: event.target.value === "perfect" ? { kind: "perfect" } : { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 } })} className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"><option value="perfect">Perfect</option><option value="sommerfeld-norton">Sommerfeld/Norton</option></select></label>
          {conditions.ground.kind === "sommerfeld-norton" && <><NumericInput label="Conductivity (S/m)" value={conditions.ground.conductivitySPerM} min={0.00001} max={10} step={0.001} testId="comparison-conductivity" onChange={(conductivitySPerM) => setConditions((current) => current.ground.kind === "sommerfeld-norton" ? { ...current, ground: { ...current.ground, conductivitySPerM } } : current)} /><NumericInput label="Relative permittivity" value={conditions.ground.relativePermittivity} min={1} max={100} step={1} testId="comparison-permittivity" onChange={(relativePermittivity) => setConditions((current) => current.ground.kind === "sommerfeld-norton" ? { ...current, ground: { ...current.ground, relativePermittivity } } : current)} /></>}
          <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-text-secondary">Reference impedance</span><select data-testid="comparison-reference" value={conditions.referenceImpedanceOhm} onChange={(event) => { const referenceImpedanceOhm = Number(event.target.value) as 50 | 75; updateConditions({ referenceImpedanceOhm }); setSweep((current) => ({ ...current, referenceOhms: referenceImpedanceOhm })); }} className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"><option value="50">50 Ω</option><option value="75">75 Ω</option></select></label>
          <NumericInput label="Azimuth elevation (°)" value={conditions.azimuthElevationDeg} min={10} max={90} step={10} testId="comparison-azimuth-elevation" onChange={(azimuthElevationDeg) => updateConditions({ azimuthElevationDeg })} />
          <NumericInput label="Elevation bearing (°)" value={conditions.elevationBearingDeg} min={0} max={350} step={10} testId="comparison-elevation-bearing" onChange={(elevationBearingDeg) => updateConditions({ elevationBearingDeg })} />
          <NumericInput label="Sweep start (MHz)" value={sweep.startMhz} min={1.8} max={54} step={0.001} testId="comparison-sweep-start" onChange={(startMhz) => setSweep((current) => ({ ...current, startMhz }))} />
          <NumericInput label="Sweep stop (MHz)" value={sweep.stopMhz} min={1.8} max={54} step={0.001} testId="comparison-sweep-stop" onChange={(stopMhz) => setSweep((current) => ({ ...current, stopMhz }))} />
          <NumericInput label="Sweep points" value={sweep.points} min={3} max={401} step={1} testId="comparison-sweep-points" onChange={(points) => setSweep((current) => ({ ...current, points }))} />
        </div>
      </Card>

      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Four model slots</h2><p className="text-xs text-text-secondary">Frequency-based dimensions are starting values, not resonance guarantees. The highlighted parameter is changed without tuning the model to expected results.</p></div><div className="flex flex-wrap gap-1">{(["mixed", "dipole", "vertical", "phased", "yagi"] as const).map((name) => <button key={name} type="button" data-testid={`comparison-preset-${name}`} onClick={() => applyPreset(name)} className="rounded border border-border px-2 py-1 text-xs capitalize text-text-secondary hover:border-accent">{name === "mixed" ? "Mixed example" : `${name} example`}</button>)}</div></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{definitions.map((definition, index) => { const meta = FAMILY_PARAMETERS[definition.family]; return <Card key={definition.id} className="space-y-3 p-3" data-testid={`comparison-slot-${index + 1}`}><div className="flex items-center justify-between"><span className="font-mono text-xs text-text-secondary">Model {index + 1}</span><span className="h-2.5 w-8 rounded" style={{ background: COMPARISON_COLORS[index] }} /></div><label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-text-secondary">Antenna family</span><select data-testid={`comparison-family-${index + 1}`} value={definition.family} onChange={(event) => chooseFamily(definition.id, event.target.value as ComparisonFamily)} className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"><option value="dipole">Horizontal dipole</option><option value="vertical">Elevated vertical</option><option value="phased-array">Two-element phased array</option><option value="yagi">Three-element Yagi</option></select></label><NumericInput label={`${meta.parameterLabel} ${meta.unit ? `(${meta.unit})` : ""}`} value={definition.parameterValue} min={meta.min} max={meta.max} step={meta.step} testId={`comparison-parameter-${index + 1}`} onChange={(parameterValue) => updateSlot(definition.id, { parameterValue })} /><p className="text-[10px] leading-relaxed text-text-secondary">{definition.family === "phased-array" ? "Ideal relative-current mode; no single input impedance exists." : definition.family === "vertical" ? "Explicit elevated radial wires over the common ground." : "Dimensions rescale from the common frequency; height remains exact."}</p></Card>; })}</div>
      </section>

      {validationErrors.length > 0 && <ul className="rounded border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-500" data-testid="comparison-errors">{validationErrors.map((message) => <li key={message}>{message}</li>)}</ul>}
      {warnings.length > 0 && <ul className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-600" data-testid="comparison-condition-warnings">{warnings.map((message) => <li key={message}>{message}</li>)}</ul>}
      <div className="flex flex-wrap items-center gap-3"><button data-testid="run-comparison" type="button" disabled={phase === "running" || validationErrors.length > 0} onClick={runAll} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Run four-model comparison</button>{phase === "running" && <button data-testid="cancel-comparison" type="button" onClick={() => controllerRef.current?.abort()} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white">Cancel</button>}<span data-testid="comparison-status" aria-live="polite" className="text-xs text-text-secondary">{phase === "running" ? `Calculating model ${Math.min(progress + 1, 4)} of 4…` : phase === "complete" ? `Comparison complete · ${results.length} models` : phase === "cancelled" ? "Comparison cancelled; partial results were removed." : phase === "error" ? error : "Ready to calculate four models."}</span></div>

      {results.length > 0 && <>
        <Card className="overflow-hidden" data-testid="comparison-metrics"><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-xs"><thead className="bg-background/70 text-text-secondary"><tr><th className="px-3 py-2">Model</th><th>Conditions</th><th>Gain</th><th>Take-off</th><th>F/B</th><th>Beamwidth</th><th>R</th><th>X</th><th>SWR</th></tr></thead><tbody>{results.map((result, index) => { const current = compatibleResults.includes(result); return <tr key={result.slotId} className="border-t border-border" data-testid={`comparison-result-${index + 1}`}><th className="px-3 py-2" style={{ color: result.color }}>{result.label}</th><td className={current ? "text-emerald-500" : "text-amber-500"}>{current ? "Matched" : "Changed/stale"}</td><td>{metric(result.metrics.gainDbi, 2, " dBi")}</td><td>{metric(result.metrics.takeOffAngleDeg, 1, "°")}</td><td>{metric(result.metrics.frontToBackDb, 2, " dB")}</td><td>{metric(result.metrics.beamwidthDeg, 1, "°")}</td><td>{metric(result.metrics.resistanceOhm, 2, " Ω")}</td><td>{metric(result.metrics.reactanceOhm, 2, " Ω")}</td><td>{metric(result.metrics.swr, 2, ":1")}</td></tr>; })}</tbody></table></div></Card>
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-3 text-xs">{compatibleResults.map((result) => <span key={result.slotId} className="flex items-center gap-1"><span className="h-0.5 w-5" style={{ background: result.color }} />{result.label}</span>)}</div><button type="button" data-testid="comparison-pattern-mode" onClick={() => setPatternMode((current) => current === "absolute" ? "normalised" : "absolute")} className="rounded border border-border px-2 py-1 text-xs text-text-secondary">{patternMode === "absolute" ? "Absolute dBi" : "Normalised dB"}</button></div>
        <div className="grid gap-4 lg:grid-cols-2" data-testid="comparison-pattern-overlays"><Card className="p-3"><HeightPolarPlot plane="azimuth" mode={patternMode} series={polarSeries} /><p className="text-center text-[10px] text-text-secondary">Common {conditions.azimuthElevationDeg.toFixed(1)}° elevation · compass bearing coordinates</p></Card><Card className="p-3"><HeightPolarPlot plane="elevation" mode={patternMode} series={elevationSeries} /><p className="text-center text-[10px] text-text-secondary">Common {conditions.elevationBearingDeg.toFixed(1)}° compass-bearing plane</p></Card></div>
        <Card className="p-4"><div className="mb-2"><h2 className="font-semibold">Frequency sweep comparison</h2><p className="text-xs text-text-secondary">Fixed geometry across {sweep.startMhz.toFixed(3)}–{sweep.stopMhz.toFixed(3)} MHz. Ideal-current arrays are excluded because they have no single physical input port.</p></div><ComparisonSweepChart results={compatibleResults} /></Card>
        <Card className="p-4"><h2 className="font-semibold">Solver warnings and unavailable quantities</h2><div className="mt-2 grid gap-3 md:grid-cols-2">{results.map((result) => <section key={result.slotId} className="text-xs"><h3 className="font-semibold" style={{ color: result.color }}>{result.label}</h3>{result.sweepUnavailableReason && <p className="mt-1 text-amber-600">{result.sweepUnavailableReason}</p>}{result.warnings.length ? <ul className="mt-1 list-disc space-y-1 pl-4 text-text-secondary">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="mt-1 text-text-secondary">No solver warnings reported.</p>}</section>)}</div></Card>
      </>}
      <p className="pb-4 text-xs leading-relaxed text-text-secondary">Comparisons isolate model parameters only to the extent shown. Ground, frequency, reference impedance and cut planes are explicit; feed systems, losses, supports and environment remain model-specific limitations. Similar NEC results do not establish identical real antennas.</p>
    </div>
  </main>;
}
