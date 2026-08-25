import { generatePhasedArray } from "../phased-arrays/model";
import { runPhasedArrayModel } from "../phased-arrays/service";
import { runVerifiedDipole } from "../verified-dipole/service";
import { generateVerticalModel } from "../vertical-antennas/model";
import { runVerticalModel } from "../vertical-antennas/service";
import { generateYagiModel } from "../yagi-beams/model";
import { runYagiModel } from "../yagi-beams/service";
import { buildSweepModel, builtParameterValue, fingerprintText, parameterCoordinates, parameterSweepDefinitionKey, validateParameterSweepDefinition, type BuiltSweepModel } from "./model";
import type { ParameterSweepDefinition, ParameterSweepProgress, ParameterSweepResult, SolvedSweepModel, SweepMetrics } from "./types";

export type SweepPointSolver = (built: BuiltSweepModel, signal?: AbortSignal) => Promise<SolvedSweepModel>;

function pointMetrics(values: Partial<SweepMetrics> & Pick<SweepMetrics, "gainDbi" | "takeOffAngleDeg">): SweepMetrics {
  return { swr: null, frontToBackDb: null, resistanceOhm: null, reactanceOhm: null, ...values };
}

export async function solveSweepModel(built: BuiltSweepModel, signal?: AbortSignal): Promise<SolvedSweepModel> {
  if (built.issues.some((issue) => issue.startsWith("error:"))) throw new Error(`Invalid generated sweep model: ${built.issues.filter((issue) => issue.startsWith("error:")).join(" ")}`);
  if (built.family === "dipole") {
    const run = await runVerifiedDipole(built.model, { signal });
    const result = run.result;
    return { modelKey: built.modelKey, generatedNec: result.generatedNec, necFingerprint: fingerprintText(result.generatedNec), metrics: pointMetrics({ swr: result.swr, gainDbi: result.maximumGainDbi, takeOffAngleDeg: result.takeOffAngleDeg ?? 0, resistanceOhm: result.resistanceOhm, reactanceOhm: result.reactanceOhm }), engine: result.engine, computedInMs: result.computedInMs, warnings: result.warnings };
  }
  if (built.family === "vertical") {
    const result = await runVerticalModel(generateVerticalModel(built.model), { signal });
    return { modelKey: built.modelKey, generatedNec: result.generatedNec, necFingerprint: fingerprintText(result.generatedNec), metrics: pointMetrics({ swr: result.swr, gainDbi: result.maximumGainDbi, takeOffAngleDeg: result.takeOffAngleDeg, resistanceOhm: result.resistanceOhm, reactanceOhm: result.reactanceOhm }), engine: result.engine, computedInMs: result.computedInMs, warnings: result.warnings };
  }
  if (built.family === "yagi") {
    const result = await runYagiModel(generateYagiModel(built.model), { signal });
    if (result.modelKey !== built.modelKey) throw new Error("Yagi result model identity does not match the requested sweep point.");
    return { modelKey: result.modelKey, generatedNec: result.generatedNec, necFingerprint: fingerprintText(result.generatedNec), metrics: pointMetrics({ swr: result.swr, gainDbi: result.forwardGainDbi, takeOffAngleDeg: result.takeOffAngleDeg, frontToBackDb: result.frontToBackDb, resistanceOhm: result.resistanceOhm, reactanceOhm: result.reactanceOhm }), engine: result.engine, computedInMs: result.computedInMs, warnings: result.warnings };
  }
  const result = await runPhasedArrayModel(generatePhasedArray(built.model), { signal });
  if (result.modelKey !== built.modelKey) throw new Error("Phased-array result model identity does not match the requested sweep point.");
  return { modelKey: result.modelKey, generatedNec: result.generatedNec, necFingerprint: fingerprintText(result.generatedNec), metrics: pointMetrics({ gainDbi: result.forwardGainDbi, takeOffAngleDeg: result.takeOffAngleDeg, frontToBackDb: result.frontToBackDb }), engine: result.engine, computedInMs: result.computedInMs, warnings: [...result.warnings, "Ideal-current phased-array points have no single physical feed impedance; SWR, R and X are unavailable."] };
}

function abortError(): DOMException { return new DOMException("Parameter sweep cancelled.", "AbortError"); }
function yieldToUi(): Promise<void> { return new Promise((resolve) => setTimeout(resolve, 0)); }

export class ParameterSweepRunner {
  private readonly cache = new Map<string, SolvedSweepModel>();
  constructor(private readonly maximumCacheEntries = 192, private readonly pointSolver: SweepPointSolver = solveSweepModel) {}

  get cacheSize(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); }

  private cached(key: string): SolvedSweepModel | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    this.cache.delete(key); this.cache.set(key, entry);
    return entry;
  }

  private remember(key: string, value: SolvedSweepModel): void {
    this.cache.set(key, value);
    while (this.cache.size > this.maximumCacheEntries) this.cache.delete(this.cache.keys().next().value!);
  }

  async run(definition: ParameterSweepDefinition, options: { signal?: AbortSignal; onProgress?: (progress: ParameterSweepProgress) => void } = {}): Promise<ParameterSweepResult> {
    const errors = validateParameterSweepDefinition(definition);
    if (errors.length) throw new RangeError(errors.join(" "));
    const captured = structuredClone(definition);
    const coordinates = parameterCoordinates(captured);
    const startedAt = new Date();
    const started = performance.now();
    const points: ParameterSweepResult["points"] = [];
    let cacheHits = 0;
    for (let index = 0; index < coordinates.length; index += 1) {
      if (options.signal?.aborted) throw abortError();
      const coordinate = coordinates[index]!;
      const built = buildSweepModel(captured, coordinate.parameterValues);
      for (const axis of captured.axes) {
        const expected = coordinate.parameterValues[axis.parameterId]!;
        const actual = builtParameterValue(built, axis.parameterId);
        if (!Number.isFinite(actual) || Math.abs(actual - expected) > Math.max(1e-10, Math.abs(expected) * 1e-10)) throw new Error(`Generated ${axis.parameterId} value ${actual} does not match requested sweep value ${expected}.`);
      }
      let solved = this.cached(built.modelKey);
      const wasCached = Boolean(solved);
      if (!solved) {
        try { solved = await this.pointSolver(built, options.signal); }
        catch (error) { if (options.signal?.aborted) throw abortError(); throw error; }
        if (solved.modelKey !== built.modelKey) throw new Error(`Solved model identity mismatch at point ${index + 1}.`);
        if (solved.necFingerprint !== fingerprintText(solved.generatedNec)) throw new Error(`NEC fingerprint mismatch at point ${index + 1}.`);
        this.remember(built.modelKey, solved);
      } else cacheHits += 1;
      if (options.signal?.aborted) throw abortError();
      points.push({ ...structuredClone(solved), ordinal: index, axisValues: [...coordinate.axisValues], parameterValues: { ...coordinate.parameterValues }, cached: wasCached });
      options.onProgress?.({ completed: index + 1, total: coordinates.length, cacheHits, currentLabel: captured.axes.map((axis) => `${axis.parameterId}=${coordinate.parameterValues[axis.parameterId]}`).join(", ") });
      await yieldToUi();
    }
    const warnings = [...new Set(points.flatMap((point) => point.warnings))];
    return { schemaVersion: 2, id: `parameter-sweep-${Date.now().toString(36)}`, definitionKey: parameterSweepDefinitionKey(captured), definition: captured, createdAt: startedAt.toISOString(), completedAt: new Date().toISOString(), elapsedMs: Math.max(0, performance.now() - started), totalJobs: coordinates.length, cacheHits, points, engines: [...new Set(points.map((point) => point.engine))], warnings };
  }
}
