import type { PhasedCurrentPoint } from "./schema";
import { CurrentVisualisationPanel } from "../current-visualisation/CurrentVisualisationPanel";
import { adaptPositionedCurrents } from "../current-visualisation/adapters";

function pathFor(points: PhasedCurrentPoint[], phase: boolean): string {
  return [...points].sort((a, b) => a.fractionAlongWire - b.fractionAlongWire).map((point, index) => {
    const x = 44 + point.fractionAlongWire * 486;
    const y = phase ? 14 + (180 - Math.max(-180, Math.min(180, point.phaseDeg))) / 360 * 145 : 18 + (1 - point.normalizedMagnitude) * 138;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export function PhasedArrayCurrentPlot({ points }: { points: PhasedCurrentPoint[] }) {
  const visualData = adaptPositionedCurrents(points);
  const elements = [
    { id: "element-1", label: "Element 1", colour: "#fb923c" },
    { id: "element-2", label: "Element 2", colour: "#22d3ee" },
  ] as const;
  return <><figure className="rounded-lg border border-border bg-background/40 p-3" data-testid="phased-current-distribution">
    <figcaption className="mb-2 text-sm font-semibold">Individual element currents</figcaption>
    <svg viewBox="0 0 560 180" role="img" aria-label="Normalized current magnitude along both vertical elements" className="w-full">
      {[0, .25, .5, .75, 1].map((value) => <g key={value}><line x1="44" x2="530" y1={18 + (1 - value) * 138} y2={18 + (1 - value) * 138} className="stroke-border" /><text x="38" y={22 + (1 - value) * 138} textAnchor="end" className="fill-text-secondary text-[10px]">{value.toFixed(2)}</text></g>)}
      {elements.map((element) => <path key={element.id} d={pathFor(points.filter((point) => point.family === element.id), false)} fill="none" stroke={element.colour} strokeWidth="3" />)}
      <text x="287" y="176" textAnchor="middle" className="fill-text-secondary text-[10px]">Feed (left) to element tip (right)</text>
    </svg>
    <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Phase (degrees)</p>
    <svg viewBox="0 0 560 178" role="img" aria-label="Current phase along both vertical elements" className="w-full">
      {[-180, -90, 0, 90, 180].map((value) => { const y = 14 + (180 - value) / 360 * 145; return <g key={value}><line x1="44" x2="530" y1={y} y2={y} className="stroke-border" /><text x="38" y={y + 4} textAnchor="end" className="fill-text-secondary text-[10px]">{value}</text></g>; })}
      {elements.map((element) => <path key={element.id} d={pathFor(points.filter((point) => point.family === element.id), true)} fill="none" stroke={element.colour} strokeWidth="2.5" strokeDasharray="6 3" />)}
      <text x="287" y="174" textAnchor="middle" className="fill-text-secondary text-[10px]">Feed (left) to element tip (right)</text>
    </svg>
    <div className="mt-2 flex flex-wrap gap-3 text-xs">{elements.map((element) => <span key={element.id} style={{ color: element.colour }}>● {element.label}</span>)}</div>
  </figure><CurrentVisualisationPanel data={visualData} title="Phased-array NEC current visualisation" testId="phased-current-visualisation" /></>;
}
