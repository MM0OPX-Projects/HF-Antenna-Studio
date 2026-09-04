import { useEffect, useMemo, useState } from "react";
import { HeightLabScheduler, type HeightCalculationState } from "../height-lab/scheduler";
import { generatePhasedArray, phasedArrayModelKey } from "./model";
import { phasedCalibrationCacheSize, runPhasedArrayModel } from "./service";
import type { PhasedArrayModel, PhasedArraySolverResult } from "./schema";
import { useUIStore } from "../../stores/uiStore";

const EMPTY: HeightCalculationState<PhasedArraySolverResult> = { key: "", phase: "idle", result: null, error: null };

export function usePhasedArrayCalculation(model: PhasedArrayModel, valid: boolean) {
  const conductor = useUIStore((state) => state.conductor);
  const key = useMemo(() => phasedArrayModelKey(model), [conductor, model]);
  const [scheduler] = useState(() => new HeightLabScheduler<PhasedArraySolverResult>(450, 48));
  const [state, setState] = useState(EMPTY);
  useEffect(() => {
    if (!valid) { scheduler.cancel(); return; }
    scheduler.schedule(key, (signal) => runPhasedArrayModel(generatePhasedArray(model), { signal }), setState);
    return () => scheduler.cancel();
  }, [key, model, scheduler, valid]);
  return {
    key,
    phase: !valid ? "idle" as const : state.key === key ? state.phase : "debouncing" as const,
    result: valid && state.key === key ? state.result : null,
    error: valid && state.key === key ? state.error : null,
    cacheEntries: scheduler.cacheSize,
    calibrationCacheEntries: phasedCalibrationCacheSize(),
  };
}
