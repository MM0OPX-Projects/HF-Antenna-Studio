# Parameter sweep laboratory

Status: implemented experimental browser/Wasm feature on `feature/parameter-sweeps`

## Scope

The `/parameter-sweeps` route runs controlled one- or two-dimensional studies through existing typed antenna models and family solver services. It does not implement an optimiser. The initial parameter registry is:

| Family | Parameters | Solved metrics |
|---|---|---|
| Horizontal dipole | height; total length | SWR, maximum gain, take-off angle, feed R and X |
| Elevated vertical with explicit radials | radiator length; radial count | SWR, maximum gain, take-off angle, feed R and X |
| Three-element Yagi | first-director spacing; boom height | SWR, forward gain, take-off angle, axial front-to-back, feed R and X |
| Two-element ideal-current phased array | element spacing; element-2 phase | forward gain, take-off angle, front-to-back |

All geometry values are SI metres internally. Frequency is stored in MHz at the sweep-definition boundary and converted exactly to Hz in each family model. Generated frequency-scaled dimensions are starting models, not resonance or construction recommendations.

Ideal-current array points intentionally report no SWR, feed resistance, or feed reactance. Enforced relative currents across two coupled ports do not define one physical input impedance.

## Workload contract

- One-dimensional sweeps accept 2–81 points.
- Two-dimensional sweeps accept at most nine points per axis and 81 jobs in total.
- Integer parameters, currently radial count, must use integer endpoints and must generate distinct rounded values.
- The two axes must be different parameters from the same antenna family.
- Jobs run sequentially. Each family service executes NEC in the existing Web Worker, so the browser main thread remains available for paint, input, progress, and cancellation.
- A cancelled or failed run publishes no partial result.

These are safety ceilings, not measured Windows throughput recommendations. Packaged Windows 11 performance and memory measurements remain required before changing them.

## Model and solver path

```text
immutable sweep definition
  -> inclusive exact axis values
  -> family typed SI model for one coordinate
  -> family geometry/validation/segmentation/NEC adapter
  -> local nec2c/Wasm worker
  -> family result validator
  -> common metric record + exact model/deck evidence
  -> 1D plot or 2D heat map
```

The sweep layer does not edit NEC cards to create parameter states and does not tune values toward expected results. Dipole, vertical, Yagi, and phased-array calculation behaviour remains owned by their existing services.

Before accepting a point, the runner checks that every requested axis value is present in the generated typed model. After solving, it checks the returned model identity and recomputes the deck fingerprint. A point records:

- ordinal and exact axis values;
- complete parameter-value map;
- serialized typed domain-model key;
- full generated NEC deck;
- `FNV-1a-32` deck fingerprint;
- solver engine string and solver duration;
- metrics and warnings;
- whether the exact model came from the session cache.

The short FNV fingerprint detects accidental UI/evidence mismatches; it is not collision-resistant and must not be used as a security signature. The full model key and NEC deck are the authoritative evidence.

## Ground models

Perfect ground and Sommerfeld/Norton real ground share one definition across a run. Conductivity and relative permittivity are explicit for real ground.

- Dipole, vertical, and Yagi families map the selection into their existing ground schema.
- The vertical remains an elevated system with explicit radial wires.
- A real-ground phased array uses four explicit elevated radial wires per element.
- A perfect-ground phased array uses the existing image-ground monopoles.

These phased-array configurations are visibly distinguished and are not claimed to be physically equivalent.

## Cancellation and caching

One `AbortController` owns a run. Cancellation is forwarded into the current family service and solver worker; the orchestrator also checks the signal before and after each point. No result object is returned until every requested point passes lineage checks.

The bounded 192-entry in-memory LRU cache is keyed by the complete serialized typed model, including geometry, frequency, ground constants, and impedance reference. Cache hits are rechecked against the current requested axes. The cache is not written to disk, does not survive reload, and is cleared explicitly from the page. Because it is session-only, an application/solver update necessarily starts with an empty cache.

## Visualisation and export

One-dimensional results use an interactive Cartesian plot with labelled parameter and metric axes plus exact tooltips. Two-dimensional results use a numeric, keyboard-selectable heat-map table whose rows and columns retain exact axis values. Colour is redundant with the printed value.

The selected point exposes all available metrics, exact model key, NEC fingerprint, solver provenance, warnings, and the complete deck. The result table retains every point.

`hf-antenna-studio-parameter-sweep.json` is a local versioned reproducibility export. It contains the complete definition and every point/deck; it may therefore disclose private antenna dimensions. No network service or remote asset is used.

## Automated evidence

- Pure tests cover inclusive continuous/integer grids, row-major 2D coordinates, duplicate/incompatible axes, distinct integer states, all eight parameter-to-family mappings, the 81-job ceiling, exact-model identity, deck fingerprints, progress, cache reuse, cancellation, rejected lineage, and JSON evidence retention.
- Playwright runs a three-point dipole-height study through real nec2c/Wasm, verifies exact parameter/model/deck metadata, repeats it entirely from cache, runs a four-cell vertical-length/radial-count heat map, selects an exact cell, rejects a 100-job request, cancels an 81-point run, checks the narrow layout, and monitors browser errors.
- Existing family validation cases remain the numerical evidence for each metric. A sweep adds orchestration and lineage evidence; it is not a new electromagnetic oracle.

## Critical review and resolutions

| Challenge | Resolution or retained limitation |
|---|---|
| A sweep may silently vary more than its named parameter. | The full base model and all exact point model keys/decks are exported. Family starting dimensions remain fixed within the run except for selected axes. |
| Rounded integer axes can repeat radial-count models. | Distinct generated values are validated before execution; invalid grids are blocked. |
| A stale result may be shown after control changes. | Definition identity gates every plot. Stale results receive a warning and are hidden, while their exact JSON remains exportable. |
| Two-dimensional grids can create accidental denial-of-service workloads. | Both axes and the total product are bounded; jobs run sequentially and are cancellable. Packaged performance remains unmeasured. |
| Cached results can be assigned to the wrong coordinate. | Cache keys use the full domain model, and requested parameter values are rechecked before point publication. |
| An ideal array may appear to have an optimiser-ready impedance objective. | Its SWR/R/X are unavailable and no values are synthesized. |
| Heat-map colour may exaggerate tiny differences. | Exact numbers are printed in every cell and the scale endpoints are visible. Users must judge engineering significance and solver precision. |
| Dense sampling can conceal geometry/segmentation discontinuities. | Every model/deck is retained, but automatic discontinuity and convergence analysis is not yet implemented. This remains a Phase 6 gate. |

## Known limitations and manual checks

- Only the eight declared parameters and four families are available; arbitrary template/Wire Editor parameters are not yet registered.
- Two-dimensional sweeps are rectangular grids only. There is no resume, persisted cache, constraint expression, adaptive sampling, tolerance study, or optimisation.
- Every point requests the family’s full pattern/current calculation even when the selected display metric needs less output. Safe solver batching is future performance work.
- A phase sweep may reuse the phased service’s geometry calibration cache; spacing changes require distinct calibrations.
- Real-ground, high-radial-count, close-spacing, resonance, deep-null, and segmentation-boundary regions require convergence and established-package review.
- Manually review long runs, cancellation timing, keyboard/tooltip behaviour, heat-map contrast, JSON size, and Windows 11 browser/GPU/memory behaviour.

The feature adds no dependency, third-party artwork, external dataset, comparator binary, or network service. Its original TypeScript, tests, and documentation remain under the repository’s GPL-3.0-or-later terms; the existing solver provenance and distribution checklist is unchanged.
