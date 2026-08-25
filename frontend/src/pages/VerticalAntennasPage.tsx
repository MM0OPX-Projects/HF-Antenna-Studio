import { useMemo, useRef, useState } from "react";
import { Navbar } from "../components/layout/Navbar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { HeightPolarPlot } from "../features/height-lab/HeightPolarPlot";
import { HeightRadiation3D } from "../features/height-lab/HeightRadiation3D";
import { adaptVerticalToNec } from "../features/vertical-antennas/nec-adapter";
import { generateVerticalModel, hasVerticalErrors, regenerateVerticalStartingDimensions, startingVerticalModel, switchVerticalConfiguration, verticalModelKey, VERTICAL_BAND_PRESETS, wavelengthM } from "../features/vertical-antennas/model";
import { runVerticalModel } from "../features/vertical-antennas/service";
import type { VerticalAntennaModel, VerticalConfiguration, VerticalGround, VerticalSolverResult } from "../features/vertical-antennas/schema";
import { VerticalCurrentPlot } from "../features/vertical-antennas/VerticalCurrentPlot";
import { VerticalGeometry3D } from "../features/vertical-antennas/VerticalGeometry3D";
import { VerticalSliderField } from "../features/vertical-antennas/VerticalSliderField";

const METRES_PER_FOOT = 0.3048;
const METRES_PER_INCH = 0.0254;
const MODE_INFO: Record<VerticalConfiguration, { title: string; description: string; badge: string }> = {
  "ground-mounted-ideal": { title: "Ideal ground-mounted monopole", description: "Radiator touches an infinite lossless perfect ground plane. No radial wires are present in the geometry.", badge: "Perfect ground · idealisation" },
  "ground-mounted-explicit-radials": { title: "Ground-mounted radial field", description: "Current-carrying radial wires use NEC-2's required slightly-raised approximation over Sommerfeld/Norton soil.", badge: "Real ground · explicit currents" },
  "elevated-explicit-radials": { title: "Elevated ground plane", description: "Every elevated radial is an explicit NEC wire connected at the feed junction. Perfect or Sommerfeld/Norton ground lies below it.", badge: "Explicit radial currents" },
  "nec-radial-screen-approximation": { title: "NEC radial-screen approximation", description: "NEC's GN/RP screen approximation uses finite-ground reflection coefficients. The radial wires are not geometry and have no reported currents.", badge: "Simplified RCA-ground model" },
};

function signedReactance(value: number): string { return `${value >= 0 ? "+" : "−"} j${Math.abs(value).toFixed(2)}`; }

export function VerticalAntennasPage() {
  const [model, setModel] = useState<VerticalAntennaModel>(() => startingVerticalModel());
  const [imperial, setImperial] = useState(false);
  const [patternMode, setPatternMode] = useState<"absolute" | "normalised">("absolute");
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ key: string; result: VerticalSolverResult } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const generated = useMemo(() => generateVerticalModel(model), [model]);
  const key = useMemo(() => verticalModelKey(model), [model]);
  const adapted = useMemo(() => {
    if (hasVerticalErrors(generated)) return null;
    try { return adaptVerticalToNec(generated); } catch { return null; }
  }, [generated]);
  const result = completed?.key === key ? completed.result : null;
  const lambda = wavelengthM(model.frequencyHz);
  const lengthUnit = imperial ? "ft" : "m";
  const lengthFactor = imperial ? 1 / METRES_PER_FOOT : 1;
  const diameterUnit = imperial ? "in" : "mm";
  const diameterFactor = imperial ? 1 / METRES_PER_INCH : 1000;
  const issues = adapted?.issues ?? generated.issues;
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  function applyModel(next: VerticalAntennaModel) {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
    setFailure(null);
    setCompleted(null);
    setModel(next);
  }
  function update(next: Partial<VerticalAntennaModel>, dimensional = false) {
    applyModel({ ...model, ...next, provenance: { ...model.provenance, manualDimensions: dimensional || model.provenance.manualDimensions } });
  }
  function updateRadials(next: Partial<VerticalAntennaModel["radials"]>, dimensional = false) {
    applyModel({ ...model, radials: { ...model.radials, ...next }, provenance: { ...model.provenance, manualDimensions: dimensional || model.provenance.manualDimensions } });
  }
  function updateFrequency(frequencyHz: number) {
    if (model.provenance.manualDimensions) update({ frequencyHz });
    else applyModel(regenerateVerticalStartingDimensions(model, frequencyHz));
  }
  function updateConductivity(conductivitySPerM: number) {
    if (model.ground.kind !== "perfect") update({ ground: { ...model.ground, conductivitySPerM } });
  }
  function updatePermittivity(relativePermittivity: number) {
    if (model.ground.kind !== "perfect") update({ ground: { ...model.ground, relativePermittivity } });
  }
  async function calculate() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setFailure(null);
    setCompleted(null);
    const requestedKey = key;
    try {
      const solved = await runVerticalModel(generated, { signal: controller.signal });
      if (!controller.signal.aborted) setCompleted({ key: requestedKey, result: solved });
    } catch (error) {
      if (!controller.signal.aborted) setFailure(error instanceof Error ? error.message : "The local NEC calculation failed.");
    } finally {
      if (controllerRef.current === controller) { controllerRef.current = null; setRunning(false); }
    }
  }

  const elevationSeries = result ? [{ id: "vertical-current", label: "Current model", color: "#8b5cf6", points: result.elevationPattern, current: true }] : [];
  const azimuthSeries = result ? [{ id: "vertical-current", label: "Current model", color: "#22d3ee", points: result.azimuthPattern, current: true }] : [];
  return <div className="flex h-dvh flex-col bg-background"><Navbar /><main className="flex-1 overflow-y-auto"><div className="mx-auto max-w-[1540px] space-y-5 px-3 py-5 sm:px-5">
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-500">Ground-aware NEC vertical laboratory</div><h1 className="text-2xl font-bold">Vertical antennas</h1><p className="mt-1 max-w-3xl text-sm text-text-secondary">Model the radiator, radial geometry, and ground assumption explicitly. These modes are intentionally not interchangeable.</p></div><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setImperial((value) => !value)} data-testid="vertical-units">{imperial ? "Imperial" : "Metric"}</Button><Button variant="secondary" size="sm" onClick={() => applyModel(startingVerticalModel(model.frequencyHz, model.configuration))}>Reset model</Button></div></header>

    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Vertical model configuration">{(Object.keys(MODE_INFO) as VerticalConfiguration[]).map((configuration) => { const info = MODE_INFO[configuration]; const selected = model.configuration === configuration; return <button type="button" key={configuration} data-testid={`vertical-mode-${configuration}`} aria-pressed={selected} onClick={() => applyModel(switchVerticalConfiguration(model, configuration))} className={`rounded-lg border p-4 text-left transition-colors ${selected ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-surface hover:border-emerald-500/50"}`}><span className="block text-sm font-semibold">{info.title}</span><span className="mt-1 block text-[11px] leading-relaxed text-text-secondary">{info.description}</span><span className="mt-3 inline-block rounded-full bg-background px-2 py-1 text-[9px] font-semibold text-emerald-500">{info.badge}</span></button>; })}</section>

    <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]"><aside className="space-y-4">
      <Card className="p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Amateur-band starts</h2><span data-testid="vertical-dimension-mode" className={`rounded-full px-2 py-1 text-[10px] ${model.provenance.manualDimensions ? "bg-violet-500/15 text-violet-500" : "bg-emerald-500/15 text-emerald-500"}`}>{model.provenance.manualDimensions ? "Manual dimensions" : "Frequency-linked start"}</span></div><div className="mt-3 grid grid-cols-6 gap-1">{VERTICAL_BAND_PRESETS.map((band) => <button type="button" key={band.id} data-testid={`vertical-band-${band.id}`} onClick={() => updateFrequency(band.frequencyHz)} className="rounded border border-border px-1 py-2 text-[10px] hover:border-accent">{band.label}</button>)}</div>{model.provenance.manualDimensions && <Button size="sm" variant="secondary" className="mt-3 w-full" data-testid="vertical-regenerate" onClick={() => applyModel(regenerateVerticalStartingDimensions(model, model.frequencyHz))}>Regenerate frequency-based starting dimensions</Button>}<p className="mt-2 text-[10px] leading-relaxed text-text-secondary"><b>Starting dimensions only:</b> 0.2375λ radiator and 0.25λ radials are initial estimates, not resonance promises.</p></Card>

      <Card className="space-y-4 p-4"><h2 className="text-sm font-semibold">Radiator and frequency</h2>
        <VerticalSliderField label="Frequency" description="NEC solution frequency." value={model.frequencyHz / 1e6} min={1.8} max={54} step={0.01} unit="MHz" decimals={3} testId="vertical-frequency" onChange={(value) => updateFrequency(value * 1e6)} />
        <VerticalSliderField label="Radiator length" description="Physical conductor length; edit enters manual mode." value={model.radiatorLengthM * lengthFactor} min={0.2 * lengthFactor} max={60 * lengthFactor} step={0.01} unit={lengthUnit} testId="vertical-radiator-length" onChange={(value) => update({ radiatorLengthM: value / lengthFactor }, true)} />
        <VerticalSliderField label="Radiator diameter" description="NEC thin-wire diameter." value={model.radiatorDiameterM * diameterFactor} min={0.2 * diameterFactor / 1000} max={0.1 * diameterFactor} step={imperial ? 0.005 : 0.1} unit={diameterUnit} decimals={imperial ? 3 : 1} testId="vertical-radiator-diameter" onChange={(value) => update({ radiatorDiameterM: value / diameterFactor }, true)} />
        {model.configuration === "elevated-explicit-radials" && <VerticalSliderField label="Feed/base height" description="Height of the radial junction over ground." value={model.baseHeightM * lengthFactor} min={0.01 * lengthFactor} max={60 * lengthFactor} step={0.01} unit={lengthUnit} testId="vertical-base-height" onChange={(value) => update({ baseHeightM: value / lengthFactor }, true)} />}
        {model.configuration === "ground-mounted-explicit-radials" && <VerticalSliderField label="NEC radial clearance" description="Wire-axis height over soil; this numerical approximation is not burial depth." value={model.baseHeightM * (imperial ? 1 / METRES_PER_INCH : 1000)} min={imperial ? 0.04 : 1} max={imperial ? 4 : 100} step={imperial ? 0.01 : 1} unit={imperial ? "in" : "mm"} decimals={imperial ? 2 : 1} testId="vertical-surface-clearance" onChange={(value) => update({ baseHeightM: value / (imperial ? 1 / METRES_PER_INCH : 1000) }, true)} />}
        <div className="grid grid-cols-2 gap-2 text-[10px] text-text-secondary"><span>λ <b className="block font-mono text-text-primary">{lambda.toFixed(3)} m</b></span><span>Radiator <b className="block font-mono text-text-primary">{(model.radiatorLengthM / lambda).toFixed(4)}λ</b></span></div>
      </Card>

      {model.configuration !== "ground-mounted-ideal" && <Card className="space-y-4 p-4"><h2 className="text-sm font-semibold">{model.radials.representation === "explicit-wires" ? "Explicit radial wires" : "Simplified NEC screen"}</h2>
        <VerticalSliderField label="Radial number" description={model.radials.representation === "explicit-wires" ? "Actual NEC wires meeting at the feed." : "Density parameter on the NEC GN card."} value={model.radials.count} min={model.configuration === "ground-mounted-explicit-radials" ? 4 : model.radials.representation === "explicit-wires" ? 2 : 4} max={model.radials.representation === "explicit-wires" ? 64 : 128} step={1} unit="count" decimals={0} testId="vertical-radial-count" onChange={(value) => updateRadials({ count: Math.round(value) })} />
        <VerticalSliderField label="Radial length" description={model.radials.representation === "explicit-wires" ? "Physical length of every radial wire." : "Radius of the approximated radial screen."} value={model.radials.lengthM * lengthFactor} min={0.2 * lengthFactor} max={100 * lengthFactor} step={0.01} unit={lengthUnit} testId="vertical-radial-length" onChange={(value) => updateRadials({ lengthM: value / lengthFactor }, true)} />
        <VerticalSliderField label="Radial diameter" description={model.radials.representation === "explicit-wires" ? "Physical radial wire diameter." : "Wire diameter used in NEC's density approximation."} value={model.radials.diameterM * diameterFactor} min={0.2 * diameterFactor / 1000} max={0.1 * diameterFactor} step={imperial ? 0.005 : 0.1} unit={diameterUnit} decimals={imperial ? 3 : 1} testId="vertical-radial-diameter" onChange={(value) => updateRadials({ diameterM: value / diameterFactor }, true)} />
        {model.configuration === "elevated-explicit-radials" && <VerticalSliderField label="Radial droop" description="Angle below horizontal; endpoint clearance is checked." value={model.radials.droopAngleRad * 180 / Math.PI} min={0} max={60} step={1} unit="deg" decimals={0} testId="vertical-radial-angle" onChange={(value) => updateRadials({ droopAngleRad: value * Math.PI / 180 }, true)} />}
      </Card>}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Ground calculation</h2>
        <select data-testid="vertical-ground-kind" value={model.ground.kind} disabled={model.configuration !== "elevated-explicit-radials"} onChange={(event) => { const ground: VerticalGround = event.target.value === "perfect" ? { kind: "perfect" } : { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 }; update({ ground }); }} className="w-full rounded border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
          <option value="perfect">Perfect ground</option>
          <option value="sommerfeld-norton">Sommerfeld/Norton real ground</option>
          {model.ground.kind === "reflection-coefficient" && <option value="reflection-coefficient">Reflection-coefficient real ground</option>}
        </select>
        {model.ground.kind !== "perfect" && <div className="grid grid-cols-2 gap-2"><label className="text-xs text-text-secondary">Conductivity S/m<input type="number" data-testid="vertical-conductivity" value={model.ground.conductivitySPerM} min="0.00001" max="10" step="0.001" onChange={(event) => updateConductivity(Number(event.target.value))} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono" /></label><label className="text-xs text-text-secondary">Relative εr<input type="number" data-testid="vertical-permittivity" value={model.ground.relativePermittivity} min="1" max="100" step="0.1" onChange={(event) => updatePermittivity(Number(event.target.value))} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono" /></label></div>}
        <label className="block text-xs text-text-secondary">SWR reference<select data-testid="vertical-reference-impedance" value={model.referenceImpedanceOhm} onChange={(event) => update({ referenceImpedanceOhm: Number(event.target.value) as 50 | 75 })} className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"><option value="50">50 Ω</option><option value="75">75 Ω</option></select></label>
        <div className="rounded border border-blue-500/25 bg-blue-500/10 p-3 text-[10px] leading-relaxed text-blue-600 dark:text-blue-300" data-testid="vertical-ground-explanation">{model.configuration === "ground-mounted-ideal" ? "Infinite, perfectly conducting plane. It has no soil loss and needs no explicit radial geometry." : model.configuration === "ground-mounted-explicit-radials" ? `${model.radials.count} horizontal radial wires and their currents are solved ${model.baseHeightM.toFixed(4)} m above Sommerfeld/Norton soil. NEC-2 cannot represent buried or exactly-on-soil wires, so this clearance is a visible modelling approximation.` : model.configuration === "elevated-explicit-radials" ? `${model.radials.count} radial wires are solved as conductors. ${model.ground.kind === "perfect" ? "The ground below is still an infinite perfect plane." : "Ground interaction uses NEC-2's Sommerfeld/Norton finite-ground method."}` : "Finite ground uses NEC-2's reflection-coefficient approximation plus the GN/RP radial-screen approximation. It is not Sommerfeld/Norton; screen currents and edge diffraction are not solved explicitly."}</div>
      </Card>
    </aside>

    <div className="min-w-0 space-y-5"><section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><Card className="overflow-hidden p-3"><div className="flex items-center justify-between px-1 pb-2"><h2 className="text-sm font-semibold">Interactive antenna geometry</h2><span className="text-[10px] text-text-secondary">updates immediately</span></div><VerticalGeometry3D wires={generated.wires} modelKey={key} /></Card><Card className="p-4"><h2 className="text-sm font-semibold">NEC model identity</h2><dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><dt className="text-text-secondary">Configuration</dt><dd className="text-right">{MODE_INFO[model.configuration].title}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Wires</dt><dd data-testid="vertical-wire-count" className="font-mono">{generated.wires.length}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Radial representation</dt><dd className="text-right font-mono">{model.radials.representation}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Segments</dt><dd data-testid="vertical-segment-count" className="font-mono">{adapted?.segmentation.totalSegments ?? "—"}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Feed</dt><dd className="font-mono">radiator / 1</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Ground card</dt><dd className="font-mono">{model.ground.kind === "perfect" ? "GN 1" : model.ground.kind === "sommerfeld-norton" ? "GN 2 (S/N)" : "GN 0 (RCA)"}</dd></div></dl><p className="mt-4 text-[10px] leading-relaxed text-text-secondary">Automatic odd segmentation targets ≤0.02λ per straight wire and reports thin-wire, junction, clearance, and workload concerns.</p></Card></section>

      {errors.length > 0 && <div role="alert" data-testid="vertical-errors" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600">{errors.map((issue) => <p key={issue.code}>• {issue.message}</p>)}</div>}{warnings.length > 0 && <div data-testid="vertical-warnings" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">{warnings.map((issue) => <p key={issue.code}>• {issue.message}</p>)}</div>}{failure && <div role="alert" data-testid="vertical-solver-error" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600">{failure}</div>}

      <Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Local NEC calculation</h2><p className="mt-1 text-xs text-text-secondary">Exact displayed deck · pinned local nec2c/Wasm · stale results hidden on every model change</p></div><Button data-testid="run-vertical-nec" onClick={calculate} loading={running} disabled={errors.length > 0 || !adapted}>{running ? "Calculating…" : "Calculate vertical"}</Button></div>{!result ? <p data-testid="vertical-calculation-status" className="mt-5 rounded border border-dashed border-border p-5 text-center text-sm text-text-secondary">{running ? "Solving the current immutable model…" : "Adjust geometry, then calculate this exact model."}</p> : <section data-testid="vertical-results" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[["Feed impedance", `${result.resistanceOhm.toFixed(2)} ${signedReactance(result.reactanceOhm)} Ω`, "vertical-result-impedance"], [`SWR (${model.referenceImpedanceOhm} Ω)`, result.swr >= 999 ? ">999" : result.swr.toFixed(2), "vertical-result-swr"], ["Peak gain", `${result.maximumGainDbi.toFixed(2)} dBi`, "vertical-result-gain"], ["Take-off angle", `${result.takeOffAngleDeg.toFixed(1)}°`, "vertical-result-takeoff"], ["Azimuth variation", `${result.azimuthVariationDb.toFixed(3)} dB`, "vertical-result-azimuth-variation"], ["Solver time", `${result.computedInMs.toFixed(0)} ms`, "vertical-result-time"]].map(([label, value, testId]) => <div key={label} className="rounded border border-border bg-background/50 p-3"><p className="text-[10px] text-text-secondary">{label}</p><p data-testid={testId} className="mt-1 font-mono text-base font-semibold">{value}</p></div>)}</section>}</Card>

      <div className="flex justify-end"><button type="button" data-testid="vertical-pattern-mode" onClick={() => setPatternMode((value) => value === "absolute" ? "normalised" : "absolute")} className="rounded border border-border bg-surface px-3 py-2 text-xs">{patternMode === "absolute" ? "Absolute dBi" : "Normalised dB"}</button></div><section className="grid gap-4 lg:grid-cols-2"><HeightPolarPlot plane="elevation" mode={patternMode} series={elevationSeries} /><HeightPolarPlot plane="azimuth" mode={patternMode} series={azimuthSeries} /></section>{result && <section className="grid gap-4 xl:grid-cols-2"><Card className="overflow-hidden p-3"><h2 className="px-1 pb-3 text-sm font-semibold">Interactive 3D radiation pattern</h2><HeightRadiation3D pattern={result.radiationPattern} mode={patternMode} pending={false} /></Card><VerticalCurrentPlot points={result.currentDistribution} /></section>}<details className="rounded-lg border border-border bg-surface p-4"><summary className="cursor-pointer text-sm font-semibold">Generated NEC model</summary><pre data-testid="vertical-generated-nec" className="mt-3 max-h-96 overflow-auto rounded bg-[#0b1020] p-4 text-xs leading-5 text-emerald-300">{adapted?.deck ?? "Resolve validity errors to generate NEC."}</pre></details>
    </div></div>
  </div></main></div>;
}
