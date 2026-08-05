import type { SegmentCurrent } from "../../api/nec";
import { formatCurrent, maximumCurrentMagnitude } from "./math";
import type { CurrentVisualMode } from "./types";

interface Props {
  currents: SegmentCurrent[];
  mode: CurrentVisualMode;
  animated: boolean;
  selected: SegmentCurrent | null;
  onModeChange: (mode: CurrentVisualMode) => void;
  onAnimatedChange: (animated: boolean) => void;
  onSelect: (current: SegmentCurrent | null) => void;
  compact?: boolean;
}

const MODES: Array<{ id: CurrentVisualMode; label: string }> = [
  { id: "magnitude", label: "Magnitude" },
  { id: "phase", label: "Phase" },
  { id: "combined", label: "Combined" },
];

export function CurrentVisualisationControls({ currents, mode, animated, selected, onModeChange, onAnimatedChange, onSelect, compact = false }: Props) {
  const maximum = maximumCurrentMagnitude(currents);
  const sorted = [...currents].sort((a, b) => a.tag - b.tag || a.segment - b.segment);
  const selectedKey = selected ? `${selected.tag}:${selected.segment}` : "";
  return (
    <div className={`space-y-2 ${compact ? "rounded-md border border-border bg-surface/95 p-2 shadow-lg backdrop-blur" : ""}`} data-testid="current-visualisation-controls">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Current visual mode">
        {MODES.map((item) => <button key={item.id} type="button" data-testid={`current-mode-${item.id}`} aria-pressed={mode === item.id} onClick={() => onModeChange(item.id)} className={`rounded border px-2 py-1 text-[10px] ${mode === item.id ? "border-accent bg-accent/15 text-accent" : "border-border bg-background/70 text-text-secondary"}`}>{item.label}</button>)}
        <label className="ml-1 flex items-center gap-1 text-[10px] text-text-secondary"><input data-testid="current-animation" type="checkbox" checked={animated} onChange={(event) => onAnimatedChange(event.target.checked)} /> Animate phase</label>
      </div>
      <div className="flex items-center gap-2 text-[9px] text-text-secondary" data-testid="current-legend">
        {animated ? <><span className="h-2 w-20 rounded" style={{ background: "linear-gradient(90deg,#00d8ff 0 49%,#ffb000 51% 100%)" }} /><span>− / + instantaneous current</span></> : mode === "magnitude" ? <><span className="h-2 w-20 rounded bg-gradient-to-r from-blue-700 via-emerald-500 via-amber-400 to-red-500" /><span>0 → max |I|</span></> : <><span className="h-2 w-20 rounded" style={{ background: "linear-gradient(90deg,#00b7ff,#ff4fd8,#ff3b30,#ffd60a,#00b7ff)" }} /><span>−180° → 0° → +180°</span></>}
        {mode === "combined" && <span>thickness = |I|</span>}
      </div>
      <p className="max-w-xl text-[9px] leading-relaxed text-text-secondary">Visual thickness and brightness are normalised to the solved maximum ({formatCurrent(maximum)}). Inspector values are NEC currents for the model excitation. Animation is a slowed Re&#123;I·e<sup>jωt</sup>&#125; phase view, not RF-time motion.</p>
      <div className="grid gap-2 sm:grid-cols-[minmax(180px,0.7fr)_minmax(0,1fr)]">
        <label className="text-[9px] text-text-secondary">Inspect wire / segment<select data-testid="current-segment-select" value={selectedKey} onChange={(event) => { const [tag, segment] = event.target.value.split(":").map(Number); onSelect(sorted.find((current) => current.tag === tag && current.segment === segment) ?? null); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[10px] text-text-primary"><option value="">Click conductor or choose…</option>{sorted.map((current) => <option key={`${current.tag}:${current.segment}`} value={`${current.tag}:${current.segment}`}>Wire {current.tag} · segment {current.segment}</option>)}</select></label>
        <div className="min-h-12 rounded border border-border bg-background/70 p-2 font-mono text-[10px]" data-testid="current-inspector" aria-live="polite">{selected ? <><div className="font-semibold text-accent">Wire {selected.tag} · NEC segment {selected.segment}</div><div>|I| {formatCurrent(selected.current_magnitude)} · phase {selected.current_phase_deg.toFixed(2)}°</div><div>Position ({selected.x.toFixed(4)}, {selected.y.toFixed(4)}, {selected.z.toFixed(4)}) m</div></> : <span className="text-text-secondary">Click a coloured conductor segment to inspect the solver result.</span>}</div>
      </div>
    </div>
  );
}
