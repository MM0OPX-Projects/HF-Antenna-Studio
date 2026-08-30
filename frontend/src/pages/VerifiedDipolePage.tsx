import { useMemo, useState } from "react";
import { Navbar } from "../components/layout/Navbar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { DipoleCurrentPlot, DipolePatternPlot } from "../features/verified-dipole/DipolePlots";
import type { DipoleGround, HorizontalDipoleModel } from "../features/verified-dipole/model";
import { adaptDipoleToNec } from "../features/verified-dipole/nec-adapter";
import type { VerifiedDipoleResult } from "../features/verified-dipole/result";
import { runVerifiedDipole } from "../features/verified-dipole/service";
import { assessDipoleModel } from "../features/verified-dipole/validation";
import { lengthToMetres, megahertzToHertz, metresToLength, wavelengthMetres, type LengthUnit } from "../features/verified-dipole/units";

interface DimensionValue { value: number; unit: LengthUnit }

const UNIT_LABELS: Record<LengthUnit, string> = { m: "metres", mm: "millimetres", ft: "feet", in: "inches" };

function DimensionInput({ id, label, dimension, onChange }: {
  id: string;
  label: string;
  dimension: DimensionValue;
  onChange: (value: DimensionValue) => void;
}) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
      {label}
      <div className="mt-1 flex">
        <input id={id} data-testid={id} type="number" step="any" value={dimension.value} onChange={(event) => onChange({ ...dimension, value: Number(event.target.value) })} className="min-w-0 flex-1 rounded-l-md border border-border bg-background px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent" />
        <select aria-label={`${label} unit`} value={dimension.unit} onChange={(event) => {
          const nextUnit = event.target.value as LengthUnit;
          const converted = metresToLength(lengthToMetres(dimension.value, dimension.unit), nextUnit);
          onChange({ value: Number(converted.toPrecision(12)), unit: nextUnit });
        }} className="rounded-r-md border-y border-r border-border bg-surface px-2 text-xs text-text-primary">
          {(Object.keys(UNIT_LABELS) as LengthUnit[]).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </select>
      </div>
    </label>
  );
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+ j" : "− j"}${Math.abs(value).toFixed(2)}`;
}

export function VerifiedDipolePage() {
  const [frequencyMhz, setFrequencyMhz] = useState(14.1);
  const [length, setLength] = useState<DimensionValue>({ value: 10.15, unit: "m" });
  const [diameter, setDiameter] = useState<DimensionValue>({ value: 1, unit: "mm" });
  const [height, setHeight] = useState<DimensionValue>({ value: 10, unit: "m" });
  const [groundKind, setGroundKind] = useState<DipoleGround["kind"]>("perfect");
  const [conductivity, setConductivity] = useState(0.005);
  const [permittivity, setPermittivity] = useState(13);
  const [referenceOhm, setReferenceOhm] = useState<50 | 75>(50);
  const [completedRun, setCompletedRun] = useState<{ modelKey: string; result: VerifiedDipoleResult } | null>(null);
  const [failedRun, setFailedRun] = useState<{ modelKey: string; message: string } | null>(null);
  const [running, setRunning] = useState(false);

  const model = useMemo<HorizontalDipoleModel>(() => ({
    schemaVersion: 1,
    kind: "center-fed-horizontal-dipole",
    frequencyHz: megahertzToHertz(frequencyMhz),
    totalLengthM: lengthToMetres(length.value, length.unit),
    wireDiameterM: lengthToMetres(diameter.value, diameter.unit),
    heightM: lengthToMetres(height.value, height.unit),
    ground: groundKind === "real"
      ? { kind: "real", conductivitySPerM: conductivity, relativePermittivity: permittivity }
      : { kind: groundKind },
    referenceImpedanceOhm: referenceOhm,
    orientation: "x",
    conductor: { kind: "perfect" },
  }), [conductivity, diameter, frequencyMhz, groundKind, height, length, permittivity, referenceOhm]);

  const assessment = useMemo(() => assessDipoleModel(model), [model]);
  const modelKey = useMemo(() => JSON.stringify(model), [model]);
  const result = completedRun?.modelKey === modelKey ? completedRun.result : null;
  const error = failedRun?.modelKey === modelKey ? failedRun.message : null;
  const generated = useMemo(() => {
    try { return adaptDipoleToNec(model); } catch { return null; }
  }, [model]);

  async function calculate() {
    setRunning(true);
    setFailedRun(null);
    setCompletedRun(null);
    try {
      const run = await runVerifiedDipole(model);
      setCompletedRun({ modelKey, result: run.result });
    } catch (caught) {
      setFailedRun({
        modelKey,
        message: caught instanceof Error ? caught.message : "The solver failed unexpectedly.",
      });
    } finally {
      setRunning(false);
    }
  }

  const allWarnings = result?.warnings ?? assessment.warnings;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <Navbar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
          <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Verified workflow · NEC-2</div>
              <h1 className="text-2xl font-bold text-text-primary">Centre-fed horizontal dipole</h1>
              <p className="mt-1 max-w-3xl text-sm text-text-secondary">One traceable path from SI parameters to the exact NEC deck, local nec2c/WASM solve, validated result model, and plots. No design leaves this browser.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono text-text-secondary">
              {['Parameters', 'SI model', 'NEC adapter', 'nec2c', 'Parser', 'Validated UI'].map((step, index) => <span key={step} className="rounded border border-border bg-surface px-2 py-1"><b className="text-accent">{index + 1}</b> {step}</span>)}
            </div>
          </header>

          <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <Card className="h-fit p-4">
              <h2 className="mb-4 text-sm font-semibold">Model inputs</h2>
              <div className="space-y-4">
                <label htmlFor="frequency-mhz" className="block text-xs font-medium text-text-secondary">Frequency
                  <div className="mt-1 flex"><input id="frequency-mhz" data-testid="frequency-mhz" type="number" min="1.8" max="54" step="0.001" value={frequencyMhz} onChange={(event) => setFrequencyMhz(Number(event.target.value))} className="min-w-0 flex-1 rounded-l-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent" /><span className="rounded-r-md border-y border-r border-border bg-surface px-3 py-2 text-xs">MHz</span></div>
                </label>
                <DimensionInput id="dipole-length" label="Total dipole length" dimension={length} onChange={setLength} />
                <DimensionInput id="wire-diameter" label="Wire diameter" dimension={diameter} onChange={setDiameter} />
                <DimensionInput id="dipole-height" label="Height above ground" dimension={height} onChange={setHeight} />
                <label className="block text-xs font-medium text-text-secondary">Ground model
                  <select data-testid="ground-kind" value={groundKind} onChange={(event) => setGroundKind(event.target.value as DipoleGround["kind"])} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary">
                    <option value="perfect">Perfect ground</option><option value="real">Real ground (Sommerfeld–Norton)</option><option value="free-space">Free space (validation)</option>
                  </select>
                </label>
                {groundKind === "real" && <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-background/50 p-3">
                  <label className="text-xs text-text-secondary">Conductivity S/m<input data-testid="ground-conductivity" type="number" step="0.001" value={conductivity} onChange={(event) => setConductivity(Number(event.target.value))} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 font-mono text-text-primary" /></label>
                  <label className="text-xs text-text-secondary">Relative εr<input data-testid="ground-permittivity" type="number" step="0.1" value={permittivity} onChange={(event) => setPermittivity(Number(event.target.value))} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 font-mono text-text-primary" /></label>
                </div>}
                <fieldset><legend className="mb-1 text-xs font-medium text-text-secondary">SWR reference impedance</legend><div className="grid grid-cols-2 gap-2">{([50, 75] as const).map((ohm) => <button key={ohm} type="button" onClick={() => setReferenceOhm(ohm)} className={`rounded-md border px-3 py-2 text-sm font-mono ${referenceOhm === ohm ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-background text-text-secondary'}`}>{ohm} Ω</button>)}</div></fieldset>
                <div className="rounded-md border border-border bg-background/60 p-3 text-xs text-text-secondary">
                  <div className="flex justify-between"><span>Wavelength</span><b className="font-mono text-text-primary">{Number.isFinite(model.frequencyHz) && model.frequencyHz > 0 ? wavelengthMetres(model.frequencyHz).toFixed(3) : '—'} m</b></div>
                  <div className="mt-1 flex justify-between"><span>Automatic segments</span><b className="font-mono text-text-primary" data-testid="segment-count">{assessment.segmentation?.segments ?? '—'}</b></div>
                  <div className="mt-1 flex justify-between"><span>Centre feed segment</span><b className="font-mono text-text-primary">{assessment.segmentation?.centreSegment ?? '—'}</b></div>
                </div>
                {assessment.errors.length > 0 && <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">{assessment.errors.map((message) => <p key={message}>{message}</p>)}</div>}
                <Button className="w-full" size="lg" onClick={calculate} loading={running} disabled={!assessment.valid} data-testid="run-dipole">{running ? 'Running local NEC…' : 'Generate & run NEC'}</Button>
              </div>
            </Card>

            <div className="min-w-0 space-y-5">
              {error && <div role="alert" data-testid="solver-error" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300"><b>Calculation failed.</b> {error}</div>}
              {allWarnings.length > 0 && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300"><b className="mb-1 block">Modelling warnings</b>{allWarnings.map((warning) => <p key={warning}>• {warning}</p>)}</div>}
              {!result ? <Card className="grid min-h-52 place-items-center p-8 text-center"><div><div className="mx-auto mb-3 h-20 w-64 rounded-full border-2 border-accent/40 bg-accent/5 relative"><span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-surface" /><span className="absolute left-1/2 top-1/2 h-px w-72 -translate-x-1/2 bg-accent" /></div><h2 className="font-semibold">Ready for an exact-deck calculation</h2><p className="mt-1 text-sm text-text-secondary">Review the generated model below, then run nec2c locally.</p></div></Card> : <>
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Dipole calculation summary" data-testid="dipole-results">
                  {[
                    { label: 'Resistance R', value: `${result.resistanceOhm.toFixed(2)} Ω`, testId: 'result-resistance' },
                    { label: 'Reactance X', value: `${result.reactanceOhm.toFixed(2)} Ω`, testId: 'result-reactance' },
                    { label: 'Complex Z', value: `${result.resistanceOhm.toFixed(2)} ${formatSigned(result.reactanceOhm)} Ω`, testId: 'result-impedance' },
                    { label: `SWR (${result.referenceImpedanceOhm} Ω)`, value: result.swr >= 999 ? '>999' : result.swr.toFixed(2), testId: 'result-swr' },
                    { label: 'Maximum gain', value: `${result.maximumGainDbi.toFixed(2)} dBi`, testId: 'result-gain' },
                  ].map(({ label, value, testId }) => <Card key={label} className="p-3"><p className="text-[11px] text-text-secondary">{label}</p><p data-testid={testId} className="mt-1 whitespace-nowrap font-mono text-lg font-semibold text-text-primary">{value}</p></Card>)}
                </section>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><div><span className="text-text-secondary">Take-off angle </span><b data-testid="result-takeoff" className="font-mono">{result.takeOffAngleDeg === null ? 'N/A in free space' : `${result.takeOffAngleDeg.toFixed(1)}°`}</b></div><div className="text-xs text-text-secondary">{result.engine} · {result.computedInMs} ms · local/offline</div></Card>
                <section className="grid gap-4 xl:grid-cols-2"><DipolePatternPlot title="Azimuth" points={result.azimuthPattern} xLabel="Azimuth φ" /><DipolePatternPlot title="Elevation" points={result.elevationPattern} xLabel="Elevation above horizon" /><DipoleCurrentPlot points={result.currentDistribution} /></section>
              </>}

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">Generated NEC model</h2><p className="text-[11px] text-text-secondary">This exact deck is sent to the solver worker.</p></div><Button size="sm" variant="secondary" onClick={() => generated && navigator.clipboard.writeText(generated.deck)}>Copy</Button></div>
                <pre data-testid="generated-nec" className="max-h-80 overflow-auto bg-[#0b1020] p-4 text-xs leading-5 text-emerald-300">{generated?.deck ?? assessment.errors.join('\n')}</pre>
              </Card>
              <p className="pb-4 text-xs leading-relaxed text-text-secondary">Scope note: NEC-2 is a thin-wire Method of Moments model. Results depend on segmentation, conductor geometry, environment, and the selected ground approximation. This page reports modelling warnings; it does not certify a physical installation.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
