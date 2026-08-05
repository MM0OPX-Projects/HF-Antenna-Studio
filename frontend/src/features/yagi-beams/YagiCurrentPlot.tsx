import type { YagiCurrentPoint } from "./schema";
import { CurrentVisualisationPanel } from "../current-visualisation/CurrentVisualisationPanel";
import { adaptPositionedCurrents } from "../current-visualisation/adapters";

const COLORS = ["#a855f7", "#fb923c", "#22d3ee", "#38bdf8", "#14b8a6", "#84cc16", "#eab308", "#f43f5e"];

function currentPath(points: YagiCurrentPoint[], width: number, height: number): string {
  return [...points].sort((a, b) => a.fractionAlongWire - b.fractionAlongWire).map((point, index) => {
    const x = 42 + point.fractionAlongWire * (width - 62);
    const y = 18 + (1 - point.normalizedMagnitude) * (height - 48);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function phasePath(points: YagiCurrentPoint[], width: number, height: number): string {
  return [...points].sort((a, b) => a.fractionAlongWire - b.fractionAlongWire).map((point, index) => {
    const x = 42 + point.fractionAlongWire * (width - 62);
    const phase = Math.max(-180, Math.min(180, point.phaseDeg));
    const y = 14 + (180 - phase) / 360 * (height - 34);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export function YagiCurrentPlot({ points }: { points: YagiCurrentPoint[] }) {
  const wireIds = [...new Set(points.map((point) => point.wireId))];
  const width = 560;
  const height = 230;
  const visualData = adaptPositionedCurrents(points);
  return <><figure className="rounded-lg border border-border bg-background/40 p-3" data-testid="yagi-current-distribution">
    <figcaption className="mb-2 text-sm font-semibold">Element-current magnitude and phase</figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Normalized current magnitude along every Yagi element" className="w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((value) => <g key={value}><line x1="42" x2={width - 20} y1={18 + (1 - value) * (height - 48)} y2={18 + (1 - value) * (height - 48)} className="stroke-border" /><text x="36" y={22 + (1 - value) * (height - 48)} textAnchor="end" className="fill-text-secondary text-[10px]">{value.toFixed(2)}</text></g>)}
      {wireIds.map((wireId, index) => <path key={wireId} d={currentPath(points.filter((point) => point.wireId === wireId), width, height)} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth={wireId === "driven" ? 3.5 : 2.2} data-testid={`yagi-current-${wireId}`} />)}
      <text x={width / 2} y={height - 5} textAnchor="middle" className="fill-text-secondary text-[10px]">Fraction along each element (−X to +X)</text>
    </svg>
    <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Current phase (degrees)</p>
    <svg viewBox={`0 0 ${width} 165`} role="img" aria-label="Current phase along every Yagi element" className="w-full">
      {[-180, -90, 0, 90, 180].map((value) => { const y = 14 + (180 - value) / 360 * 131; return <g key={value}><line x1="42" x2={width - 20} y1={y} y2={y} className="stroke-border" /><text x="36" y={y + 4} textAnchor="end" className="fill-text-secondary text-[10px]">{value}</text></g>; })}
      {wireIds.map((wireId, index) => <path key={wireId} d={phasePath(points.filter((point) => point.wireId === wireId), width, 165)} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth={wireId === "driven" ? 3 : 2} strokeDasharray="6 3" data-testid={`yagi-phase-${wireId}`} />)}
      <text x={width / 2} y="160" textAnchor="middle" className="fill-text-secondary text-[10px]">Fraction along each element (−X to +X)</text>
    </svg>
    <div className="max-h-40 overflow-auto rounded border border-border"><table className="w-full text-left text-[11px] font-mono"><thead className="sticky top-0 bg-surface text-text-secondary"><tr><th className="px-2 py-1">Element</th><th>Peak A</th><th>Peak phase</th><th>Segments</th></tr></thead><tbody>{wireIds.map((wireId, index) => { const values = points.filter((point) => point.wireId === wireId); const peak = values.reduce((best, point) => point.magnitudeA > best.magnitudeA ? point : best, values[0]!); return <tr key={wireId} className="border-t border-border"><td className="px-2 py-1" style={{ color: COLORS[index % COLORS.length] }}>{wireId}</td><td>{peak.magnitudeA.toExponential(3)}</td><td>{peak.phaseDeg.toFixed(1)}°</td><td>{values.length}</td></tr>; })}</tbody></table></div>
  </figure><CurrentVisualisationPanel data={visualData} title="Yagi NEC current visualisation" testId="yagi-current-visualisation" /></>;
}
