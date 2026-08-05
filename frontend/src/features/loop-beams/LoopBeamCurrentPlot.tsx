import { CurrentVisualisationPanel } from "../current-visualisation/CurrentVisualisationPanel";
import { adaptPositionedCurrents } from "../current-visualisation/adapters";
import type { LoopBeamCurrentPoint } from "./schema";

const COLORS = ["#fb923c", "#a855f7", "#22d3ee", "#38bdf8", "#14b8a6", "#84cc16", "#eab308", "#f43f5e"];

function path(points: LoopBeamCurrentPoint[], width: number, height: number, phase: boolean): string {
  return [...points].sort((a, b) => a.fractionAlongWire - b.fractionAlongWire).map((point, index) => {
    const x = 42 + point.fractionAlongWire * (width - 62);
    const value = phase ? (180 - Math.max(-180, Math.min(180, point.phaseDeg))) / 360 : 1 - point.normalizedMagnitude;
    const y = 16 + value * (height - 42);
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export function LoopBeamCurrentPlot({ points }: { points: LoopBeamCurrentPoint[] }) {
  const ids = [...new Set(points.map((point) => point.wireId))];
  const width = 560; const height = 215;
  const visualData = adaptPositionedCurrents(points);
  return <><figure className="rounded-lg border border-border bg-background/40 p-3" data-testid="loop-beam-current-distribution">
    <figcaption className="mb-2 text-sm font-semibold">Wire-current magnitude and phase</figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Normalised current magnitude on every wire section" className="w-full">
      {[0, .25, .5, .75, 1].map((value) => <g key={value}><line x1="42" x2={width - 20} y1={16 + (1 - value) * (height - 42)} y2={16 + (1 - value) * (height - 42)} className="stroke-border" /><text x="36" y={20 + (1 - value) * (height - 42)} textAnchor="end" className="fill-text-secondary text-[10px]">{value.toFixed(2)}</text></g>)}
      {ids.map((id, index) => <path key={id} d={path(points.filter((point) => point.wireId === id), width, height, false)} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth={id.includes("feed") ? 4 : 2.2} />)}
      <text x={width / 2} y={height - 4} textAnchor="middle" className="fill-text-secondary text-[10px]">Fraction along each generated wire section</text>
    </svg>
    <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Current phase (degrees)</p>
    <svg viewBox={`0 0 ${width} 145`} role="img" aria-label="Current phase on every wire section" className="w-full">
      {[-180, -90, 0, 90, 180].map((value) => { const y = 12 + (180 - value) / 360 * 110; return <g key={value}><line x1="42" x2={width - 20} y1={y} y2={y} className="stroke-border" /><text x="36" y={y + 4} textAnchor="end" className="fill-text-secondary text-[10px]">{value}</text></g>; })}
      {ids.map((id, index) => <path key={id} d={path(points.filter((point) => point.wireId === id), width, 136, true)} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="2" strokeDasharray="6 3" />)}
    </svg>
    <div className="max-h-40 overflow-auto rounded border border-border"><table className="w-full text-left text-[11px] font-mono"><thead className="sticky top-0 bg-surface text-text-secondary"><tr><th className="px-2 py-1">Wire</th><th>Family</th><th>Peak A</th><th>Peak phase</th><th>Segments</th></tr></thead><tbody>{ids.map((id, index) => { const values = points.filter((point) => point.wireId === id); const peak = values.reduce((best, point) => point.magnitudeA > best.magnitudeA ? point : best, values[0]!); return <tr key={id} className="border-t border-border"><td className="px-2 py-1" style={{ color: COLORS[index % COLORS.length] }}>{id}</td><td>{peak.family}</td><td>{peak.magnitudeA.toExponential(3)}</td><td>{peak.phaseDeg.toFixed(1)}°</td><td>{values.length}</td></tr>; })}</tbody></table></div>
  </figure><CurrentVisualisationPanel data={visualData} title="Loop / compact-beam NEC current visualisation" testId="loop-current-visualisation" /></>;
}
