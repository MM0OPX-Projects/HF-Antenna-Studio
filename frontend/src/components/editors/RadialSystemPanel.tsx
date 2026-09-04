import { useMemo, useState } from "react";
import { defaultRadialSystemSettings, type RadialSystemSettings } from "../../features/wire-editor/radial-system";
import { useEditorStore, type EditorRadialSystem, type EditorWire, type WireEndpoint } from "../../stores/editorStore";
import { NumberInput } from "../ui/NumberInput";

function settingsOf(system: EditorRadialSystem): RadialSystemSettings {
  return {
    representation: system.representation,
    count: system.count,
    lengthM: system.lengthM,
    diameterM: system.diameterM,
    rotationDeg: system.rotationDeg,
    droopAngleDeg: system.droopAngleDeg,
    clearanceM: system.clearanceM,
  };
}

function RadialFields({ value, onChange }: { value: RadialSystemSettings; onChange: (value: RadialSystemSettings) => void }) {
  const patch = (next: Partial<RadialSystemSettings>) => onChange({ ...value, ...next });
  const nearSurface = value.representation === "near-surface-explicit";
  return <div className="space-y-2">
    <label className="block text-[10px] text-text-secondary">Radial representation
      <select data-testid="radial-representation" value={value.representation} onChange={(event) => patch({ representation: event.currentTarget.value as RadialSystemSettings["representation"], count: event.currentTarget.value === "near-surface-explicit" ? Math.max(4, value.count) : value.count, droopAngleDeg: event.currentTarget.value === "near-surface-explicit" ? 0 : value.droopAngleDeg })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-text-primary">
        <option value="elevated-explicit">Elevated explicit wires</option>
        <option value="near-surface-explicit">Near-surface explicit wires (real ground)</option>
      </select>
    </label>
    <div className="grid grid-cols-2 gap-2">
      <NumberInput label="Count" value={value.count} onChange={(count) => patch({ count: Math.round(count) })} min={nearSurface ? 4 : 2} max={64} decimals={0} />
      <NumberInput label="Length" value={value.lengthM} onChange={(lengthM) => patch({ lengthM })} min={0.2} max={100} decimals={3} unit="m" />
      <NumberInput label="Diameter" value={value.diameterM * 1000} onChange={(diameterMm) => patch({ diameterM: diameterMm / 1000 })} min={0.2} max={100} decimals={2} unit="mm" />
      <NumberInput label="Rotation" value={value.rotationDeg} onChange={(rotationDeg) => patch({ rotationDeg })} min={0} max={360} decimals={1} unit="deg" />
      {!nearSurface && <NumberInput label="Droop" value={value.droopAngleDeg} onChange={(droopAngleDeg) => patch({ droopAngleDeg })} min={0} max={60} decimals={1} unit="deg" />}
      {nearSurface && <NumberInput label="Clearance" value={value.clearanceM * 1000} onChange={(clearanceMm) => patch({ clearanceM: clearanceMm / 1000 })} min={0.6} max={100} decimals={2} unit="mm" />}
    </div>
    <label className="block text-[10px] text-text-secondary">Radial count: {value.count}
      <input data-testid="radial-count-slider" type="range" min={nearSurface ? 4 : 2} max={64} step={1} value={value.count} onChange={(event) => patch({ count: Number(event.currentTarget.value) })} className="mt-1 w-full accent-cyan-400" />
    </label>
    <label className="block text-[10px] text-text-secondary">Radial rotation: {value.rotationDeg.toFixed(1)}°
      <input data-testid="radial-rotation-slider" type="range" min={0} max={360} step={1} value={value.rotationDeg} onChange={(event) => patch({ rotationDeg: Number(event.currentTarget.value) })} className="mt-1 w-full accent-cyan-400" />
    </label>
  </div>;
}

function ManagedRadialSystem({ system }: { system: EditorRadialSystem }) {
  const updateRadialSystem = useEditorStore((state) => state.updateRadialSystem);
  const removeRadialSystem = useEditorStore((state) => state.removeRadialSystem);
  const explodeRadialSystem = useEditorStore((state) => state.explodeRadialSystem);
  const [draft, setDraft] = useState<RadialSystemSettings>(() => settingsOf(system));
  return <div className="space-y-2 rounded border border-cyan-500/30 bg-cyan-500/5 p-2" data-testid={`radial-system-${system.id}`}>
    <div className="flex items-start justify-between gap-2"><div><h5 className="text-xs font-semibold text-text-primary">{system.name}</h5><p className="text-[9px] text-text-secondary">Hub: Wire {system.hub.wireTag} {system.hub.endpoint} · driven Wire {system.drivenWireTag} · {system.generatedWireTags.length} NEC wires</p></div><span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] text-cyan-400">managed</span></div>
    <RadialFields value={draft} onChange={setDraft} />
    <div className="grid grid-cols-3 gap-1">
      <button type="button" data-testid="apply-radial-system" onClick={() => updateRadialSystem(system.id, draft)} className="rounded bg-cyan-500/20 px-2 py-1 text-[10px] font-semibold text-cyan-400">Apply</button>
      <button type="button" onClick={() => explodeRadialSystem(system.id)} className="rounded border border-border px-2 py-1 text-[10px] text-text-secondary" title="Keep the wires and junction, but stop regenerating them as a group">Explode</button>
      <button type="button" onClick={() => removeRadialSystem(system.id)} className="rounded bg-swr-bad/15 px-2 py-1 text-[10px] text-swr-bad">Remove</button>
    </div>
  </div>;
}

export function RadialSystemPanel({ wire }: { wire: EditorWire }) {
  const systems = useEditorStore((state) => state.radialSystems);
  const selectedEndpoints = useEditorStore((state) => state.selectedEndpoints);
  const addRadialSystem = useEditorStore((state) => state.addRadialSystem);
  const ground = useEditorStore((state) => state.ground);
  const setGround = useEditorStore((state) => state.setGround);
  const [draft, setDraft] = useState<RadialSystemSettings>(() => defaultRadialSystemSettings());
  const selectedEndpoint = selectedEndpoints.find((endpoint) => endpoint.wireTag === wire.tag)?.endpoint ?? null;
  const attached = useMemo(() => systems.filter((system) => system.drivenWireTag === wire.tag || system.generatedWireTags.includes(wire.tag)), [systems, wire.tag]);
  const addAt = (endpoint: WireEndpoint) => addRadialSystem({ wireTag: wire.tag, endpoint }, wire.tag, draft);
  const nearSurface = draft.representation === "near-surface-explicit";
  return <div className="space-y-2 border-t border-border pt-2" data-testid="radial-system-panel">
    <div><h4 className="text-[11px] font-semibold text-text-primary">Radial systems</h4><p className="text-[9px] leading-4 text-text-secondary">Attach a bonded parametric radial field to an exact endpoint. This wire remains the driven radiator.</p></div>
    {attached.map((system) => <ManagedRadialSystem key={`${system.id}:${system.count}:${system.lengthM}:${system.diameterM}:${system.rotationDeg}:${system.droopAngleDeg}:${system.clearanceM}:${system.representation}`} system={system} />)}
    {attached.length === 0 && <div className="space-y-2 rounded border border-border bg-background/40 p-2">
      <RadialFields value={draft} onChange={setDraft} />
      {nearSurface && <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[9px] leading-4 text-amber-400"><p>NEC-2 cannot model buried or exactly-on-soil wires. The hub is explicitly raised to the clearance shown above and uses finite ground.</p><label className="flex items-center justify-between gap-2 text-text-secondary">Ground preset<select value={ground.type === "perfect" || ground.type === "free_space" ? "average" : ground.type} onChange={(event) => setGround(event.currentTarget.value === "custom" ? { type: "custom", custom_permittivity: 13, custom_conductivity: 0.005 } : { type: event.currentTarget.value as "average" | "pastoral" | "dry_sandy" })} className="rounded border border-border bg-background px-1 py-0.5 text-text-primary"><option value="average">Average</option><option value="pastoral">Pastoral</option><option value="dry_sandy">Dry sandy</option><option value="custom">Custom</option></select></label></div>}
      <p className="text-[9px] leading-4 text-text-secondary">Choose the physical base endpoint. The source will be requested at 0% or 100% on Wire {wire.tag}; NEC uses its adjacent segment centre.</p>
      <div className="grid grid-cols-2 gap-1">
        <button type="button" data-testid="add-radials-start" onClick={() => addAt("start")} className={`rounded px-2 py-1 text-[10px] font-semibold ${selectedEndpoint === "start" ? "bg-cyan-500/25 text-cyan-300 ring-1 ring-cyan-400" : "bg-cyan-500/15 text-cyan-400"}`}>Add at Point 1</button>
        <button type="button" data-testid="add-radials-end" onClick={() => addAt("end")} className={`rounded px-2 py-1 text-[10px] font-semibold ${selectedEndpoint === "end" ? "bg-cyan-500/25 text-cyan-300 ring-1 ring-cyan-400" : "bg-cyan-500/15 text-cyan-400"}`}>Add at Point 2</button>
      </div>
    </div>}
  </div>;
}
