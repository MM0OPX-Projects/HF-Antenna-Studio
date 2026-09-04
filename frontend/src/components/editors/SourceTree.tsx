import { useEditorStore } from "../../stores/editorStore";
import { feedpointPlacement } from "../../features/wire-editor/feedpoint";

export function SourceTree() {
  const wires = useEditorStore((state) => state.wires);
  const excitations = useEditorStore((state) => state.excitations);
  const selectWire = useEditorStore((state) => state.selectWire);
  const setPickingExcitationForTag = useEditorStore((state) => state.setPickingExcitationForTag);

  return <section className="shrink-0 border-t border-border bg-background/40" aria-label="Sources" data-testid="antenna-source-tree">
    <div className="flex items-center justify-between px-2 py-1.5">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Sources ({excitations.length})</h4>
      <span className="text-[9px] text-text-secondary">Voltage magnitude / phase</span>
    </div>
    {excitations.length === 0 ? <p className="px-2 pb-2 text-[10px] text-swr-warning">No feedpoint. Select a wire and use Place feedpoint.</p> : <div className="max-h-28 overflow-y-auto px-1 pb-1">
      {excitations.map((source, index) => {
        const wire = wires.find((candidate) => candidate.tag === source.wire_tag);
        const placement = wire ? feedpointPlacement(source, wire) : null;
        const magnitude = Math.hypot(source.voltage_real, source.voltage_imag);
        const phase = Math.atan2(source.voltage_imag, source.voltage_real) * 180 / Math.PI;
        return <button key={`${source.wire_tag}:${index}`} type="button" onClick={() => { selectWire(source.wire_tag); setPickingExcitationForTag(null); }} className="grid w-full grid-cols-[1fr_auto] gap-x-2 rounded px-2 py-1 text-left text-[10px] hover:bg-surface-hover">
          <span className="font-semibold text-swr-warning">Source {index + 1} · wire {source.wire_tag}, segment {source.segment}</span>
          <span className="font-mono text-text-primary">{magnitude.toFixed(3)} ∠ {phase.toFixed(1)}°</span>
          <span className="text-text-secondary">{placement ? `${(placement.requestedRatio * 100).toFixed(1)}% requested · ${(placement.actualRatio * 100).toFixed(1)}% actual` : "Referenced wire is missing"}</span>
          <span className="text-accent">Inspect</span>
        </button>;
      })}
    </div>}
  </section>;
}
