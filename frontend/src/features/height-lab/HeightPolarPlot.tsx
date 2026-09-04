import { useMemo, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { PatternData } from "../../api/nec";
import { PatternAngleInspector } from "../../components/results/PatternAngleInspector";
import { clampAzimuthBearing, clampElevationAngle, gainAtAngle, gainAtCircularAngle, withElevationHorizonFloorPoints } from "../../components/results/pattern-angle";
import { azimuthCutFromPattern, type AzimuthBearingConvention } from "../../components/results/radiation-cuts";
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
  /** Retained far-field grid enables selecting another solved azimuth row. */
  pattern?: PatternData;
  azimuthConvention?: AzimuthBearingConvention;
}

interface HeightPolarPlotProps {
  plane: "elevation" | "azimuth";
  mode: PatternDisplayMode;
  series: PolarSeries[];
  svgRef?: RefObject<SVGSVGElement | null>;
  compactControls?: boolean;
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

export function HeightPolarPlot({ plane, mode, series, svgRef, compactControls = false }: HeightPolarPlotProps) {
  const [selectedElevationDeg, setSelectedElevationDeg] = useState(5);
  const [selectedAzimuthBearingDeg, setSelectedAzimuthBearingDeg] = useState(0);
  const [selectedAzimuthCutElevationDeg, setSelectedAzimuthCutElevationDeg] = useState<number | null>(null);
  const rings = mode === "absolute" ? [-20, -10, 0, 10] : [-30, -20, -10, 0];
  const minimum = mode === "absolute" ? -30 : -40;
  const viewHeight = plane === "azimuth" ? AZIMUTH_VIEW_HEIGHT : ELEVATION_VIEW_HEIGHT;
  const primaryPatternSeries = series.find((item) => item.current && item.pattern) ?? series.find((item) => item.pattern);
  const automaticAzimuthCut = useMemo(() => primaryPatternSeries?.pattern
    ? azimuthCutFromPattern(primaryPatternSeries.pattern, undefined, primaryPatternSeries.azimuthConvention)
    : null, [primaryPatternSeries]);
  const azimuthCutElevationDeg = selectedAzimuthCutElevationDeg ?? automaticAzimuthCut?.actualElevationDeg ?? 0;
  const displayedSeries = useMemo(() => plane === "azimuth" ? series.map((item) => {
    if (!item.pattern) return item;
    const cut = azimuthCutFromPattern(item.pattern, selectedAzimuthCutElevationDeg ?? undefined, item.azimuthConvention);
    return cut ? { ...item, points: cut.points } : item;
  }) : series, [plane, selectedAzimuthCutElevationDeg, series]);
  const actualAzimuthElevations = plane === "azimuth" ? series.flatMap((item) => {
    if (!item.pattern) return [];
    const cut = azimuthCutFromPattern(item.pattern, selectedAzimuthCutElevationDeg ?? undefined, item.azimuthConvention);
    return cut ? [cut.actualElevationDeg] : [];
  }) : [];
  const uniqueActualAzimuthElevations = [...new Set(actualAzimuthElevations.map((value) => value.toFixed(1)))];
  const selectedInspectorAngle = plane === "elevation" ? selectedElevationDeg : selectedAzimuthBearingDeg;
  const inspectorReadings = displayedSeries.map((item) => ({
    id: item.id,
    label: item.label,
    color: item.color,
    reading: plane === "elevation"
      ? gainAtAngle(item.points, selectedElevationDeg)
      : gainAtCircularAngle(item.points, selectedAzimuthBearingDeg),
  }));

  const updateFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 460;
    const y = ((event.clientY - bounds.top) / bounds.height) * viewHeight;
    if (plane === "azimuth") {
      let bearing = Math.atan2(x - CX, CY - y) * 180 / Math.PI;
      if (bearing < 0) bearing += 360;
      setSelectedAzimuthBearingDeg(Number(clampAzimuthBearing(bearing).toFixed(1)));
      return;
    }
    if (y > CY + 4) return;
    let polarAngle = Math.atan2(CY - y, x - CX) * 180 / Math.PI;
    if (polarAngle < 0) polarAngle += 360;
    if (polarAngle > 180) return;
    setSelectedElevationDeg(Number(clampElevationAngle(polarAngle).toFixed(1)));
  };
  const pointerDrag = usePointerDrag(updateFromPointer);

  const moveFromKeyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    const increment = event.shiftKey ? 5 : 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = selectedInspectorAngle + increment;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = selectedInspectorAngle - increment;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = plane === "elevation" ? 180 : 360;
    if (next === null) return;
    event.preventDefault();
    if (plane === "elevation") setSelectedElevationDeg(clampElevationAngle(next));
    else setSelectedAzimuthBearingDeg(clampAzimuthBearing(next));
  };

  const selectedRadians = selectedElevationDeg * Math.PI / 180;
  const selectedAzimuthRadians = selectedAzimuthBearingDeg * Math.PI / 180;
  return (
    <div>
    <svg
      ref={svgRef}
      viewBox={`0 0 460 ${viewHeight}`}
      role="img"
      aria-label={`${plane} polar radiation pattern in ${mode === "absolute" ? "absolute gain in dBi" : "dB relative to each trace peak"}; interactive angle cursor`}
      className="w-full cursor-crosshair select-none focus:outline-none focus:ring-2 focus:ring-accent"
      data-testid={`${plane}-polar-plot`}
      tabIndex={0}
      style={{ touchAction: "none" }}
      {...pointerDrag}
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
        <text x={CX} y="18" textAnchor="middle" fontWeight="600" fill="var(--color-text-primary)">{plane === "elevation" ? "Elevation cut" : "Azimuth cut"} · {mode === "absolute" ? "absolute gain (dBi)" : "relative pattern (dB; peak = 0)"}</text>
        <text x={CX - RADIUS - 4} y={CY + 16} textAnchor="middle">{plane === "azimuth" ? "270°" : "180°"}</text>
        <text x={CX + RADIUS + 4} y={CY + 16} textAnchor="middle">{plane === "azimuth" ? "90°" : "0°"}</text>
        <text x={CX} y={CY - RADIUS - 6} textAnchor="middle">{plane === "azimuth" ? "0°" : "90°"}</text>
        {plane === "azimuth" && <text x={CX} y={CY + RADIUS + 15} textAnchor="middle">180°</text>}
        {rings.map((value) => <text key={value} x={CX + 4} y={CY - radiusFor(value, mode) - 3}>{value}</text>)}
        <text x="8" y={viewHeight - 11}>floor {minimum} {mode === "absolute" ? "dBi" : "dB"}</text>
      </g>
      {displayedSeries.map((item) => <path
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
      {plane === "azimuth" && displayedSeries.length > 0 && <g data-testid="azimuth-bearing-cursor" pointerEvents="none">
        <line
          x1={CX}
          y1={CY}
          x2={CX + Math.sin(selectedAzimuthRadians) * RADIUS}
          y2={CY - Math.cos(selectedAzimuthRadians) * RADIUS}
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
            cx={CX + Math.sin(selectedAzimuthRadians) * radius}
            cy={CY - Math.cos(selectedAzimuthRadians) * radius}
            r="4"
            fill={color}
            stroke="var(--color-surface)"
            strokeWidth="2"
            data-testid={`azimuth-bearing-marker-${id}`}
          />;
        })}
        <text x={CX + Math.sin(selectedAzimuthRadians) * (RADIUS + 12)} y={CY - Math.cos(selectedAzimuthRadians) * (RADIUS + 12)} textAnchor="middle" dominantBaseline="middle" fill="var(--color-text-primary)" fontSize="10" fontWeight="600">{selectedAzimuthBearingDeg.toFixed(1)}°</text>
      </g>}
      {series.length === 0 && <text x={CX} y={CY - 25} textAnchor="middle" fill="var(--color-text-secondary)" fontSize="12">Waiting for the current NEC result</text>}
    </svg>
    <div className={plane === "azimuth" && compactControls ? "grid gap-2 lg:grid-cols-2 lg:items-start" : undefined} data-testid={plane === "azimuth" && compactControls ? "compact-azimuth-controls" : undefined}>
    {plane === "azimuth" && primaryPatternSeries?.pattern && <section className="mt-2 rounded-md border border-border bg-background/60 p-2" data-testid="azimuth-cut-elevation-control" aria-label="Azimuth cut elevation above horizon">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
          Azimuth cut elevation
          <span className="inline-flex items-center rounded border border-border bg-surface px-2 py-1">
            <input type="number" min={0} max={90} step={0.1} value={Number(azimuthCutElevationDeg.toFixed(1))} onChange={(event) => {
              const next = event.currentTarget.valueAsNumber;
              if (Number.isFinite(next)) setSelectedAzimuthCutElevationDeg(Math.min(90, Math.max(0, next)));
            }} className="w-14 bg-transparent text-right font-mono text-xs outline-none" aria-label="Azimuth cut elevation from zero to ninety degrees above the horizon" data-testid="azimuth-cut-elevation-input" />
            <span className="text-xs text-text-secondary">°</span>
          </span>
        </label>
        <span className="text-[10px] text-text-secondary">Height above the horizon used for this complete 360° horizontal slice. The nearest solved NEC row is used.</span>
        <button type="button" onClick={() => setSelectedAzimuthCutElevationDeg(null)} className="rounded border border-border px-2 py-1 text-[10px] text-text-secondary hover:border-accent" data-testid="azimuth-cut-peak-row">Use elevation of maximum gain</button>
      </div>
      <p className="mt-1 text-[10px] text-text-secondary" data-testid="azimuth-cut-actual-elevation">{selectedAzimuthCutElevationDeg === null ? "Automatic" : `Requested ${azimuthCutElevationDeg.toFixed(1)}°`} · NEC row {uniqueActualAzimuthElevations.join(" / ") || "unavailable"}°{selectedAzimuthCutElevationDeg !== null && uniqueActualAzimuthElevations.some((value) => Math.abs(Number(value) - azimuthCutElevationDeg) > 0.05) ? " (nearest grid sample)" : selectedAzimuthCutElevationDeg !== null ? " (exact grid sample)" : ""}{selectedAzimuthCutElevationDeg === null && automaticAzimuthCut?.peakBearingDeg != null ? ` · strongest bearing ${automaticAzimuthCut.peakBearingDeg.toFixed(1)}°` : ""}</p>
    </section>}
    <PatternAngleInspector
      angleDeg={selectedInspectorAngle}
      onAngleChange={plane === "elevation" ? setSelectedElevationDeg : setSelectedAzimuthBearingDeg}
      readings={inspectorReadings}
      displayMode={mode}
      kind={plane}
      compact={plane === "azimuth" && compactControls}
    />
    </div>
    </div>
  );
}
