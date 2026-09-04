import { useEditorStore } from "../../stores/editorStore";

export function RadialSystemTree() {
  const systems = useEditorStore((state) => state.radialSystems);
  const selectWire = useEditorStore((state) => state.selectWire);
  if (systems.length === 0) return null;
  return <div className="border-t border-border px-2 py-2" data-testid="radial-system-tree">
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Radial systems ({systems.length})</p>
    <div className="space-y-1">
      {systems.map((system) => <button key={system.id} type="button" onClick={() => selectWire(system.drivenWireTag)} className="flex w-full items-center justify-between rounded border border-border bg-background/50 px-2 py-1 text-left text-[10px] hover:border-cyan-500/50">
        <span><b className="text-cyan-400">{system.name}</b><span className="ml-1 text-text-secondary">at Wire {system.hub.wireTag} {system.hub.endpoint}</span></span>
        <span className="font-mono text-text-secondary">{system.count} × {system.lengthM.toFixed(2)} m</span>
      </button>)}
    </div>
  </div>;
}

