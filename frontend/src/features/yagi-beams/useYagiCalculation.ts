import { useEffect, useMemo, useState } from "react";
import { HeightLabScheduler, type HeightCalculationState } from "../height-lab/scheduler";
import { generateYagiModel, yagiModelKey } from "./model";
import { runYagiModel } from "./service";
import type { YagiAntennaModel, YagiSolverResult } from "./schema";
import { useUIStore } from "../../stores/uiStore";

const EMPTY: HeightCalculationState<YagiSolverResult> = { key: "", phase: "idle", result: null, error: null };

export function useYagiCalculation(model: YagiAntennaModel, valid: boolean) {
  const conductor = useUIStore((state) => state.conductor);
  const key = useMemo(() => yagiModelKey(model), [conductor, model]);
  const [scheduler] = useState(() => new HeightLabScheduler<YagiSolverResult>(450, 48));
  const [state, setState] = useState(EMPTY);
  useEffect(() => {
    if (!valid) { scheduler.cancel(); return; }
    scheduler.schedule(key, (signal) => runYagiModel(generateYagiModel(model), { signal }), setState);
    return () => scheduler.cancel();
  }, [key, model, scheduler, valid]);
  return {
    key,
    phase: !valid ? "idle" as const : state.key === key ? state.phase : "debouncing" as const,
    result: valid && state.key === key ? state.result : null,
    error: valid && state.key === key ? state.error : null,
    cacheEntries: scheduler.cacheSize,
  };
}
