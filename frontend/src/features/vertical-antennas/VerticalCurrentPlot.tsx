import type { VerticalCurrentPoint } from "./schema";
import { CurrentVisualisationPanel } from "../current-visualisation/CurrentVisualisationPanel";
import { adaptPositionedCurrents } from "../current-visualisation/adapters";

function path(points: VerticalCurrentPoint[], width: number, height: number): string {
  return points.sort((a, b) => a.fractionAlongWire - b.fractionAlongWire).map((point, index) => {
    const x = 42 + point.fractionAlongWire * (width - 62);
    const y = 18 + (1 - point.normalizedMagnitude) * (height - 48);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export function VerticalCurrentPlot({ points }: { points: VerticalCurrentPoint[] }) {
  const radiator = points.filter((point) => point.family === "radiator");
  const firstRadial = points.filter((point) => point.wireId === "radial-1");
  const wires = [...new Set(points.map((point) => point.wireId))].map((wireId) => {
    const values = points.filter((point) => point.wireId === wireId);
    const peak = values.reduce((best, point) => point.magnitudeA > best.magnitudeA ? point : best, values[0]!);
    return { wireId, peak };
  });
  const width = 520;
  const height = 220;
  const visualData = adaptPositionedCurrents(points);
  return <><figure className="rounded-lg border border-border bg-background/40 p-3" data-testid="vertical-current-distribution">
    <figcaption className="mb-2 text-sm font-semibold">Element-current distribution</figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Normalized current magnitude along the radiator and first explicit radial" className="w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((value) => <g key={value}><line x1="42" x2={width - 20} y1={18 + (1 - value) * (height - 48)} y2={18 + (1 - value) * (height - 48)} className="stroke-border" /><text x="36" y={22 + (1 - value) * (height - 48)} textAnchor="end" className="fill-text-secondary text-[10px]">{value.toFixed(2)}</text></g>)}
      <path d={path([...radiator], width, height)} fill="none" stroke="#fb923c" strokeWidth="3" data-testid="radiator-current-path" />
      {firstRadial.length > 0 && <path d={path([...firstRadial], width, height)} fill="none" stroke="#22d3ee" strokeWidth="2.5" data-testid="radial-current-path" />}
      <text x={width / 2} y={height - 5} textAnchor="middle" className="fill-text-secondary text-[10px]">Fraction of wire length from feed junction</text>
    </svg>
    <div className="mb-2 flex gap-4 text-[10px] text-text-secondary"><span className="text-orange-500">— Radiator</span>{firstRadial.length > 0 && <span className="text-cyan-500">— Radial 1</span>}</div>
    <div className="max-h-36 overflow-auto rounded border border-border"><table className="w-full text-left text-[11px] font-mono"><thead className="sticky top-0 bg-surface text-text-secondary"><tr><th className="px-2 py-1">Wire</th><th>Peak A</th><th>Peak phase</th><th>Segments</th></tr></thead><tbody>{wires.map(({ wireId, peak }) => <tr key={wireId} className="border-t border-border"><td className="px-2 py-1">{wireId}</td><td>{peak.magnitudeA.toExponential(3)}</td><td>{peak.phaseDeg.toFixed(1)}°</td><td>{points.filter((point) => point.wireId === wireId).length}</td></tr>)}</tbody></table></div>
  </figure><CurrentVisualisationPanel data={visualData} title="Vertical NEC current visualisation" testId="vertical-current-visualisation" /></>;
}
