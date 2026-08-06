import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "../../hooks/useChartTheme";
import type { ComparisonMetric, MeasurementComparison } from "./types";

const DEFINITIONS = {
  swr: { label: "Δ SWR", unit: ":1", value: (point: MeasurementComparison["points"][number]) => point.swrDifference },
  resistance: { label: "Δ R", unit: "Ω", value: (point: MeasurementComparison["points"][number]) => point.resistanceDifferenceOhms },
  reactance: { label: "Δ X", unit: "Ω", value: (point: MeasurementComparison["points"][number]) => point.reactanceDifferenceOhms },
};

export function DifferenceChart({ comparison, metric }: { comparison: MeasurementComparison; metric: ComparisonMetric }) {
  const theme = useChartTheme();
  const definition = DEFINITIONS[metric];
  const data = useMemo(() => comparison.points.map((point) => {
    const difference = definition.value(point);
    return { frequencyMhz: point.frequencyMhz, difference: difference !== null && Number.isFinite(difference) ? difference : null };
  }), [comparison.points, definition]);
  return <div className="h-[280px] min-h-[240px]" data-testid="measurement-difference-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 12, right: 20, bottom: 12, left: 4 }}><CartesianGrid stroke={theme.grid} strokeDasharray="3 3" /><XAxis dataKey="frequencyMhz" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: theme.tick, fontSize: 10 }} stroke={theme.axis} tickFormatter={(value) => Number(value).toFixed(3)} label={{ value: "Original measurement frequency (MHz)", position: "insideBottom", offset: -8, fill: theme.tick, fontSize: 10 }} /><YAxis width={62} tick={{ fill: theme.tick, fontSize: 10 }} stroke={theme.axis} label={{ value: `${definition.label} (${definition.unit})`, angle: -90, position: "insideLeft", fill: theme.tick, fontSize: 10 }} /><Tooltip contentStyle={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, fontSize: 11 }} labelFormatter={(value) => `${Number(value).toFixed(6)} MHz`} formatter={(value) => [`${Number(value).toFixed(5)} ${definition.unit}`, `${definition.label} (measurement − simulation)`]} /><ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 3" /><Line name={`${definition.label} — MEASUREMENT − SIMULATION`} type="linear" dataKey="difference" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>;
}
