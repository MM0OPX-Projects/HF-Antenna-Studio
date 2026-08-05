# HF Antenna Studio — Development Roadmap

Status: phased proposal; dates intentionally unset
Planning baseline: 2026-08-02

## Roadmap policy

Phases are evidence gates, not calendar promises. A phase is complete only when its exit evidence is reviewed and committed. Features may be prototyped earlier, but they cannot be described as working or validated until their relevant gate passes.

Numerical correctness, diagnostic preservation, offline Windows packaging, and license compliance precede breadth. Optimization is deliberately late because it magnifies any model-generation or solver error.

## Phase 0 — Foundation, licensing, and solver bake-off

Goal: remove the assumptions that could invalidate the rest of the architecture.

### Work

- Confirm project name availability and adopt branding created specifically for HF Antenna Studio.
- Maintain the imported root GPL-3.0-or-later license and package metadata; establish SPDX and third-party notice conventions before release.
- Inventory AntennaSim components that may be reused and create a file-level provenance record.
- Resolve or conservatively document the exact `nec2c` source license/provenance.
- Pin and reproducibly build x64 Windows candidates for native `nec2c` and NEC2++.
- Create the initial independent validation corpus and comparison-report schema.
- Exercise both candidates through a minimal no-shell process runner.
- Preserve exact decks, output, stderr, exit code, compiler flags, binary hashes, and environment metadata.
- Test clean Windows 11 VMs, disconnected installation assumptions, non-ASCII/space-containing paths, cancellation, timeouts, malformed decks, crashes, and representative endpoint security.
- Spike Tauri 2 packaging with WebView2 embedded offline installer and fixed-runtime variants.
- Decide the initial NEC dialect/subset only after corpus inventory.

### Exit evidence

- Signed architecture decision selecting a solver or explicitly rejecting both.
- Reviewed numerical report satisfying the Phase 0 subset of `VALIDATION_PLAN.md`.
- Reproducible solver build instructions and source/patch archive references.
- Licensing review with no unresolved blocker for the exact distributed bundle.
- An air-gapped Windows 11 packaging proof, even if the UI is only a diagnostic shell.
- Recorded choice of WebView2 packaging and its licensing/size/update consequences.
- Updated risk register with measured rather than assumed performance and packaging risks.

If neither solver passes, stop product implementation and investigate another open-source NEC implementation through the same adapter criteria.

## Phase 1 — Trustworthy vertical slice

Goal: calculate and inspect one simple wire model end to end with complete evidence.

### Work

- Scaffold the desktop, canonical schema, validation library, native IPC boundary, job manager, and selected solver adapter.
- Implement deterministic straight-wire, single-voltage-source, free-space, single-frequency NEC generation.
- Parse impedance, current, and a coarse far-field grid from raw output.
- Show a minimal geometry view and clearly labelled numerical tables before elaborate plots.
- Expose generated deck, raw output, diagnostics, solver identity/hash, application version, and run manifest.
- Add cancellation, timeout, output-size limits, temporary-directory cleanup, and crash recovery.
- Establish content security policy, capability allowlist, dependency locking, SBOM generation, and release checksums.
- Run the free-space dipole reference and one deliberately invalid model through CI and on Windows.

### Exit evidence

- The same committed deck runs through the direct solver harness and UI path with identical parsed values.
- Free-space reference metrics and asymmetric coordinate checks pass their provisional tolerances.
- Solver errors and application warnings are visible and retained.
- A disconnected clean Windows 11 install/run succeeds and ordinary use makes no network requests.
- No result is labelled validated beyond the cases actually covered.

## Phase 2 — Geometry editor and engineering plots

Goal: make the validated vertical slice usable for common straight-wire antenna work.

### Work

- Add straight-wire creation/editing, tags, stable segment identities, junction intent, units, snapping, undo/redo, measurements, and camera controls.
- Add source placement and supported load types incrementally, one validated card family at a time.
- Implement resistance/reactance/SWR charts and user-selectable reference impedance.
- Implement conventional azimuth/elevation cuts with explicit plane labels.
- Implement 3D total-gain radiation pattern with documented radial mapping, scale, clipping, and coordinate compass.
- Implement segment-current magnitude and phase visualization with an inspectable table.
- Add accessibility and keyboard paths for values that should not require 3D manipulation.
- Add geometry and segmentation diagnostics with links to bundled offline explanations.

### Exit evidence

- Symmetric and asymmetric geometry/pattern coordinate tests pass.
- Plot values match structured result tables at sampled points.
- Current samples map to the correct tags/segments and retain phase sign/reference.
- Undo/redo and unit changes do not alter canonical geometry unexpectedly.
- The straight-wire/free-space validation corpus passes in the release build.

Implementation checkpoint (2026-08-05): `feature/current-visualisation` implements a shared experimental segment-current renderer and inspector across the inherited browser/Wasm Simulator, Wire Editor, dipole, vertical, loop/compact-beam, Yagi, and phased-array views. It removes a whole-wire average-flow metaphor and tests real-solver segment selection in five antenna families. Phase 2 remains open: complex currents still need byte-identical external reference/package comparison, near-null phase treatment, accessibility/perception review, and packaged Windows GPU/DPI/manual testing.

## Phase 3 — Ground and frequency sweeps

Goal: support the central HF workflows without concealing ground/model limitations.

### Work

- Add perfect ground and a chosen real-ground formulation with explicit permittivity, conductivity, solver card form, and bundled documentation.
- Decide and implement elevated versus ground-contact `GE`/`GN` behavior from reference evidence.
- Add supported radial/second-medium ground options only if the solver and corpus justify them.
- Add single-range linear sweeps with exact requested-frequency manifests, cancellation, progress where possible, and bounded output.
- Add resistance, reactance, impedance magnitude, SWR, gain, and other validated frequency plots.
- Define which pattern/current outputs are calculated at every frequency versus selected frequencies, so cost is not hidden.
- Add segmentation-convergence assistant/report; do not auto-correct the model silently.

### Exit evidence

- Perfect-ground monopole, elevated real-ground dipole, and ground-connected vertical cases pass external comparisons and convergence review.
- Sweep results equal independent single-frequency runs at sampled frequencies within parser/numeric tolerances.
- Ground/pattern domains contain no accidental duplicate or invalid angles.
- Cancelled sweeps do not produce a successful complete result or stale-cache entry.
- Performance limits and defaults are based on recorded Windows measurements.

Implementation checkpoint (2026-08-02): `feature/vertical-antennas` implements three explicitly separated vertical configurations on the inherited browser/Wasm experimental slice. The three 40/20/10-m ideal perfect-ground decks pass an exact-deck comparison with a separately installed 4NEC2 NEC-2D engine, and the UI/solver corpus covers selected explicit-radial counts and heights. Phase 3 is not complete: finite-ground and screen comparisons, radial and feed-junction convergence, frequency-sweep infrastructure, native-runner parity, and packaged Windows performance evidence remain open.

Implementation checkpoint (2026-08-02): `feature/yagi-beam-models` implements a bounded 2-to-8-element directional-array slice with explicit forward/rear metric definitions. Three perfect-ground exact decks pass direct comparison with a separately installed 4NEC2 NEC-2D engine and one NBS/NIST-scaled geometry passes a deliberately broad pattern sanity envelope. Broader Phase 5 is not complete: finite-ground, convergence, tube/material/feed/boom effects, other bands, native parity, and comparison against a package-authored external deck with fully recorded settings remain open.

Implementation checkpoint (2026-08-02): `feature/phased-arrays` implements a bounded two-element vertical laboratory with separate enforced-current calibration and ideal-TL physical-network paths. Three classic perfect-ground decks pass an exact-deck external NEC-2D comparison and interactive cancellation/cache/overlay/phase-sweep contracts are tested. This does not complete Phase 5 or 6: physical feed-network validation, line loss/common mode, finite ground/radials, convergence, package-authored reference cases, native parity, generalized parameter sweeps, and packaged Windows performance remain open.

## Phase 4 — Loss-aware NEC interoperability and native projects

Goal: make designs portable and reproducible without silent data loss.

### Work

- Implement the ordered NEC document parser with source locations, comments, original text, and unsupported-card nodes.
- Publish the exact supported NEC dialect/card matrix.
- Add structured conversion reports and raw-deck mode.
- Add deterministic NEC export and semantic round-trip tests.
- Add `.hfas` project load/save, schema migrations, atomic writes, backups/recovery behavior, and newer-version rejection.
- Store or associate complete run manifests and optional cached results.
- Add a project inspection page listing unsupported cards, solver requirements, external references, and stale results.
- Test malformed, huge, truncated, unusual-exponent, duplicate-tag, multi-control-block, and mixed-line-ending files.

### Exit evidence

- Supported corpus decks round-trip semantically.
- Unsupported constructs remain in raw mode or block structured conversion with an explicit report.
- No test permits source invention, card dropping, clamping, or unit changes without a diagnostic and user-approved transformation.
- Projects reproduce the exact deck and identify cache invalidation after schema/compiler/solver changes.
- File operations pass interrupted-write and path-encoding tests on Windows 11.

Implementation checkpoint (2026-08-05): `feature/wire-editor` completes a browser-local subset of this phase. It retains ordered card records plus browser-decoded source text/line endings, publishes and tests a structured GW/GE-1-0-1/EX0/LD0-1-4-5/TL/GN-1-1-2/FR0 matrix, blocks unsupported solver-significant cards, preserves multiple linear FR blocks, and stores import provenance in native project schema v3. Phase 4 remains open for raw safe execution, legacy encodings, additional cards/dialects, bounded native file I/O, atomic writes/backups, Windows path tests, and solver-semantic comparison of a broader imported corpus.

## Phase 5 — Broader validated model subset and release hardening

Goal: reach a defensible initial public release for HF wire-antenna work.

### Work

- Incrementally validate multiple sources, supported RLC/impedance/conductivity loads, transmission lines, and selected transforms/arcs if accepted.
- Expand validity rules and warning documentation.
- Complete the full reference corpus from 1.8 through 54 MHz.
- Compare the release candidate with at least one established package using recorded settings and an independently reviewed procedure.
- Conduct usability tests for first model, imported NEC diagnosis, ground selection, and interpreting warnings.
- Complete threat model, dependency/license audit, attribution, SBOM, source release, reproducible build notes, installer signing, and checksum publication.
- Test upgrades while offline and recovery from old project schemas.
- Freeze numeric/coordinate terminology in user documentation.

### Exit evidence

- All release-blocking validation cases pass, or each accepted deviation is explained, bounded, and approved.
- No known silent import loss, missing solver warning, coordinate inversion, or cache-provenance defect remains.
- Installer, uninstaller, repair/upgrade, no-admin operation, and offline use pass on the supported Windows matrix.
- Claims in the release notes are mapped to evidence; untested future features remain labelled planned.
- Licensing checklist is complete for every shipped artifact.

## Phase 6 — Parameters, sliders, and parameter sweeps

Implementation checkpoint (2026-08-02): `feature/dipole-height-lab` proves one bounded height parameter on the experimental browser/Wasm slice. Debounce, worker termination, stale-result suppression, cache identity, comparisons, and a five-point automatic animation are implemented and tested. This is evidence for the interaction contract, not completion of Phase 6: generic parameters, native-runner parity, persisted caches, arbitrary sweeps, discontinuity reporting, and workload budgets remain open.

The subsequent `feature/antenna-template-system` checkpoint adds a declarative parameter/units/range/geometry/feed/load/ground/segmentation/validation/preset contract and one shared workbench for eight starting topologies. Frequency-linked starting dimensions and explicit manual override are implemented. It deliberately does not add an expression language, arbitrary dependency graph, persisted parameter sweeps, or optimization; the dimensions are not advertised as resonant. Independent external validation and native-runner parity remain open.

The `feature/yagi-beam-models` checkpoint applies the same immutable-run contract to multiple coupled element dimensions and four saved comparison traces. Geometry changes immediately, solver work is debounced for 450 ms, the active worker is terminated when superseded, stale outputs are withheld, and exact SI models key a bounded cache. It remains a single-page in-memory experiment rather than the generic persisted sweep system required by this phase.

Goal: support rapid exploration through the same validated model compiler and solver API.

### Work

- Define a small deterministic expression language with units, dependency-cycle detection, finite bounds, and stable evaluation.
- Add named dimensions/parameters to canonical geometry rather than UI-only mutations.
- Add sliders with debounce, cancellation of obsolete jobs, result provenance, and visible discretization changes.
- Add one- and multi-parameter sweep jobs, bounded grids, resumption, export, and comparison views.
- Validate selected parameter points by independent ordinary runs and detect changes in topology/tag/segment mapping.

### Exit evidence

- Identical parameter manifests generate byte-identical decks.
- Stale or cancelled slider jobs cannot overwrite the current result.
- Parameter sweep samples agree with ordinary single runs.
- Units, bounds, discontinuities, and segmentation changes are explicit.
- Workload and disk limits prevent accidental unbounded sweeps.

## Phase 7 — Optimization

Goal: add constrained optimization without turning numerical or modelling defects into confident designs.

### Preconditions

- Phases 0–6 pass.
- The objective metrics used by an optimizer are validated.
- Parameter bounds and constraints are deterministic.
- Solver failure, warning severity, non-convergence, and topology changes can invalidate a candidate.
- Reproducible seeds and complete run histories are available.

### Work

- Begin with transparent grid/random/bounded derivative-free methods rather than a large algorithm catalogue.
- Require explicit objective frequency bands, impedance reference, weights, constraints, and manufacturing bounds.
- Treat solver warnings, invalid geometry, and non-finite results as failed candidates.
- Retain best-candidate decks/manifests, convergence traces, random seeds, and independent verification runs.
- Re-run finalists with finer segmentation/pattern resolution and, where appropriate, the alternate accepted solver/comparator.
- Describe optimization as numerical search of the model, not proof of real-world superiority.

### Exit evidence

- Optimizer benchmark functions and antenna cases are reproducible.
- Reported best candidates survive independent rerun and convergence checks.
- Cancellation/resumption and cache identities are correct.
- UI cannot hide an invalid candidate behind an objective score.

## Cross-cutting workstreams

### Validation

The corpus and reports evolve in every phase. New card families cannot enter the supported matrix without independent cases. Golden files must include provenance and may not be generated only from the code under test.

### Licensing and provenance

Every dependency/reused file is inventoried at introduction, not reconstructed just before release. Automated dependency scans support but do not replace source/license review.

### Documentation and modelling limitations

Offline help is part of each feature. It states the solver formulation, supported card subset, coordinate and units conventions, warnings, reference impedance, ground parameters, and known validity limitations.

### Performance

Performance tests measure rather than assume geometry size, output grid, sweep length, startup overhead, parsing, rendering, disk use, and cancellation latency on representative Windows hardware.

### Accessibility and internationalization readiness

The first release can be English-only, but strings and number/unit formatting should not be embedded in numerical logic. Charts require inspectable data tables and non-color-only distinction.

## Issue and pull-request gates

Each calculation-affecting change should state:

- which canonical contract/card/result field changes;
- applicable NEC manual or solver source reference;
- new unit, contract, integration, and validation tests;
- golden data provenance;
- effects on project migrations and cache identity;
- licensing/provenance of copied or generated material;
- whether user-facing accuracy claims need revision.

UI-only result changes still require coordinate/value tests if they alter labels, interpolation, scales, cuts, or colors that communicate calculated values.

## Definition of done for a supported modelling feature

A feature is “supported” only when:

1. its canonical representation and unit semantics are documented;
2. its NEC generation/import/export behavior is deterministic and tested;
3. the exact selected solver build accepts it;
4. successful, edge, and invalid cases preserve solver/application diagnostics;
5. parsed results have traceable field definitions;
6. at least one independent reference/comparator case passes reviewed tolerances;
7. the Windows release build exercises it end to end;
8. offline user documentation explains limitations;
9. licenses and attribution are complete;
10. release claims state only the tested subset.

## Deferred ideas that are not commitments

- macOS/Linux packaging;
- a browser-only Wasm edition;
- a localhost API for third-party tools;
- cloud collaboration;
- NEC-4 or proprietary solver integration;
- arbitrary surface/volume meshing;
- automatic antenna construction drawings;
- machine-learning optimization.

They may be evaluated later, but the current architecture and roadmap do not claim them.
