import { useEffect, useMemo, useRef, useState } from "react";
import type { SimulateAdvancedRequest } from "../../engine/types";
import { runRadiationPattern, type RadiationPatternResult } from "../../features/radiation-cuts/service";
import { RadiationCutPair } from "./RadiationCutPair";

interface OnDemandRadiationCutsProps {
  antenna: SimulateAdvancedRequest;
  frequencyMhz: number | null;
  modelKey: string;
  title?: string;
  autoRunKey?: string | null;
  testId?: string;
}

type CutStatus = "idle" | "running" | "success" | "cancelled" | "error";

export function OnDemandRadiationCuts({
  antenna,
  frequencyMhz,
  modelKey,
  title = "Azimuth and elevation cuts",
  autoRunKey = null,
  testId = "on-demand-radiation-cuts",
}: OnDemandRadiationCutsProps) {
  const [result, setResult] = useState<(RadiationPatternResult & { requestKey: string }) | null>(null);
  const [status, setStatus] = useState<CutStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const jobRef = useRef(0);
  const requestKey = useMemo(() => `${modelKey}|${frequencyMhz ?? "none"}`, [frequencyMhz, modelKey]);
  const current = result?.requestKey === requestKey ? result : null;

  const run = async () => {
    if (frequencyMhz === null || !Number.isFinite(frequencyMhz)) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const job = ++jobRef.current;
    const capturedKey = requestKey;
    setStatus("running");
    setError(null);
    try {
      const solved = await runRadiationPattern(antenna, frequencyMhz, { signal: controller.signal, patternStep: 5 });
      if (job !== jobRef.current || controller.signal.aborted) return;
      setResult({ ...solved, requestKey: capturedKey });
      setStatus("success");
    } catch (caught) {
      if (job !== jobRef.current) return;
      if (controller.signal.aborted) {
        setStatus("cancelled");
        setError(null);
      } else {
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "Radiation-pattern calculation failed.");
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };
  const latestRunRef = useRef(run);

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    latestRunRef.current = run;
  });
  useEffect(() => {
    if (autoRunKey) void latestRunRef.current();
  }, [autoRunKey]);

  const cancel = () => {
    jobRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("cancelled");
  };
  const stale = result !== null && current === null;
  const statusText = frequencyMhz === null
    ? "Select a solved frequency before calculating radiation cuts."
    : status === "running"
      ? `Calculating ${frequencyMhz.toFixed(6)} MHz radiation cuts…`
      : current
        ? `${current.frequencyMhz.toFixed(6)} MHz · ${current.engine} · ${current.computedInMs.toFixed(0)} ms`
        : stale
          ? `The frequency or antenna changed. Recalculate cuts for ${frequencyMhz.toFixed(6)} MHz.`
          : status === "cancelled"
            ? "Radiation-cut calculation cancelled."
            : status === "error"
              ? error
              : `Ready to calculate ${frequencyMhz.toFixed(6)} MHz radiation cuts.`;

  return <section className="space-y-3" data-testid={testId}>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface p-3">
      <p className={`text-xs ${status === "error" ? "text-red-500" : stale ? "text-amber-600" : "text-text-secondary"}`} aria-live="polite">{statusText}</p>
      {status === "running"
        ? <button type="button" data-testid={`${testId}-cancel`} onClick={cancel} className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-500">Cancel cuts</button>
        : <button type="button" data-testid={`${testId}-run`} disabled={frequencyMhz === null} onClick={() => void run()} className="rounded border border-accent/50 px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-40">{current ? "Recalculate cuts" : "Calculate cuts"}</button>}
    </div>
    <RadiationCutPair
      pattern={current?.pattern}
      title={title}
      context={current ? `Current antenna · ${current.frequencyMhz.toFixed(6)} MHz · separate full-pattern NEC calculation` : undefined}
      pending={status === "running"}
      stale={stale}
      emptyMessage={stale ? "The previous pattern is hidden because it belongs to different model conditions." : "Calculate the selected model to display both radiation cuts."}
      testId={`${testId}-plots`}
    />
  </section>;
}
