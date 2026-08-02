import type { RefObject } from "react";
import type { NormalizedPatternPoint } from "../verified-dipole/result";
import { displayedGain } from "./metrics";
import type { PatternDisplayMode } from "./types";

export interface PolarSeries {
  id: string;
  label: string;
  color: string;
  points: NormalizedPatternPoint[];
  current?: boolean;
}

interface HeightPolarPlotProps {
  plane: "elevation" | "azimuth";
  mode: PatternDisplayMode;
  series: PolarSeries[];
  svgRef?: RefObject<SVGSVGElement | null>;
}

const CX = 230;
const CY = 205;
const RADIUS = 158;

function radiusFor(value: number, mode: PatternDisplayMode): number {
  const minimum = mode === "absolute" ? -30 : -40;
  const maximum = mode === "absolute" ? 12 : 0;
  return Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum))) * RADIUS;
}

function azimuthPath(points: NormalizedPatternPoint[], mode: PatternDisplayMode): string {
  return points.map((point, index) => {
    const angle = (point.angleDeg - 90) * Math.PI / 180;
    const radius = radiusFor(displayedGain(point, mode), mode);
    return `${index === 0 ? "M" : "L"} ${(CX + Math.cos(angle) * radius).toFixed(2)} ${(CY + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ") + (points.length > 2 ? " Z" : "");
}

function elevationPath(points: NormalizedPatternPoint[], mode: PatternDisplayMode): string {
  const upper = points.filter((point) => point.angleDeg >= 0 && point.angleDeg <= 90).sort((a, b) => a.angleDeg - b.angleDeg);
  const samples = [
    ...upper.map((point) => ({ angle: point.angleDeg, point })),
    ...[...upper].reverse().slice(1).map((point) => ({ angle: 180 - point.angleDeg, point })),
  ];
  return samples.map(({ angle, point }, index) => {
    const radians = angle * Math.PI / 180;
    const radius = radiusFor(displayedGain(point, mode), mode);
    return `${index === 0 ? "M" : "L"} ${(CX + Math.cos(radians) * radius).toFixed(2)} ${(CY - Math.sin(radians) * radius).toFixed(2)}`;
  }).join(" ");
}

export function HeightPolarPlot({ plane, mode, series, svgRef }: HeightPolarPlotProps) {
  const rings = mode === "absolute" ? [-20, -10, 0, 10] : [-30, -20, -10, 0];
  const minimum = mode === "absolute" ? -30 : -40;
  return (
    <svg ref={svgRef} viewBox="0 0 460 285" role="img" aria-label={`${plane} polar radiation pattern in ${mode} decibels`} className="w-full" data-testid={`${plane}-polar-plot`}>
      <rect width="460" height="285" rx="8" fill="var(--color-surface)" />
      <g fill="none" stroke="var(--color-border)" strokeWidth="1">
        {rings.map((value) => <circle key={value} cx={CX} cy={CY} r={radiusFor(value, mode)} />)}
        <line x1={CX - RADIUS} y1={CY} x2={CX + RADIUS} y2={CY} />
        <line x1={CX} y1={CY - RADIUS} x2={CX} y2={plane === "azimuth" ? CY + RADIUS : CY} />
        {plane === "azimuth" && <line x1={CX - 112} y1={CY - 112} x2={CX + 112} y2={CY + 112} />}
        {plane === "azimuth" && <line x1={CX + 112} y1={CY - 112} x2={CX - 112} y2={CY + 112} />}
      </g>
      <g fill="var(--color-text-secondary)" fontSize="10">
        <text x={CX} y="18" textAnchor="middle" fontWeight="600" fill="var(--color-text-primary)">{plane === "elevation" ? "Elevation cut" : "Azimuth cut"} · {mode === "absolute" ? "dBi" : "normalised dB"}</text>
        <text x={CX - RADIUS - 4} y={CY + 16} textAnchor="middle">{plane === "azimuth" ? "270°" : "0°"}</text>
        <text x={CX + RADIUS + 4} y={CY + 16} textAnchor="middle">{plane === "azimuth" ? "90°" : "0°"}</text>
        <text x={CX} y={CY - RADIUS - 6} textAnchor="middle">{plane === "azimuth" ? "0°" : "90°"}</text>
        {plane === "azimuth" && <text x={CX} y={CY + RADIUS + 15} textAnchor="middle">180°</text>}
        {rings.map((value) => <text key={value} x={CX + 4} y={CY - radiusFor(value, mode) - 3}>{value}</text>)}
        <text x="8" y="274">floor {minimum} {mode === "absolute" ? "dBi" : "dB"}</text>
      </g>
      {series.map((item) => <path
        key={item.id}
        d={plane === "azimuth" ? azimuthPath(item.points, mode) : elevationPath(item.points, mode)}
        fill="none"
        stroke={item.color}
        strokeWidth={item.current ? 3 : 2}
        strokeDasharray={item.current ? undefined : "7 4"}
        strokeLinejoin="round"
        data-testid={`polar-series-${plane}-${item.id}`}
      />)}
      {series.length === 0 && <text x={CX} y={CY - 25} textAnchor="middle" fill="var(--color-text-secondary)" fontSize="12">Waiting for the current NEC result</text>}
    </svg>
  );
}
