import { PARAMETER_DEFINITIONS, fingerprintText } from "../parameter-sweeps/model";
import { solveSweepModel, type SweepPointSolver } from "../parameter-sweeps/service";
import type { ParameterId, SolvedSweepModel } from "../parameter-sweeps/types";
import { buildOptimisationModel, MAX_RETAINED_SOLUTIONS, optimisationDefinitionKey, startingParameterValues, validateOptimisationDefinition } from "./model";
import { constraintFailures, scoreMetrics } from "./scoring";
import type { OptimisationCandidate, OptimisationDefinition, OptimisationProgress, OptimisationResult, RetainedOptimisationSolution } from "./types";

function abortError(): DOMException { return new DOMException("Antenna optimisation cancelled.", "AbortError"); }
function yieldToUi(): Promise<void> { return new Promise((resolve) => setTimeout(resolve, 0)); }
function finitePrecision(value: number): number { return Number(value.toPrecision(12)); }

export class AntennaOptimiserRunner {
  private readonly cache = new Map<string, SolvedSweepModel>();
  constructor(private readonly maximumCacheEntries = 256, private readonly pointSolver: SweepPointSolver = solveSweepModel) {}
  get cacheSize(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); }

  private cached(key: string): SolvedSweepModel | undefined {
    const value = this.cache.get(key);
    if (!value) return undefined;
    this.cache.delete(key); this.cache.set(key, value);
    return value;
  }

  private remember(key: string, value: SolvedSweepModel): void {
    this.cache.set(key, value);
    while (this.cache.size > this.maximumCacheEntries) this.cache.delete(this.cache.keys().next().value!);
  }

  async run(definition: OptimisationDefinition, options: { signal?: AbortSignal; onProgress?: (progress: OptimisationProgress) => void } = {}): Promise<OptimisationResult> {
    const errors = validateOptimisationDefinition(definition);
    if (errors.length) throw new RangeError(errors.join(" "));
    const captured = structuredClone(definition);
    const startedAt = new Date(); const started = performance.now();
    const history: OptimisationCandidate[] = [];
    const visited = new Set<string>();
    let cacheHits = 0;
    let best: RetainedOptimisationSolution | null = null;

    const candidateKey = (parameters: Partial<Record<ParameterId, number>>) => JSON.stringify(captured.variables.map((variable) => [variable.parameterId, parameters[variable.parameterId]]));
    const publishProgress = (parameters: Partial<Record<ParameterId, number>>) => options.onProgress?.({ completed: history.length, maximum: captured.algorithm.maximumEvaluations, cacheHits, bestScore: best?.score ?? null, currentParameters: { ...parameters } });

    const evaluate = async (parameters: Partial<Record<ParameterId, number>>): Promise<OptimisationCandidate | null> => {
      if (history.length >= captured.algorithm.maximumEvaluations) return null;
      if (options.signal?.aborted) throw abortError();
      const key = candidateKey(parameters);
      if (visited.has(key)) return null;
      visited.add(key);
      const built = buildOptimisationModel(captured, parameters);
      const modelErrors = built.issues.filter((issue) => issue.startsWith("error:"));
      let candidate: OptimisationCandidate;
      if (modelErrors.length) {
        candidate = { evaluation: history.length + 1, parameters: { ...parameters }, status: "model-rejected", score: null, bestSoFarScore: best?.score ?? null, rejectionReasons: modelErrors, solved: null, cached: false };
      } else {
        let solved = this.cached(built.modelKey); const wasCached = Boolean(solved);
        if (!solved) {
          try { solved = await this.pointSolver(built, options.signal); }
          catch (error) {
            if (options.signal?.aborted) throw abortError();
            const reason = error instanceof Error ? error.message : String(error);
            candidate = { evaluation: history.length + 1, parameters: { ...parameters }, status: "model-rejected", score: null, bestSoFarScore: best?.score ?? null, rejectionReasons: [reason], solved: null, cached: false };
            history.push(candidate); publishProgress(parameters); await yieldToUi(); return candidate;
          }
        } else cacheHits += 1;
        if (solved.modelKey !== built.modelKey) throw new Error(`Solved model identity mismatch at evaluation ${history.length + 1}.`);
        if (solved.necFingerprint !== fingerprintText(solved.generatedNec)) throw new Error(`NEC fingerprint mismatch at evaluation ${history.length + 1}.`);
        if (!wasCached) this.remember(built.modelKey, solved);
        const failures = constraintFailures(solved.metrics, captured.constraints);
        let score: number | null = null; let status: OptimisationCandidate["status"] = failures.length ? "constraint-rejected" : "feasible";
        if (!failures.length) {
          try { score = scoreMetrics(solved.metrics, captured.objective); }
          catch (error) { failures.push(error instanceof Error ? error.message : String(error)); status = "model-rejected"; }
          if (score !== null && !Number.isFinite(score)) { failures.push("The objective score is not finite."); score = null; status = "model-rejected"; }
        }
        candidate = { evaluation: history.length + 1, parameters: { ...parameters }, status, score, bestSoFarScore: best?.score ?? null, rejectionReasons: failures, solved: structuredClone(solved), cached: wasCached };
      }
      if (candidate.status === "feasible" && candidate.score !== null && candidate.solved && (best === null || candidate.score < best.score - 1e-12)) {
        best = { ...candidate, status: "feasible", score: candidate.score, bestSoFarScore: candidate.score, solved: candidate.solved };
      }
      candidate.bestSoFarScore = best?.score ?? null;
      history.push(candidate); publishProgress(parameters); await yieldToUi();
      return candidate;
    };

    const startParameters = startingParameterValues(captured);
    const startingDesign = await evaluate(startParameters);
    if (!startingDesign) throw new Error("The starting design could not be evaluated.");
    let currentParameters = { ...startParameters };
    let current = startingDesign;
    const steps = Object.fromEntries(captured.variables.map((variable) => [variable.parameterId, (variable.maximum - variable.minimum) * captured.algorithm.initialStepFraction])) as Partial<Record<ParameterId, number>>;
    let terminationReason: OptimisationResult["terminationReason"] = "search-exhausted";
    let iterations = 0;
    while (history.length < captured.algorithm.maximumEvaluations && iterations < 1000) {
      iterations += 1;
      if (options.signal?.aborted) throw abortError();
      const proposals: Array<Partial<Record<ParameterId, number>>> = [];
      for (const variable of captured.variables) {
        const parameter = PARAMETER_DEFINITIONS[variable.parameterId];
        const centre = currentParameters[variable.parameterId]!;
        for (const direction of [-1, 1]) {
          const raw = Math.min(variable.maximum, Math.max(variable.minimum, centre + direction * steps[variable.parameterId]!));
          const value = parameter.integer ? Math.round(raw) : finitePrecision(raw);
          const proposal = { ...currentParameters, [variable.parameterId]: value };
          if (!visited.has(candidateKey(proposal))) proposals.push(proposal);
        }
      }
      const evaluated: OptimisationCandidate[] = [];
      for (const proposal of proposals) {
        const candidate = await evaluate(proposal);
        if (candidate) evaluated.push(candidate);
        if (history.length >= captured.algorithm.maximumEvaluations) break;
      }
      const candidateBest = evaluated.filter((candidate): candidate is RetainedOptimisationSolution => candidate.status === "feasible" && candidate.score !== null && candidate.solved !== null).sort((left, right) => left.score - right.score)[0];
      const improved = candidateBest && (current.status !== "feasible" || current.score === null || candidateBest.score < current.score - 1e-12);
      if (improved) { current = candidateBest; currentParameters = { ...candidateBest.parameters }; }
      else for (const variable of captured.variables) steps[variable.parameterId] = steps[variable.parameterId]! * captured.algorithm.stepShrinkFactor;
      const belowTolerance = captured.variables.every((variable) => steps[variable.parameterId]! <= (variable.maximum - variable.minimum) * captured.algorithm.minimumStepFraction);
      if (belowTolerance) { terminationReason = "step-tolerance"; break; }
      if (proposals.length === 0 && !improved) {
        const immobile = captured.variables.every((variable) => {
          const parameter = PARAMETER_DEFINITIONS[variable.parameterId];
          return parameter.integer && steps[variable.parameterId]! < 0.5;
        });
        if (immobile) { terminationReason = "search-exhausted"; break; }
      }
    }
    if (history.length >= captured.algorithm.maximumEvaluations) terminationReason = "evaluation-limit";
    if (!best) throw new Error("No feasible solution was found within the selected limits and constraints.");
    const retainedSolutions = history.filter((candidate): candidate is RetainedOptimisationSolution => candidate.status === "feasible" && candidate.score !== null && candidate.solved !== null).sort((left, right) => left.score - right.score).filter((candidate, index, candidates) => candidates.findIndex((other) => other.solved.modelKey === candidate.solved.modelKey) === index).slice(0, MAX_RETAINED_SOLUTIONS).map((candidate) => structuredClone(candidate));
    return { schemaVersion: 2, id: `antenna-optimisation-${Date.now().toString(36)}`, definitionKey: optimisationDefinitionKey(captured), definition: captured, createdAt: startedAt.toISOString(), completedAt: new Date().toISOString(), elapsedMs: Math.max(0, performance.now() - started), terminationReason, startingDesign: structuredClone(startingDesign), bestSolution: structuredClone(best), retainedSolutions, history, cacheHits, engines: [...new Set(history.flatMap((candidate) => candidate.solved ? [candidate.solved.engine] : []))], warnings: [...new Set(history.flatMap((candidate) => candidate.solved?.warnings ?? []))], globalOptimumEstablished: false };
  }
}
