import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { compareMeasurementToSimulation } from "../features/measurement-comparison/comparison";
import { DifferenceChart } from "../features/measurement-comparison/DifferenceChart";
import { exportMeasurementComparisonCsv, exportMeasurementComparisonProject } from "../features/measurement-comparison/exports";
import { MeasurementComparisonChart } from "../features/measurement-comparison/MeasurementComparisonChart";
import { importTouchstoneS1p } from "../features/measurement-comparison/touchstone";
import type { AlignmentMode, ComparisonMetric, MeasurementDataset } from "../features/measurement-comparison/types";
import { validateSweepConfig } from "../features/frequency-analyser/math";
import { runAnalyserSweep } from "../features/frequency-analyser/service";
import type { AnalyserSweep, SweepConfig } from "../features/frequency-analyser/types";
import type { SimulateAdvancedRequest } from "../engine/types";
import { useAntennaStore } from "../stores/antennaStore";

const DEFAULT_CONFIG: SweepConfig = { mode: "start-stop", startMhz: 14, stopMhz: 14.35, points: 81, referenceOhms: 50 };
const REASONS = [
  ["Feed line", "The analyser reference plane may be at the shack or cable end, while NEC normally reports directly at the source segment."],
  ["Common mode", "Current on the outside of coax, mast or control wiring becomes part of the measured antenna but may be absent from the model."],
  ["Connector loss", "Adapters, connectors and cable attenuation transform measured S11 and can mask the antenna's feed-point impedance."],
  ["Ground differences", "Moisture, layering, terrain and radial contact rarely equal a single perfect or homogeneous NEC ground model."],
  ["Nearby structures", "Buildings, trees, vehicles, supports and wiring couple to the real antenna unless represented explicitly."],
  ["Measurement calibration", "Calibration plane, standards, drift, cable movement and dynamic range can dominate small differences."],
  ["Real material dimensions", "Wire sag, insulation, taper, joints and construction tolerances differ from ideal coordinates and radii."],
  ["NEC limitations", "Thin-wire, segmentation, junction, ground and geometry validity limits can produce model error or numerical artefacts."],
] as const;

function valueText(value: number | null, unit = "", digits = 3): string {
  if (value === null) return "Unavailable";
  if (!Number.isFinite(value)) return `∞${unit}`;
  return `${value.toFixed(digits)}${unit}`;
}

export function MeasurementComparisonPage() {
  const template = useAntennaStore((state) => state.template);
  const wires = useAntennaStore((state) => state.wireGeometry);
  const excitations = useAntennaStore((state) => state.excitations);
  const ground = useAntennaStore((state) => state.ground);
  const loads = useAntennaStore((state) => state.loads);
  const transmissionLines = useAntennaStore((state) => state.transmissionLines);
  const [measurement, setMeasurement] = useState<MeasurementDataset | null>(null);
  const [simulation, setSimulation] = useState<AnalyserSweep | null>(null);
  const [simulationRequestKey, setSimulationRequestKey] = useState<string | null>(null);
  const [config, setConfig] = useState<SweepConfig>(DEFAULT_CONFIG);
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>("linear-simulation");
  const [metric, setMetric] = useState<ComparisonMetric>("swr");
  const [status, setStatus] = useState<"idle" | "running" | "success" | "cancelled" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const jobRef = useRef(0);

  const antennaSnapshot = useMemo<SimulateAdvancedRequest>(() => ({
    wires, excitations, ground,
    frequency: { start_mhz: config.startMhz, stop_mhz: config.stopMhz, steps: config.points },
    loads: loads.length ? loads : undefined,
    transmission_lines: transmissionLines.length ? transmissionLines : undefined,
    compute_currents: false,
    compute_pattern: false,
  }), [wires, excitations, ground, config.startMhz, config.stopMhz, config.points, loads, transmissionLines]);
  const requestKey = useMemo(() => JSON.stringify({ antennaSnapshot, referenceOhms: config.referenceOhms }), [antennaSnapshot, config.referenceOhms]);
  const validationErrors = useMemo(() => validateSweepConfig(config), [config]);
  const comparison = useMemo(() => measurement && simulation ? compareMeasurementToSimulation(measurement, simulation, alignmentMode) : null, [alignmentMode, measurement, simulation]);
  const simulationStale = simulation !== null && simulationRequestKey !== requestKey;
  const measurementInsideHfRange = measurement ? measurement.points[0]!.frequencyMhz >= 1.8 && measurement.points[measurement.points.length - 1]!.frequencyMhz <= 54 && measurement.points.length >= 2 : false;

  useEffect(() => () => controllerRef.current?.abort(), []);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    controllerRef.current?.abort();
    setError(null);
    try {
      const imported = await importTouchstoneS1p(file);
      setMeasurement(imported);
      setSimulation(null);
      setSimulationRequestKey(null);
      setStatus("idle");
    } catch (caught) {
      setMeasurement(null);
      setSimulation(null);
      setSimulationRequestKey(null);
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Measurement import failed.");
    }
  };

  const useMeasurementRange = () => {
    if (!measurementInsideHfRange || !measurement) return;
    setConfig((current) => ({ ...current, startMhz: measurement.points[0]!.frequencyMhz, stopMhz: measurement.points[measurement.points.length - 1]!.frequencyMhz, points: Math.min(401, Math.max(3, measurement.points.length)) }));
  };

  const runSimulation = async () => {
    if (!measurement || validationErrors.length) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const job = ++jobRef.current;
    const capturedKey = requestKey;
    setStatus("running");
    setError(null);
    try {
      const result = await runAnalyserSweep(antennaSnapshot, config, { signal: controller.signal, label: `SIMULATION — ${template.name}` });
      if (job !== jobRef.current || controller.signal.aborted) return;
      setSimulation(result);
      setSimulationRequestKey(capturedKey);
      setStatus("success");
    } catch (caught) {
      if (job !== jobRef.current) return;
      if (controller.signal.aborted) { setStatus("cancelled"); setError(null); }
      else { setStatus("error"); setError(caught instanceof Error ? caught.message : "Simulation failed."); }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const cancel = () => {
    jobRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("cancelled");
  };

  return <main className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-5" data-testid="measurement-comparison-page"><div className="mx-auto max-w-[1500px] space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Measured vs modelled impedance</p><h1 className="text-2xl font-bold">Measurement Comparison</h1><p className="mt-1 max-w-4xl text-sm text-text-secondary">Overlay immutable Touchstone S11 measurements with a fresh impedance-only NEC sweep. Simulation and measurement remain separately labelled throughout.</p></div><div className="rounded border border-border bg-surface px-3 py-2 text-right text-xs"><strong>{template.name}</strong><div className="text-text-secondary">Current Simulator model · {wires.length} wires</div><Link to="/" className="text-accent hover:underline">Edit simulation model</Link></div></header>

    <div className="grid gap-4 xl:grid-cols-[350px_minmax(0,1fr)]"><aside className="space-y-4">
      <Card className="space-y-3 p-4"><div><h2 className="font-semibold">MEASUREMENT</h2><p className="mt-1 text-xs text-text-secondary">Touchstone .s1p only. The original UTF-8 source and every source line are retained unchanged.</p></div><label className="block rounded border border-dashed border-amber-500/60 bg-amber-500/5 p-3 text-xs"><span className="font-semibold text-amber-600">Import measured S11</span><input data-testid="measurement-file" className="mt-2 block w-full text-xs" type="file" accept=".s1p" onChange={(event) => void importFile(event.target.files?.[0])} /></label>{measurement && <div data-testid="measurement-summary" className="space-y-1 rounded border border-amber-500/30 p-3 text-xs"><strong className="break-all">{measurement.fileName}</strong><div>{measurement.points.length} original points · {measurement.touchstoneVersion} · {measurement.dataFormat}</div><div>Z₀ {measurement.referenceOhms} Ω · {(measurement.points[0]!.frequencyMhz).toFixed(6)}–{(measurement.points[measurement.points.length - 1]!.frequencyMhz).toFixed(6)} MHz</div><details><summary className="cursor-pointer text-amber-600">Original option line and source</summary><code className="mt-1 block break-all">{measurement.optionLine}</code><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-[10px]">{measurement.sourceText}</pre></details>{measurement.warnings.map((warning) => <p key={warning} className="text-amber-600">{warning}</p>)}</div>}<p className="text-[10px] leading-relaxed text-text-secondary">NanoVNA-Saver and NanoVNA-QT can export Touchstone. CSV import is intentionally rejected because NanoVNA applications use incompatible, sometimes display-derived column layouts.</p></Card>

      <Card className="space-y-3 p-4"><div><h2 className="font-semibold">SIMULATION</h2><p className="mt-1 text-xs text-text-secondary">Uses the existing local NEC impedance-sweep pipeline. It does not read or fit the measurement.</p></div><div className="grid grid-cols-2 gap-2"><label className="space-y-1"><span className="text-[10px] uppercase text-text-secondary">Start MHz</span><input data-testid="comparison-start" type="number" value={config.startMhz} min="1.8" max="54" step="0.001" onChange={(event) => setConfig((current) => ({ ...current, startMhz: event.target.valueAsNumber }))} className="w-full rounded border border-border bg-background px-2 py-2 font-mono text-sm" /></label><label className="space-y-1"><span className="text-[10px] uppercase text-text-secondary">Stop MHz</span><input data-testid="comparison-stop" type="number" value={config.stopMhz} min="1.8" max="54" step="0.001" onChange={(event) => setConfig((current) => ({ ...current, stopMhz: event.target.valueAsNumber }))} className="w-full rounded border border-border bg-background px-2 py-2 font-mono text-sm" /></label><label className="space-y-1"><span className="text-[10px] uppercase text-text-secondary">Solved points</span><input data-testid="comparison-points" type="number" value={config.points} min="3" max="401" step="1" onChange={(event) => setConfig((current) => ({ ...current, points: event.target.valueAsNumber }))} className="w-full rounded border border-border bg-background px-2 py-2 font-mono text-sm" /></label><label className="space-y-1"><span className="text-[10px] uppercase text-text-secondary">Simulation Z₀ Ω</span><input data-testid="comparison-reference" type="number" value={config.referenceOhms} min="1" max="1000" step="1" onChange={(event) => setConfig((current) => ({ ...current, referenceOhms: event.target.valueAsNumber }))} className="w-full rounded border border-border bg-background px-2 py-2 font-mono text-sm" /></label></div><div className="flex flex-wrap gap-2"><button type="button" disabled={!measurementInsideHfRange} onClick={useMeasurementRange} className="rounded border border-border px-2 py-1.5 text-xs disabled:opacity-40">Use measurement range</button><button type="button" disabled={!measurement} onClick={() => measurement && setConfig((current) => ({ ...current, referenceOhms: measurement.referenceOhms }))} className="rounded border border-border px-2 py-1.5 text-xs disabled:opacity-40">Use measurement Z₀</button></div>{measurement && !measurementInsideHfRange && <p className="text-xs text-amber-600">The complete measured sweep must contain at least two points inside the supported 1.8–54 MHz simulation range to copy it automatically.</p>}{validationErrors.length > 0 && <ul className="list-disc pl-4 text-xs text-red-500">{validationErrors.map((message) => <li key={message}>{message}</li>)}</ul>}<div className="flex gap-2">{status === "running" ? <button data-testid="cancel-comparison-simulation" type="button" onClick={cancel} className="flex-1 rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white">Cancel</button> : <button data-testid="run-comparison-simulation" type="button" disabled={!measurement || validationErrors.length > 0} onClick={() => void runSimulation()} className="flex-1 rounded bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Run NEC simulation</button>}</div><p data-testid="comparison-status" aria-live="polite" className="text-xs text-text-secondary">{status === "running" ? "SIMULATION running off the main UI thread…" : status === "success" && simulation ? `SIMULATION complete · ${simulation.points.length} solved points · ${simulation.engine}` : status === "cancelled" ? "SIMULATION cancelled; no partial sweep was published." : status === "error" ? error : "Import MEASUREMENT data to begin."}</p></Card>

      <Card className="space-y-3 p-4"><h2 className="font-semibold">Alignment</h2><select data-testid="comparison-alignment" value={alignmentMode} onChange={(event) => setAlignmentMode(event.target.value as AlignmentMode)} className="w-full rounded border border-border bg-background px-2 py-2 text-sm"><option value="exact">Exact frequency matches only</option><option value="linear-simulation">Linear SIMULATION R/X onto MEASUREMENT frequencies</option></select><p className="text-[10px] leading-relaxed text-text-secondary">Linear mode interpolates only simulated complex impedance between bracketing solved points. It re-derives simulated SWR, does not interpolate measured values, and never extrapolates.</p></Card>
    </aside>

    <section className="min-w-0 space-y-4">{error && <Card className="border-red-500/50 p-4 text-sm text-red-500">{error}</Card>}{simulationStale && <div data-testid="comparison-stale" className="rounded border border-amber-500/50 bg-amber-500/5 p-3 text-xs text-amber-600">Simulation controls or antenna geometry changed after this run. Existing plots remain labelled historical; rerun before drawing conclusions.</div>}{!measurement || !simulation || !comparison ? <Card className="flex min-h-[520px] items-center justify-center p-8 text-center"><div><h2 className="text-lg font-semibold">MEASUREMENT + SIMULATION</h2><p className="mt-2 max-w-xl text-sm text-text-secondary">Import a one-port Touchstone measurement, choose a matching NEC sweep, and run the simulation. Measurement data never changes the model automatically.</p></div></Card> : <>
      <Card className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Overlay</h2><p className="mt-1 text-xs text-text-secondary"><span className="font-semibold text-blue-500">SIMULATION</span> is solid blue. <span className="font-semibold text-amber-500">MEASUREMENT</span> is dashed amber. Plot lines connect each source's own original samples for display.</p></div><div className="flex gap-1">{(["swr", "resistance", "reactance"] as ComparisonMetric[]).map((item) => <button key={item} type="button" onClick={() => setMetric(item)} className={`rounded border px-3 py-1.5 text-xs ${metric === item ? "border-accent bg-accent/10 text-accent" : "border-border"}`}>{item === "swr" ? "SWR" : item === "resistance" ? "R" : "X"}</button>)}</div></div><MeasurementComparisonChart measurement={measurement} simulation={simulation} metric={metric} /></Card>
      <Card className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Difference: MEASUREMENT − SIMULATION</h2><p data-testid="alignment-label" className="mt-1 text-xs text-text-secondary">{comparison.alignmentLabel} · {comparison.alignedPointCount}/{measurement.points.length} measured points aligned.</p></div><div className="flex gap-2"><button type="button" data-testid="export-comparison-csv" onClick={() => exportMeasurementComparisonCsv(measurement, simulation, comparison)} className="rounded border border-border px-2 py-1.5 text-xs">Export CSV</button><button type="button" onClick={() => exportMeasurementComparisonProject(measurement, simulation, comparison)} className="rounded border border-border px-2 py-1.5 text-xs">Export project data</button></div></div><DifferenceChart comparison={comparison} metric={metric} />{comparison.warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-600">{warning}</p>)}</Card>
      <Card className="overflow-hidden"><div className="p-4"><h2 className="font-semibold">Aligned values</h2><p className="text-xs text-text-secondary">Original measurement rows remain identified by source line. Blank simulated cells were not aligned or extrapolated.</p></div><div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[900px] text-left text-xs" data-testid="comparison-table"><thead className="sticky top-0 bg-background"><tr><th className="px-3 py-2">MHz / line</th><th>MEAS S11</th><th>MEAS SWR</th><th>MEAS R+jX</th><th>Alignment</th><th>SIM SWR</th><th>SIM R+jX</th><th>Δ SWR / R / X</th></tr></thead><tbody>{comparison.points.map((point) => <tr key={point.measurementOrdinal} className="border-t border-border"><td className="px-3 py-2 font-mono">{point.frequencyMhz.toFixed(6)} / {point.measurement.sourceLine}</td><td className="font-mono">{point.measurement.s11Real.toFixed(5)} {point.measurement.s11Imag < 0 ? "−" : "+"} j{Math.abs(point.measurement.s11Imag).toFixed(5)}</td><td>{valueText(point.measurement.swr)}</td><td>{valueText(point.measurement.resistanceOhms, " Ω")} + j{valueText(point.measurement.reactanceOhms, " Ω")}</td><td>{point.alignment ?? "not aligned"}</td><td>{valueText(point.simulation?.swr ?? null)}</td><td>{point.simulation ? `${point.simulation.resistanceOhms.toFixed(3)} + j${point.simulation.reactanceOhms.toFixed(3)} Ω` : "—"}</td><td>{valueText(point.swrDifference)} / {valueText(point.resistanceDifferenceOhms, " Ω")} / {valueText(point.reactanceDifferenceOhms, " Ω")}</td></tr>)}</tbody></table></div></Card>
    </>}</section></div>

    <Card className="p-4"><h2 className="font-semibold">Why measurement and simulation differ</h2><p className="mt-1 text-xs text-text-secondary">A mismatch is diagnostic evidence, not automatically a solver defect or a bad measurement.</p><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{REASONS.map(([title, explanation]) => <div key={title} className="rounded border border-border p-3"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-text-secondary">{explanation}</p></div>)}</div></Card>
  </div></main>;
}
