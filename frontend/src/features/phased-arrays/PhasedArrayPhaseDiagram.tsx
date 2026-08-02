import { complexMagnitude, complexPhaseDeg, phaseComplex } from "./model";
import type { ComplexValue, ElementFeedCurrent, IdealExcitation } from "./schema";

interface PhaseVector { label: string; colour: string; value: ComplexValue }

function endpoint(value: ComplexValue, scale: number): { x: number; y: number } {
  const magnitude = complexMagnitude(value);
  const factor = magnitude > 0 ? Math.min(1, magnitude / scale) : 0;
  const phase = complexPhaseDeg(value) * Math.PI / 180;
  return { x: 130 + Math.cos(phase) * factor * 92, y: 120 - Math.sin(phase) * factor * 92 };
}

export function PhasedArrayPhaseDiagram({ ideal, solved, mode }: { ideal: IdealExcitation; solved: [ElementFeedCurrent, ElementFeedCurrent] | null; mode: "ideal-current-phase" | "physical-feed-network" }) {
  const vectors: PhaseVector[] = mode === "ideal-current-phase"
    ? [
        { label: "E1 target", colour: "#fb923c", value: phaseComplex(ideal.amplitude1, ideal.phase1Deg) },
        { label: "E2 target", colour: "#22d3ee", value: phaseComplex(ideal.amplitude2, ideal.phase2Deg) },
      ]
    : (solved ?? []).map((current, index) => ({ label: `E${index + 1} solved`, colour: index === 0 ? "#fb923c" : "#22d3ee", value: current.complex }));
  const scale = Math.max(1e-12, ...vectors.map((vector) => complexMagnitude(vector.value)));
  return <figure className="rounded-lg border border-border bg-background/40 p-3" data-testid="phased-phase-diagram">
    <figcaption className="text-sm font-semibold">Current phasor diagram</figcaption>
    <p className="mt-1 text-[10px] text-text-secondary">{mode === "ideal-current-phase" ? "Requested relative feed-current phasors" : "NEC-solved element feed-current phasors"}</p>
    <svg viewBox="0 0 260 245" role="img" aria-label="Element current magnitude and phase diagram" className="mx-auto mt-2 max-h-64 w-full">
      <circle cx="130" cy="120" r="92" fill="none" className="stroke-border" /><circle cx="130" cy="120" r="46" fill="none" className="stroke-border" strokeDasharray="4 4" />
      <line x1="25" y1="120" x2="235" y2="120" className="stroke-border" /><line x1="130" y1="15" x2="130" y2="225" className="stroke-border" />
      <text x="229" y="114" className="fill-text-secondary text-[9px]">0°</text><text x="134" y="25" className="fill-text-secondary text-[9px]">+90°</text><text x="30" y="114" className="fill-text-secondary text-[9px]">180°</text><text x="134" y="218" className="fill-text-secondary text-[9px]">−90°</text>
      {vectors.map((vector) => { const end = endpoint(vector.value, scale); return <g key={vector.label}><defs><marker id={`arrow-${vector.label.replace(/\W/g, "")}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={vector.colour} /></marker></defs><line x1="130" y1="120" x2={end.x} y2={end.y} stroke={vector.colour} strokeWidth="4" markerEnd={`url(#arrow-${vector.label.replace(/\W/g, "")})`} /><text x={end.x} y={end.y - 8} textAnchor="middle" fill={vector.colour} fontSize="10" fontWeight="700">{vector.label}</text></g>; })}
      {vectors.length === 0 && <text x="130" y="120" textAnchor="middle" className="fill-text-secondary text-[10px]">Waiting for NEC result</text>}
    </svg>
    <div className="grid grid-cols-2 gap-2 text-[10px]">{vectors.map((vector) => <div key={vector.label} className="rounded border border-border px-2 py-1"><span style={{ color: vector.colour }}>{vector.label}</span><br /><span className="font-mono">{complexMagnitude(vector.value).toFixed(4)} ∠ {complexPhaseDeg(vector.value).toFixed(1)}°</span></div>)}</div>
  </figure>;
}
