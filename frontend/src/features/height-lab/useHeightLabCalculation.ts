import { useEffect, useMemo, useState } from "react";
import type { HorizontalDipoleModel } from "../verified-dipole/model";
import { runVerifiedDipole } from "../verified-dipole/service";
import type { VerifiedDipoleResult } from "../verified-dipole/result";
import { heightLabModelKey } from "./model";
import { useUIStore } from "../../stores/uiStore";
import { HeightLabScheduler, type HeightCalculationState } from "./scheduler";

const EMPTY_STATE: HeightCalculationState<VerifiedDipoleResult> = {
  key: "",
  phase: "idle",
  result: null,
  error: null,
};

export function useHeightLabCalculation(model: HorizontalDipoleModel, valid: boolean) {
  const conductor = useUIStore((state) => state.conductor);
  const key = useMemo(() => heightLabModelKey(model), [conductor, model]);
  const [scheduler] = useState(() => new HeightLabScheduler<VerifiedDipoleResult>(450, 40));
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(() => {
    if (!valid) {
      scheduler.cancel();
      return;
    }
    scheduler.schedule(
      key,
      async (signal) => (await runVerifiedDipole(model, { signal })).result,
      setState,
    );
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
