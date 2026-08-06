import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "../../hooks/useChartTheme";
import type { AnalyserSweep } from "../frequency-analyser/types";
import type { ComparisonMetric, MeasurementDataset } from "./types";

const METRICS = {
  swr: { label: "SWR", unit: ":1", measured: (point: MeasurementDataset["points"][number]) => point.swr, simulated: (point: AnalyserSweep["points"][number]) => point.swr },
  resistance: { label: "Resistance R", unit: "Ω", measured: (point: MeasurementDataset["points"][number]) => point.resistanceOhms, simulated: (point: AnalyserSweep["points"][number]) => point.resistanceOhms },
  reactance: { label: "Reactance X", unit: "Ω", measured: (point: MeasurementDataset["points"][number]) => point.reactanceOhms, simulated: (point: AnalyserSweep["points"][number]) => point.reactanceOhms },
} satisfies Record<ComparisonMetric, unknown>;

export function MeasurementComparisonChart({ measurement, simulation, metric }: { measurement: MeasurementDataset; simulation: AnalyserSweep; metric: ComparisonMetric }) {
  const theme = useChartTheme();
  const definition = METRICS[metric];
  const data = useMemo(() => {
    const rows = new Map<number, { frequencyMhz: number; measurement?: number; simulation?: number }>();
    for (const point of measurement.points) {
      const value = definition.measured(point);
      if (value !== null && Number.isFinite(value)) rows.set(point.frequencyMhz, { ...(rows.get(point.frequencyMhz) ?? { frequencyMhz: point.frequencyMhz }), measurement: metric === "swr" ? Math.min(value, 25) : value });
    }
    for (const point of simulation.points) {
      const value = definition.simulated(point);
      if (Number.isFinite(value)) rows.set(point.frequencyMhz, { ...(rows.get(point.frequencyMhz) ?? { frequencyMhz: point.frequencyMhz }), simulation: metric === "swr" ? Math.min(value, 25) : value });
    }
    return [...rows.values()].sort((left, right) => left.frequencyMhz - right.frequencyMhz);
  }, [definition, measurement.points, metric, simulation.points]);
  return <div className="h-[360px] min-h-[280px]" data-testid="measurement-overlay-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 12, right: 20, bottom: 12, left: 4 }}><CartesianGrid stroke={theme.grid} strokeDasharray="3 3" /><XAxis dataKey="frequencyMhz" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: theme.tick, fontSize: 10 }} stroke={theme.axis} tickFormatter={(value) => Number(value).toFixed(3)} label={{ value: "Frequency (MHz)", position: "insideBottom", offset: -8, fill: theme.tick, fontSize: 10 }} /><YAxis width={62} tick={{ fill: theme.tick, fontSize: 10 }} stroke={theme.axis} label={{ value: `${definition.label} (${definition.unit})`, angle: -90, position: "insideLeft", fill: theme.tick, fontSize: 10 }} /><Tooltip contentStyle={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, fontSize: 11 }} labelFormatter={(value) => `${Number(value).toFixed(6)} MHz`} /><Legend wrapperStyle={{ fontSize: 10 }} /><Line name={`SIMULATION — ${simulation.label}`} type="linear" dataKey="simulation" stroke="#3b82f6" strokeWidth={2.4} dot={false} connectNulls isAnimationActive={false} /><Line name={`MEASUREMENT — ${measurement.fileName}`} type="linear" dataKey="measurement" stroke="#f59e0b" strokeWidth={2.2} strokeDasharray="7 4" dot={false} connectNulls isAnimationActive={false} /></LineChart></ResponsiveContainer></div>;
}
