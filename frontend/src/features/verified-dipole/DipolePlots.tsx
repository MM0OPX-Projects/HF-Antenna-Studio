import { useState, type KeyboardEvent, type PointerEvent } from "react";
import type { NormalizedPatternPoint, VerifiedCurrentPoint } from "./result";
import { CurrentVisualisationPanel } from "../current-visualisation/CurrentVisualisationPanel";
import { adaptPositionedCurrents } from "../current-visualisation/adapters";
import { PatternAngleInspector } from "../../components/results/PatternAngleInspector";
import { clampElevationAngle, gainAtAngle, withElevationHorizonFloorPoints } from "../../components/results/pattern-angle";
import { usePointerDrag } from "../../components/results/usePointerDrag";

interface PatternPlotProps {
  title: string;
  points: NormalizedPatternPoint[];
  xLabel: string;
}
function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

export function DipolePatternPlot({ title, points, xLabel }: PatternPlotProps) {
  const [selectedElevationDeg, setSelectedElevationDeg] = useState(5);
  const isElevation = title.toLowerCase() === "elevation";
  const plotPoints = isElevation ? withElevationHorizonFloorPoints(points) : points;
  const width = 460;
  const height = 250;
  const pad = { left: 44, right: 18, top: 24, bottom: 36 };
  const xValues = plotPoints.map((point) => point.angleDeg);
  const xMin = xValues.length > 0 ? Math.min(...xValues) : 0;
  const xMax = xValues.length > 0 ? Math.max(...xValues) : 1;
  const sx = (value: number) => pad.left + ((value - xMin) / Math.max(1, xMax - xMin)) * (width - pad.left - pad.right);
  const sy = (value: number) => pad.top + ((0 - value) / 40) * (height - pad.top - pad.bottom);
  const path = linePath(plotPoints.map((point) => ({ x: sx(point.angleDeg), y: sy(point.normalizedDb) })));
  const reading = isElevation ? gainAtAngle(points, selectedElevationDeg) : null;

  const updateFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!isElevation) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - bounds.left) / bounds.width) * width;
    const angle = xMin + ((viewX - pad.left) / (width - pad.left - pad.right)) * (xMax - xMin);
    setSelectedElevationDeg(Number(clampElevationAngle(angle).toFixed(1)));
  };
  const pointerDrag = usePointerDrag(updateFromPointer);

  const moveFromKeyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!isElevation) return;
    const increment = event.shiftKey ? 5 : 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = selectedElevationDeg + increment;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = selectedElevationDeg - increment;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = 180;
    if (next === null) return;
    event.preventDefault();
    setSelectedElevationDeg(clampElevationAngle(next));
  };

  return (
    <figure className="rounded-lg border border-border bg-background/40 p-3" data-testid={`${title.toLowerCase()}-pattern`}>
      <figcaption className="mb-2 text-sm font-semibold text-text-primary">{title} pattern</figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`w-full ${isElevation ? "cursor-crosshair select-none focus:outline-none focus:ring-2 focus:ring-accent" : ""}`}
        role="img"
        aria-label={`${title} normalized gain plot${isElevation ? "; interactive angle cursor" : ""}`}
        tabIndex={isElevation ? 0 : undefined}
        style={isElevation ? { touchAction: "none" } : undefined}
        {...(isElevation ? pointerDrag : {})}
        onKeyDown={moveFromKeyboard}
      >
        {[-40, -30, -20, -10, 0].map((db) => (
          <g key={db}>
            <line x1={pad.left} x2={width - pad.right} y1={sy(db)} y2={sy(db)} stroke="currentColor" className="text-border" strokeWidth="1" />
            <text x={pad.left - 7} y={sy(db) + 4} textAnchor="end" className="fill-text-secondary text-[10px]">{db}</text>
          </g>
        ))}
        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="currentColor" className="text-text-secondary" />
        <text x={pad.left} y={height - 13} className="fill-text-secondary text-[10px]">{xMin.toFixed(0)}°</text>
        <text x={width - pad.right} y={height - 13} textAnchor="end" className="fill-text-secondary text-[10px]">{xMax.toFixed(0)}°</text>
        <text x={width / 2} y={height - 6} textAnchor="middle" className="fill-text-secondary text-[10px]">{xLabel}</text>
        <text x="12" y={height / 2} textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`} className="fill-text-secondary text-[10px]">Relative to cut peak (dB)</text>
        <path d={`${path} L${sx(xMax)},${sy(-40)} L${sx(xMin)},${sy(-40)} Z`} className="fill-accent/10" />
        <path d={path} fill="none" className="stroke-accent" strokeWidth="2.5" strokeLinejoin="round" />
        {isElevation && reading && <g data-testid="elevation-angle-cursor" pointerEvents="none">
          <line x1={sx(selectedElevationDeg)} x2={sx(selectedElevationDeg)} y1={pad.top} y2={height - pad.bottom} className="stroke-text-primary" strokeWidth="1" strokeDasharray="3 3" opacity="0.65" />
          <circle cx={sx(selectedElevationDeg)} cy={sy(reading.normalizedDb)} r="4" className="fill-accent stroke-surface" strokeWidth="2" data-testid="elevation-angle-marker-dipole" />
        </g>}
      </svg>
      {isElevation && <PatternAngleInspector
        angleDeg={selectedElevationDeg}
        onAngleChange={setSelectedElevationDeg}
        readings={[{ id: "dipole", label: "Current model", color: "#3b82f6", reading }]}
        displayMode="normalised"
      />}
    </figure>
  );
}

export function DipoleCurrentPlot({ points }: { points: VerifiedCurrentPoint[] }) {
  const visualData = adaptPositionedCurrents(points.map((point) => ({ wireId: "dipole-conductor", tag: 1, segment: point.segment, positionM: point.positionM3D, magnitudeA: point.magnitudeA, phaseDeg: point.phaseDeg })));
  const width = 460;
  const height = 220;
  const pad = { left: 44, right: 18, top: 20, bottom: 36 };
  const positions = points.map((point) => point.positionM);
  const xMin = positions.length > 0 ? Math.min(...positions) : -1;
  const xMax = positions.length > 0 ? Math.max(...positions) : 1;
  const sx = (value: number) => pad.left + ((value - xMin) / Math.max(1e-9, xMax - xMin)) * (width - pad.left - pad.right);
  const sy = (value: number) => pad.top + (1 - value) * (height - pad.top - pad.bottom);
  const path = linePath(points.map((point) => ({ x: sx(point.positionM), y: sy(point.normalizedMagnitude) })));

  return (<>
    <figure className="rounded-lg border border-border bg-background/40 p-3" data-testid="current-distribution">
      <figcaption className="mb-2 text-sm font-semibold text-text-primary">Element-current magnitude</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Normalized element-current magnitude along the dipole">
        {[0, 0.25, 0.5, 0.75, 1].map((value) => (
          <g key={value}>
            <line x1={pad.left} x2={width - pad.right} y1={sy(value)} y2={sy(value)} stroke="currentColor" className="text-border" />
            <text x={pad.left - 7} y={sy(value) + 4} textAnchor="end" className="fill-text-secondary text-[10px]">{value.toFixed(2)}</text>
          </g>
        ))}
        <path d={path} fill="none" className="stroke-accent" strokeWidth="2.5" />
        {points.map((point) => (
          <circle key={point.segment} cx={sx(point.positionM)} cy={sy(point.normalizedMagnitude)} r="2.5" className="fill-accent" />
        ))}
        <text x={width / 2} y={height - 6} textAnchor="middle" className="fill-text-secondary text-[10px]">Position along wire (m)</text>
      </svg>
      <div className="mt-2 max-h-28 overflow-auto rounded border border-border">
        <table className="w-full text-left text-[11px] font-mono">
          <thead className="sticky top-0 bg-surface text-text-secondary"><tr><th className="px-2 py-1">Seg</th><th>Position m</th><th>Magnitude A</th><th>Phase °</th></tr></thead>
          <tbody>{points.map((point) => <tr key={point.segment} className="border-t border-border"><td className="px-2 py-1">{point.segment}</td><td>{point.positionM.toFixed(3)}</td><td>{point.magnitudeA.toExponential(3)}</td><td>{point.phaseDeg.toFixed(1)}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
    <CurrentVisualisationPanel data={visualData} title="Dipole NEC current visualisation" testId="dipole-current-visualisation" />
  </>);
}
