import { useMemo, useState } from "react";
import { Navbar } from "../components/layout/Navbar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { antennaTemplateDefinitions, getTemplateDefinition } from "../features/antenna-templates/definitions";
import { TemplateGeometry3D } from "../features/antenna-templates/TemplateGeometry3D";
import { TemplateParameterControl } from "../features/antenna-templates/TemplateParameterControl";
import { adaptTemplateToNec } from "../features/antenna-templates/nec-adapter";
import { generateTemplateModel, hasTemplateErrors, initialTemplateParameters, startingParametersForFrequency, templateModelKey } from "../features/antenna-templates/model";
import { runTemplateModel, type TemplateSolverResult } from "../features/antenna-templates/service";
import type { TemplateGround, TemplateId } from "../features/antenna-templates/schema";
import { HeightRadiation3D } from "../features/height-lab/HeightRadiation3D";
import { RadiationCutPair } from "../components/results/RadiationCutPair";
import { useUIStore } from "../stores/uiStore";

type GroundPreset = "perfect" | "average" | "pastoral" | "dry" | "custom";
const GROUND: Record<Exclude<GroundPreset, "custom">, TemplateGround> = {
  perfect: { kind: "perfect" },
  average: { kind: "real", conductivitySPerM: 0.005, relativePermittivity: 13 },
  pastoral: { kind: "real", conductivitySPerM: 0.01, relativePermittivity: 14 },
  dry: { kind: "real", conductivitySPerM: 0.001, relativePermittivity: 4 },
};

function signed(value: number): string { return `${value >= 0 ? "+" : "−"} j${Math.abs(value).toFixed(2)}`; }

export function AntennaTemplateStudioPage() {
  const conductor = useUIStore((state) => state.conductor);
  const [templateId, setTemplateId] = useState<TemplateId>("horizontal-dipole");
  const definition = useMemo(() => getTemplateDefinition(templateId), [templateId]);
  const [parametersSI, setParametersSI] = useState<Record<string, number>>(() => initialTemplateParameters(definition));
  const [imperial, setImperial] = useState(false);
  const [manualDimensions, setManualDimensions] = useState(false);
  const [groundPreset, setGroundPreset] = useState<GroundPreset>("average");
  const [conductivity, setConductivity] = useState(0.005);
  const [permittivity, setPermittivity] = useState(13);
  const [completed, setCompleted] = useState<{ key: string; result: TemplateSolverResult } | null>(null);
  const [running, setRunning] = useState(false);
  const [solverError, setSolverError] = useState<string | null>(null);

  const ground = useMemo<TemplateGround>(() => groundPreset === "custom"
    ? { kind: "real", conductivitySPerM: conductivity, relativePermittivity: permittivity }
    : GROUND[groundPreset], [conductivity, groundPreset, permittivity]);
  const generated = useMemo(() => generateTemplateModel(definition, parametersSI, ground, manualDimensions), [definition, ground, manualDimensions, parametersSI]);
  const modelKey = useMemo(() => templateModelKey(generated.model), [conductor, generated.model]);
  const result = completed?.key === modelKey ? completed.result : null;
  const adapted = useMemo(() => {
    if (hasTemplateErrors(generated)) return null;
    try { return adaptTemplateToNec(generated.model, definition); }
    catch { return null; }
  }, [conductor, definition, generated]);

  function chooseTemplate(id: TemplateId) {
    const next = getTemplateDefinition(id);
    setTemplateId(id);
    setParametersSI(initialTemplateParameters(next));
    setManualDimensions(false);
    const defaultGround = next.defaultGround ?? GROUND.average;
    if (defaultGround.kind === "perfect") {
      setGroundPreset("perfect");
    } else {
      const preset = (Object.entries(GROUND) as Array<[Exclude<GroundPreset, "custom">, TemplateGround]>).find(([, candidate]) => candidate.kind === "real" && candidate.conductivitySPerM === defaultGround.conductivitySPerM && candidate.relativePermittivity === defaultGround.relativePermittivity)?.[0] ?? "custom";
      setGroundPreset(preset);
      setConductivity(defaultGround.conductivitySPerM);
      setPermittivity(defaultGround.relativePermittivity);
    }
    setCompleted(null);
    setSolverError(null);
  }

  function updateParameter(key: string, valueSI: number) {
    const parameter = definition.parameters.find((item) => item.key === key)!;
    if (!Number.isFinite(valueSI)) return;
    const nextValue = parameter.quantity === "integer" ? Math.round(valueSI) : valueSI;
    const isWithinRange = nextValue >= parameter.minSI && nextValue <= parameter.maxSI;
    if (key === "frequencyHz" && !manualDimensions && isWithinRange) {
      setParametersSI(startingParametersForFrequency(definition, nextValue));
    } else {
      setParametersSI((current) => ({ ...current, [key]: nextValue }));
      if (parameter.dimensional) setManualDimensions(true);
    }
  }

  function chooseBand(bandId: string) {
    const band = definition.presets.find((item) => item.id === bandId)!;
    setParametersSI((current) => manualDimensions
      ? { ...current, frequencyHz: band.frequencyHz }
      : startingParametersForFrequency(definition, band.frequencyHz));
  }

  async function calculate() {
    setRunning(true);
    setSolverError(null);
    setCompleted(null);
    try {
      const solved = await runTemplateModel(generated.model, definition);
      setCompleted({ key: modelKey, result: solved });
    } catch (error) {
      setSolverError(error instanceof Error ? error.message : "The local NEC calculation failed.");
    } finally {
      setRunning(false);
    }
  }

  const errors = generated.issues.filter((issue) => issue.severity === "error");
  const warnings = [...generated.issues.filter((issue) => issue.severity === "warning"), ...(adapted?.issues ?? [])];
  return <div className="flex h-dvh flex-col bg-background">
    <Navbar />
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1500px] space-y-5 px-3 py-5 sm:px-5">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-2 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-500">Shared parametric framework · eight templates</div><h1 className="text-2xl font-bold">Antenna template studio</h1><p className="mt-1 max-w-3xl text-sm text-text-secondary">Every card below uses one SI model, validation path, segmentation policy, NEC adapter, solver service, and parameter interface.</p></div>
          <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setImperial((value) => !value)} data-testid="template-units">{imperial ? "Imperial" : "Metric"}</Button><Button variant="secondary" size="sm" onClick={() => { setParametersSI(initialTemplateParameters(definition)); setManualDimensions(false); setCompleted(null); }}>Reset template</Button></div>
        </header>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" aria-label="Antenna templates" data-testid="template-picker">
          {antennaTemplateDefinitions.map((item) => <button type="button" key={item.id} onClick={() => chooseTemplate(item.id)} data-testid={`template-${item.id}`} aria-pressed={item.id === templateId} className={`min-h-20 rounded-lg border p-3 text-left transition-colors ${item.id === templateId ? "border-violet-500 bg-violet-500/10" : "border-border bg-surface hover:border-violet-500/50"}`}><b className="block text-xs">{item.name}</b><span className="mt-1 block text-[10px] leading-snug text-text-secondary">{item.shortDescription}</span></button>)}
        </section>

        <div className="grid gap-5 xl:grid-cols-[370px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{definition.name}</h2><p className="mt-1 text-xs text-text-secondary">{definition.shortDescription}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${definition.groundRequirement === "required" ? "bg-amber-500/15 text-amber-600" : "bg-blue-500/10 text-blue-500"}`}>Ground {definition.groundRequirement}</span></div><div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"><b>Starting dimensions only.</b> No template claims that its generated length is resonant. Tune against the selected model and installation.</div></Card>

            <Card className="p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Amateur-band presets</h2><span data-testid="dimension-mode" className={`rounded-full px-2 py-1 text-[10px] ${manualDimensions ? "bg-violet-500/15 text-violet-500" : "bg-emerald-500/15 text-emerald-500"}`}>{manualDimensions ? "Manual dimensions" : "Frequency-linked start"}</span></div><div className="mt-3 grid grid-cols-6 gap-1">{definition.presets.map((band) => <button type="button" key={band.id} onClick={() => chooseBand(band.id)} data-testid={`band-${band.id}`} className="rounded border border-border px-1 py-2 text-[10px] hover:border-accent">{band.label}</button>)}</div>{manualDimensions && <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={() => { setParametersSI(startingParametersForFrequency(definition, parametersSI.frequencyHz!)); setManualDimensions(false); }} data-testid="restore-starting-dimensions">Regenerate frequency-based starting dimensions</Button>}<p className="mt-2 text-[10px] leading-relaxed text-text-secondary">Band changes preserve manual dimensions once overridden. Use the regeneration button to opt back into frequency-linked starting values.</p></Card>

            <Card className="space-y-3 p-4"><h2 className="text-sm font-semibold">Common parameter controls</h2>{definition.parameters.map((parameter) => <TemplateParameterControl key={parameter.key} definition={parameter} valueSI={parametersSI[parameter.key] ?? parameter.defaultSI} imperial={imperial} onChange={(value) => updateParameter(parameter.key, value)} />)}</Card>

            <Card className="space-y-3 p-4"><h2 className="text-sm font-semibold">Ground model</h2><select value={groundPreset} onChange={(event) => { const id = event.target.value as GroundPreset; setGroundPreset(id); if (id !== "custom") { const selected = GROUND[id]; if (selected.kind === "real") { setConductivity(selected.conductivitySPerM); setPermittivity(selected.relativePermittivity); } } }} data-testid="template-ground" className="w-full rounded border border-border bg-background px-3 py-2 text-sm"><option value="perfect">Perfect ground</option><option value="average">Average ground</option><option value="pastoral">Good pastoral ground</option><option value="dry">Dry / poor ground</option><option value="custom">Custom real ground</option></select>{ground.kind === "real" && <div className="grid grid-cols-2 gap-2"><label className="text-xs text-text-secondary">Conductivity S/m<input type="number" data-testid="template-conductivity" value={ground.conductivitySPerM} step="0.001" onChange={(event) => { setGroundPreset("custom"); setConductivity(Math.max(0, Number(event.target.value))); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono" /></label><label className="text-xs text-text-secondary">Relative εr<input type="number" data-testid="template-permittivity" value={ground.relativePermittivity} step="0.1" onChange={(event) => { setGroundPreset("custom"); setPermittivity(Math.max(1, Number(event.target.value))); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono" /></label></div>}</Card>
          </div>

          <div className="min-w-0 space-y-5">
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <Card className="overflow-hidden p-3"><div className="flex items-center justify-between px-1 pb-2"><h2 className="text-sm font-semibold">Generated geometry</h2><span className="text-[10px] text-text-secondary">updates immediately</span></div><TemplateGeometry3D model={generated.model} /></Card>
              <Card className="p-4"><h2 className="text-sm font-semibold">Model summary</h2><dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><dt className="text-text-secondary">Schema</dt><dd className="font-mono">parametric-wire-antenna/v1</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Wires</dt><dd data-testid="template-wire-count" className="font-mono">{generated.model.wires.length}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Loads</dt><dd data-testid="template-load-count" className="font-mono">{generated.model.loads.length}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Segments</dt><dd data-testid="template-segment-count" className="font-mono">{adapted?.segmentation.totalSegments ?? "—"}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Feed wire / segment</dt><dd data-testid="template-feed-segment" className="font-mono">{adapted ? `${generated.model.feed.wireId} / ${adapted.segmentation.feed.segment}` : "—"}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Segment target</dt><dd className="font-mono">≤ {definition.segmentation.maximumSegmentLengthWavelengths}λ</dd></div></dl><p className="mt-4 text-[10px] leading-relaxed text-text-secondary">{definition.segmentation.rationale}</p><ul className="mt-4 space-y-2 text-[11px] text-text-secondary">{definition.rfNotes.map((note) => <li key={note}>• {note}</li>)}</ul></Card>
            </section>

            {errors.length > 0 && <div role="alert" data-testid="template-errors" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600">{errors.map((issue) => <p key={issue.code}>• {issue.message}</p>)}</div>}
            {warnings.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">{warnings.map((issue) => <p key={`${issue.code}-${issue.message}`}>• {issue.message}</p>)}</div>}
            {solverError && <div role="alert" data-testid="template-solver-error" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600">{solverError}</div>}

            <Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Local NEC calculation</h2><p className="mt-1 text-xs text-text-secondary">Runs the exact generated deck through the pinned browser-local nec2c/Wasm engine.</p></div><Button onClick={calculate} loading={running} disabled={errors.length > 0 || !adapted} data-testid="run-template-nec">{running ? "Calculating…" : "Run current template"}</Button></div>{!result ? <p className="mt-5 rounded border border-dashed border-border p-5 text-center text-sm text-text-secondary">Change geometry freely, then run this exact model when ready.</p> : <section data-testid="template-results" className="mt-4 grid gap-3 sm:grid-cols-4">{[
              ["Feed impedance", `${result.resistanceOhm.toFixed(2)} ${signed(result.reactanceOhm)} Ω`, "template-result-impedance"],
              ["SWR (50 Ω)", result.swr50 >= 999 ? ">999" : result.swr50.toFixed(2), "template-result-swr"],
              ["Peak gain", `${result.maximumGainDbi.toFixed(2)} dBi`, "template-result-gain"],
              ["Take-off angle", `${result.takeOffAngleDeg.toFixed(1)}°`, "template-result-takeoff"],
            ].map(([label, value, testId]) => <div key={label} className="rounded border border-border bg-background/50 p-3"><p className="text-[10px] text-text-secondary">{label}</p><p data-testid={testId} className="mt-1 font-mono text-lg font-semibold">{value}</p></div>)}</section>}</Card>

            {result && <Card className="overflow-hidden p-3"><h2 className="px-1 pb-3 text-sm font-semibold">Interactive 3D radiation pattern</h2><HeightRadiation3D pattern={result.pattern} mode="absolute" pending={false} /></Card>}

            {result && <RadiationCutPair pattern={result.pattern} title="Template radiation cuts" context="Select the azimuth slice elevation, then drag either plot cursor to inspect the solved NEC grid." testId="template-pattern-cuts" />}

            <details className="rounded-lg border border-border bg-surface p-4"><summary className="cursor-pointer text-sm font-semibold">Generated NEC model</summary><pre data-testid="template-generated-nec" className="mt-3 max-h-96 overflow-auto rounded bg-[#0b1020] p-4 text-xs leading-5 text-emerald-300">{adapted?.deck ?? "Resolve geometry errors to generate NEC."}</pre></details>
          </div>
        </div>
      </div>
    </main>
  </div>;
}
