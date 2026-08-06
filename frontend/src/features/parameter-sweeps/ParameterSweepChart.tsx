import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "../../hooks/useChartTheme";
import { PARAMETER_DEFINITIONS, axisValues } from "./model";
import { SWEEP_METRICS } from "./metrics";
import type { ParameterSweepResult, SweepMetricId } from "./types";

function formatValue(value: number | null, unit: string): string { return value === null || !Number.isFinite(value) ? "N/A" : `${value.toFixed(3)}${unit ? ` ${unit}` : ""}`; }

function OneDimensionalChart({ result, metric }: { result: ParameterSweepResult; metric: SweepMetricId }) {
  const theme = useChartTheme();
  const axis = result.definition.axes[0]!;
  const parameter = PARAMETER_DEFINITIONS[axis.parameterId];
  const measure = SWEEP_METRICS[metric];
  const data = result.points.map((point) => ({ parameter: point.axisValues[0], value: measure.value(point) }));
  if (data.every((point) => point.value === null)) return <div className="flex h-72 items-center justify-center text-sm text-text-secondary" data-testid="parameter-sweep-unavailable">{measure.label} is not defined for this modelling mode.</div>;
  return <div className="h-[360px] min-h-[280px]" data-testid="parameter-sweep-line-chart" role="img" aria-label={`${measure.label} against ${parameter.label}`}>
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 16, right: 18, bottom: 18, left: 8 }}>
      <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
      <XAxis dataKey="parameter" type="number" domain={["dataMin", "dataMax"]} stroke={theme.axis} tick={{ fill: theme.tick, fontSize: 10 }} label={{ value: `${parameter.label}${parameter.unit ? ` (${parameter.unit})` : ""}`, position: "insideBottom", offset: -10, fill: theme.tick, fontSize: 10 }} />
      <YAxis stroke={theme.axis} tick={{ fill: theme.tick, fontSize: 10 }} width={64} label={{ value: `${measure.label}${measure.unit ? ` (${measure.unit})` : ""}`, angle: -90, position: "insideLeft", fill: theme.tick, fontSize: 10 }} />
      <Tooltip contentStyle={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, fontSize: 11 }} labelFormatter={(value) => `${parameter.label}: ${Number(value).toFixed(parameter.integer ? 0 : 4)} ${parameter.unit}`} formatter={(value) => [`${Number(value).toFixed(4)} ${measure.unit}`, measure.label]} />
      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.2} dot={{ r: 3 }} isAnimationActive={false} connectNulls={false} />
    </LineChart></ResponsiveContainer>
  </div>;
}

function HeatMap({ result, metric, selectedOrdinal, onSelect }: { result: ParameterSweepResult; metric: SweepMetricId; selectedOrdinal: number; onSelect: (ordinal: number) => void }) {
  const firstAxis = result.definition.axes[0]!;
  const secondAxis = result.definition.axes[1]!;
  const firstParameter = PARAMETER_DEFINITIONS[firstAxis.parameterId];
  const secondParameter = PARAMETER_DEFINITIONS[secondAxis.parameterId];
  const xValues = axisValues(firstAxis);
  const yValues = axisValues(secondAxis);
  const measure = SWEEP_METRICS[metric];
  const finite = result.points.map(measure.value).filter((value): value is number => value !== null && Number.isFinite(value));
  if (finite.length === 0) return <div className="flex h-72 items-center justify-center text-sm text-text-secondary" data-testid="parameter-sweep-unavailable">{measure.label} is not defined for this modelling mode.</div>;
  const minimum = Math.min(...finite); const maximum = Math.max(...finite); const span = Math.max(maximum - minimum, 1e-12);
  return <div className="overflow-x-auto" data-testid="parameter-sweep-heatmap"><table className="mx-auto border-separate border-spacing-1 text-center text-[10px]"><caption className="mb-2 text-xs text-text-secondary">{measure.label} ({measure.unit || "unitless"}) · rows {secondParameter.label}, columns {firstParameter.label}</caption><thead><tr><th className="min-w-20 p-1 text-right text-text-secondary">{secondParameter.unit || "value"} \ {firstParameter.unit || "value"}</th>{xValues.map((value) => <th key={value} className="min-w-16 p-1 font-mono text-text-secondary">{value.toFixed(firstParameter.integer ? 0 : 3)}</th>)}</tr></thead><tbody>{yValues.map((yValue, row) => <tr key={yValue}><th className="p-1 text-right font-mono text-text-secondary">{yValue.toFixed(secondParameter.integer ? 0 : 3)}</th>{xValues.map((_xValue, column) => { const point = result.points[row * xValues.length + column]!; const value = measure.value(point); const ratio = value === null ? 0 : (value - minimum) / span; return <td key={point.ordinal}><button type="button" data-testid={`parameter-heat-cell-${point.ordinal}`} aria-pressed={selectedOrdinal === point.ordinal} aria-label={`${firstParameter.label} ${point.axisValues[0]} ${firstParameter.unit}, ${secondParameter.label} ${point.axisValues[1]} ${secondParameter.unit}, ${measure.label} ${formatValue(value, measure.unit)}`} onClick={() => onSelect(point.ordinal)} className={`h-12 w-full min-w-16 rounded border px-1 font-mono outline-none focus:ring-2 focus:ring-accent ${selectedOrdinal === point.ordinal ? "border-accent" : "border-border"}`} style={{ background: value === null ? "transparent" : `color-mix(in srgb, var(--color-accent) ${Math.round(15 + ratio * 70)}%, transparent)` }}>{formatValue(value, measure.unit)}</button></td>; })}</tr>)}</tbody></table><div className="mx-auto mt-2 flex max-w-md items-center gap-2 text-[10px] text-text-secondary"><span>{minimum.toFixed(3)}</span><span className="h-2 flex-1 bg-gradient-to-r from-accent/10 to-accent" /><span>{maximum.toFixed(3)} {measure.unit}</span></div></div>;
}

export function ParameterSweepChart({ result, metric, selectedOrdinal, onSelect }: { result: ParameterSweepResult; metric: SweepMetricId; selectedOrdinal: number; onSelect: (ordinal: number) => void }) {
  return result.definition.mode === "one-dimensional" ? <OneDimensionalChart result={result} metric={metric} /> : <HeatMap result={result} metric={metric} selectedOrdinal={selectedOrdinal} onSelect={onSelect} />;
}
