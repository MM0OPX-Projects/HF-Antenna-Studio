import type { TemplateParameterDefinition } from "./schema";
import { displayStep, fromDisplayUnit, toDisplayUnit } from "./units";

interface TemplateParameterControlProps {
  definition: TemplateParameterDefinition;
  valueSI: number;
  imperial: boolean;
  onChange: (valueSI: number) => void;
}

export function TemplateParameterControl({ definition, valueSI, imperial, onChange }: TemplateParameterControlProps) {
  const unit = imperial ? definition.imperialUnit : definition.metricUnit;
  const value = toDisplayUnit(valueSI, unit);
  const minimum = toDisplayUnit(definition.minSI, unit);
  const maximum = toDisplayUnit(definition.maxSI, unit);
  const step = displayStep(definition.stepSI, unit);
  const testId = `template-param-${definition.key}`;
  return (
    <div className="rounded-md border border-border bg-background/40 p-3" data-testid={`${testId}-control`}>
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={`${testId}-number`} className="text-xs font-medium">{definition.label}<span className="mt-0.5 block max-w-56 font-normal leading-relaxed text-text-secondary">{definition.description}</span></label>
        <div className="flex shrink-0">
          <input
            id={`${testId}-number`}
            data-testid={testId}
            type="number"
            value={Number(value.toFixed(Math.max(definition.decimals, 4)))}
            min={minimum}
            max={maximum}
            step={step}
            onChange={(event) => onChange(fromDisplayUnit(Number(event.target.value), unit))}
            className="w-24 rounded-l border border-border bg-surface px-2 py-1.5 text-right font-mono text-xs outline-none focus:border-accent"
          />
          <span className="min-w-12 rounded-r border-y border-r border-border bg-surface-hover px-2 py-1.5 text-center text-[10px] text-text-secondary">{unit === "count" ? "" : unit}</span>
        </div>
      </div>
      <input
        type="range"
        aria-label={`${definition.label} slider`}
        data-testid={`${testId}-slider`}
        value={value}
        min={minimum}
        max={maximum}
        step={step}
        onChange={(event) => onChange(fromDisplayUnit(Number(event.target.value), unit))}
        className="mt-3 w-full accent-blue-500"
      />
      <div className="mt-1 flex justify-between font-mono text-[9px] text-text-secondary"><span>{minimum.toFixed(definition.decimals)}</span><span>{maximum.toFixed(definition.decimals)} {unit === "count" ? "" : unit}</span></div>
    </div>
  );
}
