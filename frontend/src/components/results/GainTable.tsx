/**
 * Gain summary table — shows key performance metrics for the selected frequency.
 */

import type { FrequencyResult } from "../../api/nec";
import { formatGain, formatSwr, formatImpedance, swrColorClass } from "../../utils/units";

interface GainTableProps {
  data: FrequencyResult;
}

interface MetricRow {
  label: string;
  value: string;
  colorClass?: string;
}

export function GainTable({ data }: GainTableProps) {
  const metrics: MetricRow[] = [
    {
      label: "Frequency",
      value: `${data.frequency_mhz.toFixed(3)} MHz`,
    },
    {
      label: "SWR (50\u03A9)",
      value: formatSwr(data.swr_50),
      colorClass: swrColorClass(data.swr_50),
    },
    {
      label: "Impedance",
      value: formatImpedance(data.impedance.real, data.impedance.imag),
    },
    {
      label: "Max Gain",
      value: formatGain(data.gain_max_dbi),
    },
    {
      label: "Max Gain Direction",
      value: `${data.gain_max_theta.toFixed(1)}\u00B0 el, ${data.gain_max_phi.toFixed(1)}\u00B0 az`,
    },
  ];

  if (data.front_to_back_db != null) {
    metrics.push({
      label: "Front/Back",
      value: `${data.front_to_back_db.toFixed(1)} dB`,
    });
  }

  if (data.beamwidth_e_deg != null) {
    metrics.push({
      label: "Beamwidth (E)",
      value: `${data.beamwidth_e_deg.toFixed(1)}\u00B0`,
    });
  }

  if (data.beamwidth_h_deg != null) {
    metrics.push({
      label: "Beamwidth (H)",
      value: `${data.beamwidth_h_deg.toFixed(1)}\u00B0`,
    });
  }

  if (data.efficiency_percent != null) {
    metrics.push({
      label: "Efficiency",
      value: `${data.efficiency_percent.toFixed(1)}%`,
    });
  }

  return (
    <div className="w-full max-w-lg space-y-0.5" data-testid="gain-performance-summary">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="grid grid-cols-[minmax(8rem,12rem)_minmax(8rem,auto)] items-center gap-x-5 py-1 text-[11px] font-mono"
        >
          <span className="text-text-secondary">{m.label}</span>
          <span className={`text-right ${m.colorClass ?? "text-text-primary"}`}>{m.value}</span>
        </div>
      ))}
    </div>
  );
}
