# Antenna optimiser

Status: implemented experimental browser/Wasm prototype on `feature/antenna-optimiser`; not a supported release optimiser

## Scope and claim boundary

The `/antenna-optimiser` route varies one or two declared dimensions, evaluates each exact model through the existing family NEC service, and retains the best feasible solutions it found. It never modifies, replaces, tunes, or bypasses the electromagnetic solver.

Results are called **“Best solution found.”** The application records `globalOptimumEstablished: false`. The deterministic local search does not justify “perfect antenna,” “global optimum,” construction-performance, or measurement-equivalence claims.

This is an experimental Phase 7 workflow prototype built before all Phase 0–6 release gates have passed. It tests bounded orchestration and evidence retention. It does not promote the inherited browser/Wasm engine or any family metric to release-validated status.

## Initial model and variable subset

| Family | Dimensions allowed to vary | Feed/objective limitations |
|---|---|---|
| Horizontal dipole | height; total length | Single-port impedance objectives available |
| Elevated vertical with explicit radials | radiator length; radial count | Single-port impedance objectives available |
| Three-element Yagi | first-director spacing; boom height | Single-port and directional objectives available |
| Two-element ideal-current phased array | element spacing; element-2 phase | Directional objectives only; no synthetic R, X, or SWR |

One or two dimensions may be enabled. User limits must stay inside the existing parameter registry and contain the generated starting design. Integer variables use integer candidate values. Existing family geometry, ground, segmentation, feed, and solver-result validators remain authoritative.

## Objectives

All objective scores use “lower is better”:

| Objective | Score |
|---|---|
| Lowest SWR | `SWR` |
| Maximum forward gain | `−gain_dBi` |
| Maximum front-to-back | `−F/B_dB` |
| Target feed resistance | `abs(R − target_R)` |
| Reactance nearest zero | `abs(X)` |
| Target take-off angle | `abs(angle − target_angle)` |

The weighted objective is deliberately explicit rather than presented as a universal quality score:

```text
wSWR × (SWR − 1)
− wGain × gain_dBi
− wFB × F/B_dB
+ wR × abs(R − target_R)
+ wX × abs(X)
+ wTO × abs(take_off − target_angle)
```

Weights carry inverse units and are not percentages. A zero weight removes a term. Unsupported quantities must have zero weight and cannot be selected as single objectives.

## Constraints

Optional result constraints are:

- maximum SWR for single-port models;
- minimum gain;
- minimum front-to-back for directional models;
- maximum take-off angle.

A solved candidate that violates a constraint remains in history as `constraint-rejected` and cannot become a retained solution. A candidate rejected by typed geometry/segmentation validation or solver execution remains `model-rejected`. Rejection does not modify its dimensions to force acceptance.

## Search algorithm

Algorithm identifier: `bounded-coordinate-pattern-search-v1`.

1. Evaluate the exact generated starting design.
2. Set each coordinate step to its user range multiplied by `initialStepFraction`.
3. Evaluate unused bounded `−step` and `+step` neighbours for each enabled coordinate.
4. Move to the lowest-score feasible improving neighbour.
5. If no neighbour improves, multiply all steps by `stepShrinkFactor`.
6. Stop at the evaluation limit, the minimum-step fraction, or an exhausted discrete search.

The algorithm is deterministic and uses no random seed. The UI exposes the maximum evaluations, initial step fraction, shrink factor, and minimum step fraction. At most 121 unique candidates are evaluated. These defaults and ceilings are safety bounds, not evidence of adequate exploration.

Coordinate pattern search can stop in a local minimum, move along a boundary, miss a narrow optimum, or behave poorly across discrete segmentation/topology changes. It provides no mathematical global-optimum certificate.

## Execution, cancellation, and cache

```text
immutable optimisation definition
  -> bounded candidate parameter map
  -> existing typed family model
  -> existing validity/segmentation/NEC adapter
  -> unchanged local NEC/Wasm worker service
  -> existing family result validator
  -> objective + constraints
  -> history and retained best-found models
```

Jobs are sequential and each NEC execution remains in the existing worker boundary. The active `AbortSignal` reaches the family service and worker. Cancellation returns no partial optimisation result. UI progress may report the best score seen so far but does not publish a candidate as a completed design.

A 256-entry session-only LRU cache is keyed by the complete typed model. Exact cache hits are revalidated against model identity and the full deck fingerprint before use. Failed and invalid candidates are not cached. Reloading or updating the application clears the cache.

## Retained evidence

The completed result records:

- complete initial conditions, variables, bounds, objective, targets, weights, constraints, and algorithm settings;
- start/completion timestamps, elapsed time, termination reason, cache hits, and solver engine strings;
- every evaluated parameter map, status, score, best-so-far score, rejection reason, model key, warnings, full generated NEC deck, and deck fingerprint where solved;
- the starting design;
- up to five unique feasible models ordered by objective score;
- the best solution found and the explicit false global-optimum flag.

The locally downloaded `hf-antenna-studio-antenna-optimisation.json` contains this complete evidence and may disclose private antenna dimensions. No upload or network resource is used. FNV-1a-32 fingerprints detect accidental association errors; the full model and deck are authoritative and the fingerprint is not a cryptographic signature.

## Visualisation

- The history graph shows each feasible candidate score and the stepwise best score found. Rejected candidates remain in the exact history table.
- Starting and best-found designs are compared across every enabled dimension and requested RF metric.
- Up to five best feasible models are selectable for exact model-key, fingerprint, and NEC-deck inspection.
- Stale controls are visibly separated from the completed historical run.

## Automated evidence

- A pure known convex fixture makes SWR a quadratic function of dipole length. The deterministic search improves the starting score and approaches the known fixture minimum without any NEC-number tuning.
- Pure tests cover all objective formulas, raw-unit weighted scoring, constraints, family/objective compatibility, starting-bound validation, deterministic history, exact cache replay, retained-solution limits, candidate rejection, cancellation, model identity, deck fingerprints, and cautious export language.
- Playwright runs a seven-evaluation dipole SWR task through real local nec2c/Wasm, inspects the graph/start-final/retained evidence, exports exact decks and metadata, and repeats from cache. A two-variable constrained Yagi weighted run exercises directional objectives. A third case checks the 121-evaluation ceiling, cancellation, and narrow layout.
- The complete existing regression suite remains the numerical evidence for the underlying family services. Optimiser success is not new electromagnetic validation.

## Critical review and resolutions

| Challenge | Resolution or retained limitation |
|---|---|
| A local heuristic may be mistaken for a global optimiser. | Every UI/export claim says “Best solution found”; the result schema fixes `globalOptimumEstablished` to false and documents termination. |
| Optimisation can exploit solver/model defects. | Candidate generation reuses existing validation and retains every exact deck, but independent point sampling and convergence remain release gates. |
| Weighted scores can conceal incompatible units and subjective trade-offs. | The raw-unit formula is shown beside controls and all targets/weights are exported; weights are not called percentages. |
| Constraints can make the feasible region empty. | Rejections remain in history. A run with no feasible candidate fails instead of relabelling a rejected model as best. |
| Invalid geometry might be clamped into a plausible candidate. | Parameter bounds and existing typed-model checks reject candidates; the optimiser does not repair geometry silently. |
| Cancellation could leave a misleading partial “winner.” | Completion is atomic; cancelled runs publish no result. |
| Cached results could belong to another solver or coordinate. | Cache is session-only, keyed by the full model, and checked against model/deck identity. Persistent versioned caches remain future work. |
| A 121-point search can still be expensive, especially for ideal arrays. | Sequential worker execution, progress, cancellation, and a hard cap limit damage; packaged Windows benchmarks are still required. |
| A retained result may be hypersensitive to construction tolerances. | No tolerance/robustness claim is made. Perturbation, convergence, established-package, and measurement checks remain required. |

## Known limitations and manual checks

- Only four families, two declared dimensions per family, and one/two-variable searches are implemented.
- There is no random/multistart search, global certificate, adaptive surrogate, Pareto frontier, manufacturing-tolerance objective, multi-frequency objective, persisted resume, or optimizer-to-project import.
- Constraints apply to solved RF metrics only; arbitrary expressions and geometry relationships are not yet user-definable.
- Each candidate requests full family result output. Optimisation-specific safe solver batching is not implemented.
- Integer/discontinuous parameter landscapes can terminate early when the shrinking step rounds to visited values.
- Real-ground, resonance, close-spacing, deep-null, high-radial-count, and segmentation-boundary results require special review.
- Manually test long cancellation, cache pressure, history tooltips, keyboard flow, colour distinction, large JSON exports, and Windows 11 packaged CPU/memory/GPU behaviour.

The feature adds no dependency, external optimiser code, proprietary asset, dataset, reference model, comparator executable, or network service. Its original source, tests, and documentation remain under GPL-3.0-or-later; existing solver and reference provenance requirements are unchanged.
