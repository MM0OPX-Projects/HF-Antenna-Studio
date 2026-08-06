import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "../../hooks/useChartTheme";
import type { OptimisationResult } from "./types";

export function OptimisationHistoryChart({ result }: { result: OptimisationResult }) {
  const theme = useChartTheme();
  const data = result.history.map((candidate) => ({ evaluation: candidate.evaluation, candidate: candidate.status === "feasible" ? candidate.score : null, best: candidate.bestSoFarScore, status: candidate.status }));
  return <div className="h-[340px] min-h-[280px]" data-testid="optimisation-history-chart" role="img" aria-label="Objective score and best score found by evaluation">
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 16, right: 20, bottom: 16, left: 8 }}>
      <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
      <XAxis dataKey="evaluation" type="number" domain={[1, "dataMax"]} allowDecimals={false} stroke={theme.axis} tick={{ fill: theme.tick, fontSize: 10 }} label={{ value: "Evaluation", position: "insideBottom", offset: -9, fill: theme.tick, fontSize: 10 }} />
      <YAxis stroke={theme.axis} tick={{ fill: theme.tick, fontSize: 10 }} width={68} label={{ value: "Objective score (lower is better)", angle: -90, position: "insideLeft", fill: theme.tick, fontSize: 10 }} />
      <Tooltip contentStyle={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, fontSize: 11 }} labelFormatter={(value) => `Evaluation ${value}`} formatter={(value, name) => [Number(value).toFixed(6), name === "best" ? "Best found" : "Candidate"]} />
      <Line type="linear" dataKey="candidate" name="candidate" stroke="#94a3b8" strokeWidth={1.2} dot={{ r: 2 }} isAnimationActive={false} connectNulls={false} />
      <Line type="stepAfter" dataKey="best" name="best" stroke="#3b82f6" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
    </LineChart></ResponsiveContainer>
  </div>;
}
