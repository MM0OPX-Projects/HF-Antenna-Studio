import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "../../hooks/useChartTheme";
import type { AnalyserPoint, AnalyserSweep } from "./types";

export type AnalyserMetric = "swr" | "resistance" | "reactance" | "magnitude" | "returnLoss" | "reflection";

const METRICS: Record<AnalyserMetric, { label: string; unit: string; value: (point: AnalyserPoint) => number }> = {
  swr: { label: "SWR", unit: ":1", value: (point) => Math.min(point.swr, 25) },
  resistance: { label: "Resistance R", unit: "Ω", value: (point) => point.resistanceOhms },
  reactance: { label: "Reactance X", unit: "Ω", value: (point) => point.reactanceOhms },
  magnitude: { label: "Impedance |Z|", unit: "Ω", value: (point) => point.impedanceMagnitudeOhms },
  returnLoss: { label: "Return loss", unit: "dB", value: (point) => Math.min(point.returnLossDb, 100) },
  reflection: { label: "Reflection |Γ|", unit: "", value: (point) => point.reflectionMagnitude },
};

interface Props {
  active: AnalyserSweep;
  saved: AnalyserSweep[];
  metric: AnalyserMetric;
  selectedFrequencyMhz: number;
  onCursorFrequency: (frequencyMhz: number) => void;
}

export function AnalyserChart({ active, saved, metric, selectedFrequencyMhz, onCursorFrequency }: Props) {
  const theme = useChartTheme();
  const definition = METRICS[metric];
  const traces = useMemo(() => [active, ...saved], [active, saved]);
  const data = useMemo(() => {
    const frequencies = [...new Set(traces.flatMap((trace) => trace.points.map((point) => point.frequencyMhz)))].sort((a, b) => a - b);
    return frequencies.map((frequencyMhz) => {
      const row: Record<string, number> = { frequencyMhz };
      for (const trace of traces) {
        const point = trace.points.find((candidate) => Math.abs(candidate.frequencyMhz - frequencyMhz) < 0.0000005);
        if (point) row[trace.id] = definition.value(point);
      }
      return row;
    });
  }, [definition, traces]);

  return (
    <div className="h-[360px] min-h-[280px]" data-testid="analyser-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 18, bottom: 12, left: 4 }}
          onMouseMove={(state) => {
            if (typeof state.activeLabel === "number") onCursorFrequency(state.activeLabel);
          }}
          onClick={(state) => {
            if (typeof state.activeLabel === "number") onCursorFrequency(state.activeLabel);
          }}
        >
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
          <XAxis dataKey="frequencyMhz" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: theme.tick, fontSize: 10 }} stroke={theme.axis} tickFormatter={(value) => Number(value).toFixed(3)} label={{ value: "Frequency (MHz)", position: "insideBottom", offset: -8, fill: theme.tick, fontSize: 10 }} />
          <YAxis tick={{ fill: theme.tick, fontSize: 10 }} stroke={theme.axis} width={58} label={{ value: `${definition.label}${definition.unit ? ` (${definition.unit})` : ""}`, angle: -90, position: "insideLeft", fill: theme.tick, fontSize: 10 }} />
          <Tooltip contentStyle={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, fontSize: 11 }} labelFormatter={(value) => `${Number(value).toFixed(6)} MHz`} formatter={(value, name) => [`${Number(value).toFixed(4)} ${definition.unit}`, traces.find((trace) => trace.id === name)?.label ?? name]} />
          <Legend wrapperStyle={{ fontSize: 10 }} formatter={(value) => traces.find((trace) => trace.id === value)?.label ?? value} />
          <ReferenceLine x={selectedFrequencyMhz} stroke="#ef4444" strokeDasharray="4 3" />
          {metric === "swr" && <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "2:1", fill: "#f59e0b", fontSize: 9 }} />}
          {traces.map((trace, index) => <Line key={trace.id} type="monotone" dataKey={trace.id} stroke={trace.color} strokeWidth={index === 0 ? 2.4 : 1.5} dot={false} isAnimationActive={false} connectNulls />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
