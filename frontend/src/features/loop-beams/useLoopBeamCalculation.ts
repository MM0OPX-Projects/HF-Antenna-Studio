import { useEffect, useMemo, useState } from "react";
import { useUIStore } from "../../stores/uiStore";
import { HeightLabScheduler, type HeightCalculationState } from "../height-lab/scheduler";
import { generateLoopBeamModel, loopBeamModelKey } from "./model";
import { runLoopBeamModel } from "./service";
import type { LoopBeamModel, LoopBeamSolverResult } from "./schema";

const EMPTY: HeightCalculationState<LoopBeamSolverResult> = { key: "", phase: "idle", result: null, error: null };

export function useLoopBeamCalculation(model: LoopBeamModel, valid: boolean) {
  const conductor = useUIStore((state) => state.conductor);
  const key = useMemo(() => loopBeamModelKey(model), [conductor, model]);
  const [scheduler] = useState(() => new HeightLabScheduler<LoopBeamSolverResult>(450, 48));
  const [state, setState] = useState(EMPTY);
  useEffect(() => {
    if (!valid) { scheduler.cancel(); return; }
    scheduler.schedule(key, (signal) => runLoopBeamModel(generateLoopBeamModel(model), { signal }), setState);
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
