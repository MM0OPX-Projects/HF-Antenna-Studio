import { useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { PatternAngleInspector } from "../../components/results/PatternAngleInspector";
import { clampElevationAngle, gainAtAngle, withElevationHorizonFloorPoints } from "../../components/results/pattern-angle";
import { usePointerDrag } from "../../components/results/usePointerDrag";
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
const ELEVATION_VIEW_HEIGHT = 285;
const AZIMUTH_VIEW_HEIGHT = 390;

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
  const samples = withElevationHorizonFloorPoints(points);
  return samples.map((point, index) => {
    const radians = point.angleDeg * Math.PI / 180;
    const radius = radiusFor(displayedGain(point, mode), mode);
    return `${index === 0 ? "M" : "L"} ${(CX + Math.cos(radians) * radius).toFixed(2)} ${(CY - Math.sin(radians) * radius).toFixed(2)}`;
  }).join(" ");
}

export function HeightPolarPlot({ plane, mode, series, svgRef }: HeightPolarPlotProps) {
  const [selectedElevationDeg, setSelectedElevationDeg] = useState(5);
  const rings = mode === "absolute" ? [-20, -10, 0, 10] : [-30, -20, -10, 0];
  const minimum = mode === "absolute" ? -30 : -40;
  const viewHeight = plane === "azimuth" ? AZIMUTH_VIEW_HEIGHT : ELEVATION_VIEW_HEIGHT;
  const inspectorReadings = plane === "elevation" ? series.map((item) => ({
    id: item.id,
    label: item.label,
    color: item.color,
    reading: gainAtAngle(item.points, selectedElevationDeg),
  })) : [];

  const updateFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (plane !== "elevation") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 460;
    const y = ((event.clientY - bounds.top) / bounds.height) * ELEVATION_VIEW_HEIGHT;
    if (y > CY + 4) return;
    let polarAngle = Math.atan2(CY - y, x - CX) * 180 / Math.PI;
    if (polarAngle < 0) polarAngle += 360;
    if (polarAngle > 180) return;
    setSelectedElevationDeg(Number(clampElevationAngle(polarAngle).toFixed(1)));
  };
  const pointerDrag = usePointerDrag(updateFromPointer);

  const moveFromKeyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (plane !== "elevation") return;
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

  const selectedRadians = selectedElevationDeg * Math.PI / 180;
  return (
    <div>
    <svg
      ref={svgRef}
      viewBox={`0 0 460 ${viewHeight}`}
      role="img"
      aria-label={`${plane} polar radiation pattern in ${mode === "absolute" ? "absolute dBi" : "decibels relative to each trace peak"}${plane === "elevation" ? "; interactive angle cursor" : ""}`}
      className={`w-full ${plane === "elevation" ? "cursor-crosshair select-none focus:outline-none focus:ring-2 focus:ring-accent" : ""}`}
      data-testid={`${plane}-polar-plot`}
      tabIndex={plane === "elevation" ? 0 : undefined}
      style={plane === "elevation" ? { touchAction: "none" } : undefined}
      {...(plane === "elevation" ? pointerDrag : {})}
      onKeyDown={moveFromKeyboard}
    >
      <rect width="460" height={viewHeight} rx="8" fill="var(--color-surface)" />
      <g fill="none" stroke="var(--color-border)" strokeWidth="1">
        {rings.map((value) => <circle key={value} cx={CX} cy={CY} r={radiusFor(value, mode)} />)}
        <line x1={CX - RADIUS} y1={CY} x2={CX + RADIUS} y2={CY} />
        <line x1={CX} y1={CY - RADIUS} x2={CX} y2={plane === "azimuth" ? CY + RADIUS : CY} />
        {plane === "azimuth" && <line x1={CX - 112} y1={CY - 112} x2={CX + 112} y2={CY + 112} />}
        {plane === "azimuth" && <line x1={CX + 112} y1={CY - 112} x2={CX - 112} y2={CY + 112} />}
      </g>
      <g fill="var(--color-text-secondary)" fontSize="10">
        <text x={CX} y="18" textAnchor="middle" fontWeight="600" fill="var(--color-text-primary)">{plane === "elevation" ? "Elevation cut" : "Azimuth cut"} · {mode === "absolute" ? "absolute dBi" : "relative to peak (0 dB)"}</text>
        <text x={CX - RADIUS - 4} y={CY + 16} textAnchor="middle">{plane === "azimuth" ? "270°" : "180°"}</text>
        <text x={CX + RADIUS + 4} y={CY + 16} textAnchor="middle">{plane === "azimuth" ? "90°" : "0°"}</text>
        <text x={CX} y={CY - RADIUS - 6} textAnchor="middle">{plane === "azimuth" ? "0°" : "90°"}</text>
        {plane === "azimuth" && <text x={CX} y={CY + RADIUS + 15} textAnchor="middle">180°</text>}
        {rings.map((value) => <text key={value} x={CX + 4} y={CY - radiusFor(value, mode) - 3}>{value}</text>)}
        <text x="8" y={viewHeight - 11}>floor {minimum} {mode === "absolute" ? "dBi" : "dB"}</text>
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
      {plane === "elevation" && series.length > 0 && <g data-testid="elevation-angle-cursor" pointerEvents="none">
        <line
          x1={CX}
          y1={CY}
          x2={CX + Math.cos(selectedRadians) * RADIUS}
          y2={CY - Math.sin(selectedRadians) * RADIUS}
          stroke="var(--color-text-primary)"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.65"
        />
        {inspectorReadings.map(({ id, color, reading }) => {
          if (!reading) return null;
          const value = mode === "absolute" ? reading.gainDbi : reading.normalizedDb;
          const radius = radiusFor(value, mode);
          return <circle
            key={id}
            cx={CX + Math.cos(selectedRadians) * radius}
            cy={CY - Math.sin(selectedRadians) * radius}
            r="4"
            fill={color}
            stroke="var(--color-surface)"
            strokeWidth="2"
            data-testid={`elevation-angle-marker-${id}`}
          />;
        })}
        <text x={CX + Math.cos(selectedRadians) * (RADIUS + 12)} y={CY - Math.sin(selectedRadians) * (RADIUS + 12)} textAnchor="middle" dominantBaseline="middle" fill="var(--color-text-primary)" fontSize="10" fontWeight="600">{selectedElevationDeg.toFixed(1)}°</text>
      </g>}
      {series.length === 0 && <text x={CX} y={CY - 25} textAnchor="middle" fill="var(--color-text-secondary)" fontSize="12">Waiting for the current NEC result</text>}
    </svg>
    {plane === "elevation" && <PatternAngleInspector
      angleDeg={selectedElevationDeg}
      onAngleChange={setSelectedElevationDeg}
      readings={inspectorReadings}
      displayMode={mode}
    />}
    </div>
  );
}
