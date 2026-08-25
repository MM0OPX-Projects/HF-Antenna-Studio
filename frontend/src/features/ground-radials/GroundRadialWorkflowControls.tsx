import type { RadialWorkflowSettings, WorkflowPhasedRadialMode, WorkflowVerticalRadialMode } from "./workflow";

interface Props {
  settings: RadialWorkflowSettings;
  showVertical: boolean;
  showPhased: boolean;
  prefix: string;
  onChange: (settings: RadialWorkflowSettings) => void;
}

function NumberField({ label, value, min, max, step, testId, onChange }: { label: string; value: number; min: number; max: number; step: number; testId: string; onChange: (value: number) => void }) {
  return <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</span><input data-testid={testId} type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.valueAsNumber)} className="w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-sm outline-none focus:border-accent" /></label>;
}

export function GroundRadialWorkflowControls({ settings, showVertical, showPhased, prefix, onChange }: Props) {
  const update = (change: Partial<RadialWorkflowSettings>) => onChange({ ...settings, ...change });
  const elevated = (showVertical && settings.verticalMode === "elevated-independent") || (showPhased && settings.phasedMode === "elevated-independent");
  const nearSurface = (showVertical && settings.verticalMode === "near-surface") || (showPhased && settings.phasedMode.startsWith("near-surface"));
  if (!showVertical && !showPhased) return null;
  return <div className="space-y-3 rounded border border-amber-500/30 bg-amber-500/5 p-3" data-testid={`${prefix}-radial-workflow`}>
    <div><h3 className="text-xs font-semibold">Explicit radial-system identity</h3><p className="mt-1 text-[10px] leading-relaxed text-text-secondary">This selection is stored in every model key and export. Near-surface means raised `GW` wires over real ground, never buried or exact soil contact.</p></div>
    <div className="grid gap-2 sm:grid-cols-2">
      {showVertical && <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-text-secondary">Vertical radial mode</span><select data-testid={`${prefix}-vertical-radial-mode`} value={settings.verticalMode} onChange={(event) => update({ verticalMode: event.target.value as WorkflowVerticalRadialMode })} className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"><option value="elevated-independent">Elevated independent wires</option><option value="near-surface">Ground-mounted raised-wire approximation</option></select></label>}
      {showPhased && <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-text-secondary">Phased radial mode</span><select data-testid={`${prefix}-phased-radial-mode`} value={settings.phasedMode} onChange={(event) => update({ phasedMode: event.target.value as WorkflowPhasedRadialMode })} className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"><option value="perfect-ground-image">Perfect-ground image; no wires</option><option value="elevated-independent">Elevated independent wires</option><option value="near-surface-independent">Near-surface independent fields</option><option value="near-surface-shared">Near-surface shared bonded field</option></select></label>}
      {showPhased && settings.phasedMode !== "perfect-ground-image" && <NumberField label="Phased radial count" value={settings.phasedRadialCount} min={4} max={64} step={1} testId={`${prefix}-phased-radial-count`} onChange={(phasedRadialCount) => update({ phasedRadialCount: Math.round(phasedRadialCount) })} />}
      {(showVertical || (showPhased && settings.phasedMode !== "perfect-ground-image")) && <><NumberField label="Radial length (λ)" value={settings.radialLengthWavelengths} min={0.02} max={2} step={0.01} testId={`${prefix}-radial-length-lambda`} onChange={(radialLengthWavelengths) => update({ radialLengthWavelengths })} /><NumberField label="Radial diameter (mm)" value={settings.radialDiameterM * 1000} min={0.2} max={100} step={0.1} testId={`${prefix}-radial-diameter`} onChange={(millimetres) => update({ radialDiameterM: millimetres / 1000 })} /></>}
      {nearSurface && <NumberField label="Wire-axis clearance (mm)" value={settings.nearSurfaceClearanceM * 1000} min={0.2} max={200} step={1} testId={`${prefix}-radial-clearance`} onChange={(millimetres) => update({ nearSurfaceClearanceM: millimetres / 1000 })} />}
      {elevated && <><NumberField label="Elevated height (λ)" value={settings.elevatedHeightWavelengths} min={0.005} max={2} step={0.01} testId={`${prefix}-radial-height-lambda`} onChange={(elevatedHeightWavelengths) => update({ elevatedHeightWavelengths })} /><NumberField label="Droop angle (°)" value={settings.elevatedDroopAngleDeg} min={0} max={60} step={1} testId={`${prefix}-radial-droop`} onChange={(elevatedDroopAngleDeg) => update({ elevatedDroopAngleDeg })} /></>}
    </div>
  </div>;
}
