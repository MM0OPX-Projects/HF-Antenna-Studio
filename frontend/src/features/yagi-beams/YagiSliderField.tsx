interface YagiSliderFieldProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  decimals?: number;
  testId: string;
  onChange: (value: number) => void;
}

export function YagiSliderField({ label, description, value, min, max, step, unit, decimals = 3, testId, onChange }: YagiSliderFieldProps) {
  const labelId = `${testId}-label`;
  return <div className="space-y-1.5">
    <div className="flex items-start justify-between gap-3">
      <label id={labelId} htmlFor={testId} className="text-xs font-medium">{label}<span className="mt-0.5 block text-[10px] font-normal text-text-secondary">{description}</span></label>
      <div className="flex items-center gap-1"><input id={testId} data-testid={testId} type="number" value={Number(value.toFixed(decimals))} min={min} max={max} step={step} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(next); }} className="w-24 rounded border border-border bg-background px-2 py-1 text-right font-mono text-xs" /><span className="w-8 text-[10px] text-text-secondary">{unit}</span></div>
    </div>
    <input type="range" data-testid={`${testId}-slider`} aria-labelledby={labelId} value={Math.max(min, Math.min(max, value))} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-orange-500" />
  </div>;
}
