# HF Antenna Studio — Architecture Decision Record

Status: current through the v1.0.0 release candidate; superseded planning decisions are retained explicitly
Decision review date: 2026-08-23

## Decision summary

| ID | Decision | Status |
|---|---|---|
| D-001 | Start a new repository; selectively reuse audited AntennaSim components with GPL provenance | Accepted |
| D-002 | License the combined application GPL-3.0-or-later before accepting code | Accepted, release checklist pending |
| D-003 | Use a Tauri 2 Windows desktop shell with bundled React/TypeScript UI | Accepted for v1; fully disconnected installation remains unclaimed |
| D-004 | Use direct typed desktop IPC and an out-of-process native solver; no localhost service in v1 | Superseded for v1 by D-031; retained as a future native option |
| D-005 | Bake off native `nec2c` against native NEC2++; do not name a product solver before validation | Superseded for v1 by D-031; retained as a future architecture study |
| D-006 | Defer a Wasm solver to a post-native-validation adapter | Superseded for v1 by D-031 |
| D-007 | Maintain one versioned project/deck/result contract and one model-to-NEC compiler | Accepted |
| D-008 | Preserve raw NEC documents and prohibit silent import conversion | Accepted |
| D-009 | Use NEC coordinates internally and tested explicit UI transforms | Accepted |
| D-010 | Gate supported-feature and accuracy claims on independent validation | Accepted |
| D-011 | Make v1 offline and private by construction, with no ordinary-use network feature | Accepted |
| D-012 | Start with human-readable `.hfas` JSON and optional separately keyed result cache | Accepted |
| D-013 | Defer supported optimisation until objectives, constraints, convergence, and ordinary runs are validated | Accepted; experimental prototype allowed only under D-026 |
| D-014 | Preserve a runnable AntennaSim baseline branch without selecting its Wasm architecture for the product | Accepted, baseline-only |
| D-015 | Prove the first dipole slice with an exact displayed-deck boundary on the inherited branch | Accepted, experimental |
| D-016 | Supersede interactive solver jobs by terminating the worker and key every result/cache entry to the exact SI model | Accepted, experimental |
| D-017 | Define parametric antennas in one declarative registry that emits the shared SI model; do not create per-template calculation screens | Accepted, experimental |
| D-018 | Keep perfect-ground contact, elevated explicit radials, and NEC radial-screen approximations as distinct vertical configurations | Accepted, experimental |
| D-019 | Give directional models an explicit forward-axis and separate front/back from front/rear | Accepted, experimental |
| D-020 | Use explicit source bridges for polygon and folded-wire feeds | Accepted, experimental |
| D-021 | Treat initial hexbeam support as a disclosed single-band broadband-style topology | Accepted, experimental |
| D-022 | Keep enforced ideal currents and physical TL feed networks as distinct phased-array modes | Accepted, experimental |
| D-023 | Bind current views to parsed segment results and label every visual normalization | Accepted, experimental |
| D-024 | Gate cross-model overlays on complete solved-condition and model identities | Accepted, experimental |
| D-025 | Permit only bounded, exact-model parameter grids before optimisation | Accepted, experimental |
| D-026 | Keep the first optimiser deterministic, bounded, local, evidence-rich, and explicitly non-global | Accepted, experimental only |
| D-027 | Preserve analyser measurements as immutable evidence and interpolate simulation only | Accepted, experimental |
| D-028 | Use an original four-region engineering workbench and preserve complete warnings/units/result currency | Accepted, experimental |
| D-029 | Store validation as immutable exact-deck evidence with explicit discrepancy classifications | Accepted |
| D-030 | Package the current verified Wasm application in a minimal Tauri/NSIS Windows shell | Accepted and promoted by D-031 |
| D-031 | Select pinned nec2c/WebAssembly in Tauri as the validation-bounded v1 runtime | Accepted for v1.0.0 |

## D-001 — New repository with selective AntennaSim reuse

### Context

AntennaSim provides a capable React editor and result UI, a Python/Docker native path, and a browser-Wasm path. HF Antenna Studio needs a Windows desktop host, a single compiler/parser contract, loss-aware NEC interoperability, raw provenance, and validation-first delivery.

### Decision

Create a new repository rather than fork the whole AntennaSim tree. Build contracts and validation evidence first. Port useful frontend components or algorithms only after review, retaining source commit/path, notices, and GPL terms.

### Consequences

- Positive: clean product identity, dependency set, security boundary, schema, and history of accuracy decisions.
- Positive: obsolete server/container code is not part of the initial attack or maintenance surface.
- Negative: editor features take longer to re-establish and selected history needs deliberate preservation.
- Mitigation: inventory reusable components early and port them with tests instead of reimplementing every interaction.

### Rejected alternative

A direct fork would maximize immediate visible functionality, but would also make duplicated compilers/parsers, lossy import, deployment assumptions, and unvalidated result semantics the default architecture. The necessary restructuring is foundational enough that a fork would be a misleading signal of compatibility.

## D-002 — GPL-3.0-or-later project license

### Decision

Adopt GPL-3.0-or-later for the combined application distribution. Retain the canonical root license and contribution policy included with the imported baseline, and keep package metadata consistent. Treat `nec2c` under conservative GPL obligations until provenance is resolved.

### Consequences

- AntennaSim GPL-3.0-or-later reuse is straightforward with attribution/source compliance.
- NEC2++ GPL-2.0-or-later can be used under the GPLv3 option in the combined distribution, subject to exact component review.
- Some organizations that require permissive licensing may not adopt or contribute.
- A subprocess boundary is not treated as permission to ignore combined-bundle obligations.

### Rejected alternative

A permissive UI repository plus separately downloaded solver could broaden reuse, but it conflicts with intended AntennaSim code reuse, weakens offline installation, and depends on unresolved legal characterization of the combined work. It can be reconsidered only with a clean provenance plan and qualified advice.

## D-003 — Tauri 2 desktop shell

### Decision

Use React/TypeScript/Vite for the bundled HTML interface and a minimal Rust/Tauri 2 host for the small set of trusted Windows integration functions.

### Consequences

- Meets the HTML/JavaScript UI requirement while packaging local Wasm solver execution and bounded native diagnostics.
- Avoids requiring Docker, Python, Redis, or a user-managed web service.
- Introduces Rust, Tauri, WebView2, code-signing, and native installer expertise.
- The v1 bootstrapper/check package is tested offline after installation. A fully disconnected-install WebView2 bundle remains a separate unclaimed variant.

### Rejected alternatives

- Electron bundles a larger Chromium/Node runtime and exposes a broader default native surface; it remains a fallback if WebView2/Tauri tests fail.
- A normal browser cannot reliably own the native process/file boundary without a service or Wasm solver.
- Docker/FastAPI adds deployment/support machinery unnecessary for a local single-user desktop.

## D-004 — Direct IPC to an isolated solver process

Historical planning decision. D-031 supersedes the solver-process portion for v1.0.0. The no-localhost-service boundary remains accepted, and this process design remains the preferred shape if a future native solver passes the release corpus.

### Decision

The webview calls a narrow typed host command. The host invokes a bundled solver executable with an argument array, `shell=false`, unique temporary directory, timeout, cancellation, output limits, and complete evidence capture. The initial app does not listen on a TCP port.

Imported raw NEC cards may be preserved without being executable. Before a raw deck runs, the adapter applies a documented safe-card/dialect policy and blocks file-chaining or other unsupported external-resource behavior. Preservation is not authorization to execute arbitrary solver input.

### Consequences

- Native crashes and global solver state are separated from the desktop host.
- Exact input/output remains inspectable and comparable with other NEC tools.
- Text parsing and process startup remain costs.
- Safe Windows process-tree cancellation and endpoint-security behavior require explicit tests.

### Rejected alternatives

- An in-process library makes reliable cancellation and crash containment harder.
- A localhost HTTP service adds authentication/origin/firewall/port/lifecycle risks with no initial multi-client requirement.

## D-005 — Conditional native solver selection

Historical planning decision. D-031 supersedes it as a v1 release condition; the bake-off remains a post-v1 challenger study.

### Decision

Use native `nec2c` as the Phase 0 baseline because it matches the simple NEC deck/CLI boundary demonstrated by AntennaSim. Test native NEC2++ as an equal challenger because it has current Windows CI, CMake/library support, and a broader regression infrastructure.

The solver field remains **undecided** until both are evaluated as exact Windows binaries. If only one passes all mandatory criteria, select it. If both pass, prioritize diagnostic quality, supported cards, maintainability, output stability, performance, and package footprint. If neither passes, evaluate another open-source NEC implementation through the same adapter.

### Consequences

- Architecture and UI work cannot assume implementation-specific output beyond the adapter contract.
- Phase 0 may end in a different solver than the initial baseline.
- Shipping is delayed rather than allowing a familiar but unvalidated solver to become irreversible.

## D-006 — Defer WebAssembly

Historical planning decision. D-031 reverses this sequencing for v1 based on the later application, corpus, cancellation, and installed-package evidence.

### Decision

Do not make Wasm the initial solver. A future Wasm adapter must pass the same exact-deck corpus, warning capture, cancellation, resource, and packaged-offline tests against the accepted native baseline.

### Evidence

AntennaSim's deployed KJ7LNW/nec2c Wasm flow first completed a simple smoke run. The descendant verified-dipole branch now also matches one published free-space NEC-2 case, but that still does not establish parity with the future native solver or validate ground/general models. The audited NEC2++ `nec_wasm.cpp` path is explicitly incomplete and its CI tests artifact creation rather than simulation.

### Consequences

- The first release is Windows desktop rather than browser-portable.
- Native accuracy evidence becomes a reference for later Wasm work.
- The project avoids maintaining an Emscripten patch set before it has a validated reason.

## D-007 — One canonical contract and compiler

### Decision

Define versioned project, NEC-document, run-manifest, raw-run, and parsed-result contracts. Implement one model-to-NEC compiler library. Use runtime schemas at file, worker, and IPC boundaries. Rust validates boundary/security limits without reimplementing electromagnetic model semantics.

### Consequences

- Browser/backend drift is prevented structurally.
- Schema migrations and cache invalidation become explicit work.
- Type/code generation and cross-language contract tests are necessary.
- The UI may be trusted application code, but the native host still treats decks/files as bounded untrusted input.

## D-008 — Loss-aware NEC interoperability

### Decision

Parse an ordered NEC document with comments, original values/text, source locations, and unknown-card nodes before attempting structured conversion. Offer structured mode only for a published subset. Preserve unsupported content in raw mode or block conversion; never silently drop, clamp, or invent data.

### Consequences

- Import takes more work than mapping known card names directly into editor objects.
- Users can understand why a file cannot be graphically edited.
- Exact text preservation and semantic round trip are separate testable properties.
- Raw execution still obeys the safe-card policy in D-004.

Implementation checkpoint (2026-08-05): `feature/wire-editor` introduces the first ordered, loss-aware browser document and structured-conversion gate. Browser-decoded source text and line endings remain downloadable; unsupported solver-significant cards block conversion; supported GW/GE/EX/LD/TL/GN/FR data is not clamped or defaulted silently. This is a bounded implementation of D-008, not completion: the future native host still needs legacy-encoding handling, size limits, raw safe-card execution policy, additional dialects/cards, and Windows file-recovery tests.

## D-009 — NEC coordinates as the canonical convention

### Decision

Use right-handed Cartesian metres, +Z up, theta from +Z, and phi from +X in the XY plane as the internal contract, confirmed against the selected solver. Convert to compass bearing/elevation only at labelled UI boundaries. Store raw angles with results.

### Consequences

- Asymmetric pattern tests are mandatory.
- “Azimuth” and “elevation” plots must declare their fixed plane.
- Negative/duplicated theta ranges are not used merely to make a mesh convenient.
- Existing AntennaSim visual components can be reused only after their mapping is corrected or verified.

## D-010 — Independent validation controls claims

### Decision

No solver, card family, ground mode, derived metric, import transformation, or plot is “supported” or “validated” until its evidence gate passes. The corpus must include historical/published NEC references and at least one established package such as 4NEC2, plus analytic bounds and convergence where appropriate.

### Consequences

- Parser snapshots generated by HF Antenna Studio are regression tests, not correctness proof.
- Feature delivery may be slower and supported subsets narrower.
- Disagreements are documented/investigated rather than hidden by broad tolerances.

## D-011 — Offline and private v1

### Decision

Bundle all ordinary-use assets, help, solver, and the selected WebView2 installation mode. Include no telemetry, remote assets, account, server, or mandatory update check. Projects stay in user-selected files and documented local app/temp paths.

### Consequences

- Release artifacts are larger and security updates are not silently automatic.
- A future opt-in updater needs a new privacy/security decision.
- Air-gapped installation and instrumented zero-network operation are release tests.

## D-012 — Human-readable native project format

### Decision

Use versioned UTF-8 JSON with `.hfas` extension for the canonical model and run references. Keep large results optional or in a content-addressed cache keyed by deck/solver/parser identity. Add a container format only after measured need.

### Consequences

- Projects are inspectable, diffable, and recoverable early in development.
- Dense arrays are inefficient in JSON and must not inflate every project by default.
- Atomic save, schema migration, validation, and cache garbage collection are required.

Implementation note (2026-08-06): browser-local schema v4 now uses `.hfas`, detached-copy migrations, a single-entry atomic local library document, optimistic record revisions, and a separate recovery journal. This is not evidence for future native filesystem atomicity or backup rotation.

## D-013 — Optimization follows validation

### Decision

Deliver deterministic parameters/sliders/sweeps only after normal calculations and cache/cancellation are proven. Deliver optimization only after objectives, constraints, warnings, and convergence can invalidate candidates correctly.

An experimental optimiser may ship only if it is visibly experimental, cannot claim a global optimum, reuses the validated ordinary-run path, retains complete candidate evidence, and does not broaden the validation claim. D-026 governs the v1 workflow.

### Consequences

- Optimization cannot be used as a marketing shortcut in the first release.
- The validated immutable run API remains the only route to a candidate result.
- Final candidates require finer/alternate verification rather than accepting the best objective value.

## D-014 — Runnable inherited baseline without product-architecture selection

### Decision

Preserve the audited AntennaSim 1.4.2 source and pinned NEC2C submodule on `feature/application-baseline`, make its browser-Wasm route reproducible on Windows 11, and use it as regression evidence during redevelopment. This is a reference snapshot, not a decision to retain AntennaSim's repository structure, duplicated backend/browser pipelines, or Wasm as HF Antenna Studio's product solver.

### Consequences

- Existing behavior can be observed and regression-tested before components are selectively ported.
- At that baseline checkpoint, D-001, D-005, and D-006 remained in force. D-031 later superseded their runtime selection for v1 after the Wasm worker passed the bounded corpus and installed/offline package gates.
- Baseline ranges prevent accidental behavior changes but cannot be promoted to independent validation evidence.
- GPL provenance remains explicit because the imported source and history are not represented as clean-room work.

## D-015 — Exact-deck verified dipole slice

### Decision

Implement the first centre-fed dipole vertical slice on the inherited baseline branch using a solver-independent SI schema, a dedicated NEC adapter, and an exact-deck worker message. The NEC text displayed to the user must be the same string written to the solver input file. Validate it against a published external NEC-2 case, while classifying application-generated ground cases only as regression evidence.

### Consequences

- The slice can test domain/compiler/parser/UI boundaries before repository migration.
- The generic AntennaSim deck builder is not used for this model, preventing displayed/solved deck drift.
- This decision supplied evidence for D-007; its provisional solver status is superseded for v1 by D-031.
- The same Wasm adapter later gained exact-deck external comparison and installed/offline Windows evidence.
- The validation campaign completed the required 4NEC2 ground comparison for the exact 0.5λ perfect-ground case.

## D-016 — Model-keyed interactive calculations

### Decision

For the dipole height laboratory, geometry changes are synchronous UI state while solver work is debounced by 450 ms. A new request aborts the old request; because the current nec2c Wasm call blocks its worker, cancellation terminates and recreates that worker rather than sending a message it cannot process. Results and the bounded in-memory cache are keyed by the complete solver-independent SI model. A result is displayable only when its key equals the current model key.

### Consequences

- Geometry remains responsive during pointer movement and the solver does not run for every movement event.
- An old 2D/3D current trace is removed as soon as controls change; explicitly saved comparisons remain visible as labelled historical traces.
- Cancellation rejects every request sharing the single worker, which is acceptable for this single-model experimental page but not yet a general multi-job scheduler.
- The cache is process-memory only, limited to 40 exact models, and does not weaken D-009's future solver/compiler provenance requirements.
- Any future native product runner must implement equivalent process-tree cancellation and immutable run identity. D-031 later selected the tested worker path for v1.

## D-017 — Declarative antenna templates emit one shared SI model

### Decision

Represent antenna templates as data-plus-pure-generators in one registry. Each definition owns parameter metadata, starting dimensions, geometry, feed, loads, ground semantics, segmentation recommendation, validation, sliders, and band presets. Every definition emits the same solver-independent SI model and uses the same workbench, segmenter, NEC adapter, solver service, and result UI. Generated dimensions are explicitly starting points and manual dimensional override is preserved.

### Consequences

- New templates are added as reviewed definitions and tests, not independently hard-coded screens or solver routes.
- Display units cannot leak into geometry or NEC generation.
- Cross-parameter invalid geometry blocks execution rather than being silently clamped.
- The common schema supports loads even though the initial eight definitions intentionally emit none.
- A shared segment policy improves consistency but does not replace topology-specific convergence evidence.
- At this implementation checkpoint the Wasm path supplied contract evidence only. D-031 later selected that path for the bounded v1 Windows runtime.

## D-018 — Distinct vertical ground and radial representations

### Decision

Represent three vertical configurations explicitly and never convert between them silently: a ground-contact radiator over infinite perfect ground (`GE 1`, `GN 1`), elevated radial wires over perfect or Sommerfeld/Norton ground (`GE -1`, `GN 1`/`GN 2`), and NEC's reflection-coefficient radial-screen approximation (`GE 1`, `GN 0`, `RP 4`). The screen parameters describe an approximate ground screen, not explicit current-carrying radial geometry. Sommerfeld/Norton is not offered for that approximation because the reviewed NEC-2 engines reject the combination.

### Consequences

- Results and exact decks identify the active representation; perfect ground, finite ground, explicit wires, and the screen approximation are not described as physically identical.
- Real-ground explicit wires must remain above ground in this workflow; touching, buried, or lossy radial-wire models require a separately validated formulation.
- Screen mode cannot display radial-wire currents because no radial `GW` geometry exists.
- Configuration changes regenerate and revalidate one immutable SI model before the solver runs.
- The 40/20/10-m perfect-ground comparison is supporting evidence only. Finite-ground, screen, and convergence validation remain open under D-010; D-031 superseded the earlier packaged-native condition for v1.

## D-019 — Directional arrays have an explicit forward-axis contract

**Decision:** A directional antenna model defines its intended forward axis in domain coordinates. Metrics must not infer “front” by calling the unconstrained global maximum forward.

**Rationale:** Arbitrary Yagi dimensions can reverse the main response or create stronger sidelobes. Silently relabelling that maximum as front conceals a model/design failure and makes front-to-back ambiguous.

**Consequences:**

- The Yagi model places the reflector at negative Y, directors at positive Y, and fixes intended forward at `+Y` / NEC `phi = 90 degrees`.
- Forward gain is the best forward-hemisphere sample; axial rear and maximum-rear-hemisphere gain are retained separately.
- Front-to-back and front-to-rear are separate named results, with exact definitions in documentation and tests.
- Saved comparisons preserve the complete solved model and result definitions; a newer slider state cannot relabel or inherit an older pattern.
- `GW` output must remain within the classic 80-column portability bound demonstrated by the independent NEC-2D comparator.
- This decision does not validate arbitrary Yagi designs or select an optimiser, and it does not weaken D-010. D-031 later superseded D-005/D-006 for the v1 runtime only.

## D-020 — Feed locations use explicit source bridges

**Decision:** Parametric polygon and folded-wire generators split the selected conductor at the requested feed location and insert one short, collinear, one-segment source bridge. The bridge length is bounded by the parent edge and selected from wavelength and wire-diameter constraints. The sole `EX` card targets that bridge; nearest-segment rounding is not used.

**Consequences:**

- Bottom, lower-corner-region, and side-region feeds have deterministic coordinates and source identity.
- The generated geometry differs slightly from an ideal zero-length gap; bridge-length and adjacent-segment convergence are required.
- Feed-conductor orientation can be derived from the bridge vector, but does not establish radiated polarisation.
- Connectivity, aspect ratio, exact deck identity, output-current mapping, and solver failure are testable without embedding NEC syntax in the antenna schema.
- This decision applies to the dedicated loop/quad/hex workflow; existing generic templates are not retroactively claimed to have this contract.

## D-021 — Initial hexbeam support is a disclosed single-band broadband-style topology

**Decision:** Implement one band at a time as explicit M-style driven and rear-reflector wire paths on a six-arm visual support frame. Use attributed published conductor/tip-spacing facts as starting values, wavelength-scale smaller nominal support radii, and derive the rear projection needed to retain exact requested reflector length. Do not label the model as a faithful named-design reproduction or model stacked multiband coupling.

**Consequences:**

- Users can inspect and change every conductive path dimension, separation, height, and diameter.
- Visual supports never enter the NEC deck, and flexible construction mechanics are outside the model.
- The topology can be cross-engine tested now without implying that its pattern matches a physical G3TXQ/K4KIO antenna.
- Published/source-derived numbers require attribution but no proprietary asset, diagram, model deck, code, or output is copied.
- A package-authored/reference construction and controlled convergence/measurement study are required before stronger hexbeam claims.

## D-022 — Distinct phased-array excitation modes

**Decision:** An ideal relative-current study and a physical transmission-line feed model are separate domain modes. Ideal mode must calibrate the coupled NEC voltage-source ports, solve for the required complex source voltages, and verify the final feed currents. Physical mode must contain one source and explicit `TL` topology; requested ideal currents cannot leak into it as purported physical results.

**Consequences:**

- A simple pair of `EX 0` voltage values is never relabelled as prescribed current.
- Ideal mode has no single feed-impedance result and its calibrated voltages are not a construction prescription.
- Physical mode reports source-junction impedance and solved element currents.
- Ideal lossless non-radiating TL limitations, zero-length handling, topology, terminations, and the short source conductor remain visible in the model and exact deck.
- Calibration and result caches use complete applicable model identities; a final complex-current mismatch blocks display.
- Cross-build broadside/end-fire agreement supports the bounded ideal-current workflow only. Physical coax, finite ground, radials, and convergence remain separate validation gates.

## D-023 — Current views preserve segment-result lineage

**Decision:** Every current visual mode must derive from parsed complex NEC segment-current records. Views may normalise visual size/colour within a solved run, but must label that transformation, retain exact numeric inspection, and must not replace available results with a textbook envelope or whole-wire average.

**Consequences:**

- Magnitude, phase, and combined views share one `SegmentCurrent`-based renderer and exact tag/segment selection.
- The optional animation evaluates each parsed phasor independently as a slowed teaching snapshot; it is not labelled as current flow or RF-time propagation.
- Family result validators retain parsed NEC XYZ positions instead of reconstructing locations from display charts.
- A solver table with one sample yields one sample glyph; the view does not invent conductor endpoints or intermediate currents.
- Normalised geometry cannot be read as absolute current. Inspector values retain their engineering units and excitation dependency.
- Current-specific external comparisons remain a validation gate; correct lineage alone does not establish solver accuracy.

## D-024 — Cross-model overlays require complete compatibility

**Decision:** A comparison result is an immutable solved snapshot whose identity includes family model, frequency, ground formulation/constants, reference impedance, and requested cut planes. A shared overlay accepts only snapshots whose current model and condition identities match exactly. Heterogeneous families reuse their existing model/adapter/result pipelines; the comparison layer may extract labelled common cuts but may not rebuild or tune their electromagnetic models.

**Consequences:**

- Four slots can compare families or parameter states without creating a second NEC compiler.
- The common 10-degree cut subset prevents nominally equal controls from selecting different 2-degree/5-degree grid samples.
- Stale and differently conditioned results remain inspectable but are visibly excluded from overlays.
- Ideal-current phased arrays cannot acquire synthetic single-port R/X/SWR or sweep values.
- HTML evidence records each result’s solved conditions and plots only a compatible group.
- Comparison is a result presentation contract, not additional physical validation of its inputs.

## D-025 — Parameter exploration is a bounded exact-model job, not optimisation

**Decision:** Initial parameter exploration is limited to declared same-family parameters, inclusive 1D lines, and rectangular 2D grids capped at 81 exact models. Every coordinate must regenerate and validate the existing typed family model, pass through its established NEC adapter/service/result validator, and retain the complete model key and generated deck. Jobs are sequential, cancellable, session-cached by exact model, and publish only atomically complete results. No optimiser, adaptive search, or synthetic ideal-array impedance is included.

**Consequences:**

- Eight parameters across dipole, elevated vertical, three-element Yagi, and ideal-current phased-array families can be explored without a second electromagnetic compiler.
- A 192-entry memory cache improves repeated studies but is intentionally not persisted across solver/application versions.
- Two-dimensional computation cannot exceed 9×9 or 81 jobs; these ceilings remain provisional pending packaged Windows measurements.
- Result JSON carries the definition, every point’s parameter map/model key/deck/fingerprint, solver engine, warnings, and metrics.
- FNV deck fingerprints are convenience integrity labels; the full model/deck is authoritative.
- Optimisation remains behind Phase 7 validation, constraint, discontinuity, persistence, and performance gates.

## D-026 — The initial optimiser is a bounded local evidence consumer

**Decision:** The first optimiser uses deterministic bounded coordinate pattern search over one or two declared parameters and at most 121 unique models. It evaluates candidates only through existing typed family generators, validity rules, NEC adapters, solver services, and result validators. Lower-is-better scoring and constraints are explicit. The optimiser retains complete history and up to five feasible best-found models, publishes nothing on cancellation, and fixes the global-optimum claim to false.

**Consequences:**

- Lowest SWR, maximum gain/F-B, target R/X/take-off, and an explicit raw-unit weighted score can exercise the workflow without adopting external optimisation code.
- Invalid, failed, and constraint-rejected candidates cannot become best solutions and remain documented in history.
- Results use “Best solution found”; “perfect antenna” and unqualified optimum language are prohibited.
- Determinism removes a random seed from the initial reproducibility contract but does not establish global convergence.
- The workflow is included experimentally in v1.0.0; independent candidate sampling, convergence/discontinuity handling, tolerance robustness, alternative-solver parity, and broader Windows performance remain mandatory before claiming validated optimisation outcomes.

## D-027 — Measurement is immutable evidence, not solver input

**Decision:** Initially accept only a bounded, explicit one-port Touchstone S-parameter subset. Preserve the complete decoded source and original records. Derive S11/SWR/R/X with visible reference impedance. Never sort, deduplicate, clamp, fit, or resample measurement records silently. Exact alignment is always available; optional linear alignment interpolates simulation R and X onto original measurement frequencies without extrapolation. Withhold SWR differences when reference impedances differ.

**Consequences:**

- NanoVNA `.s1p` exports have a standards-based route; ambiguous CSV dialects remain rejected until producer/version fixtures establish a safe schema.
- Measurement cannot mutate geometry or tune the NEC model automatically.
- Comparison exports carry raw measurement source, simulation results, alignment method, and difference direction.
- A visual match is not a validation certificate; calibration plane, feed line, common mode, environment, construction, ground and NEC limitations remain explicit.
- The parser remains an untrusted-input boundary. Its narrow fail-closed subset is supported in v1.0.0; fuzzing, broader encoding/Touchstone corpora and physical measurement campaigns are required before widening that subset or claiming measured agreement.

## D-028 — The main Simulator uses a four-region engineering workbench

**Decision:** At desktop widths, separate editable model inputs, interactive geometry, calculated key values, and detailed analysis into distinct resizable/collapsible regions. Calculated values are rendered only for the current successful simulation state and repeat their key input conditions. Use one responsive layout state rather than mounting duplicate Three.js viewers. Specialist laboratories keep their task-specific layouts while inheriting the global original visual system.

**Consequences:**

- Inputs cannot be visually mistaken for calculated output, and stale results remain withheld after model/ground changes.
- The centre viewer takes remaining space while bounded side/bottom regions accommodate different Windows screen sizes.
- Resizers and tabs need complete keyboard and accessibility semantics, not pointer-only affordances.
- Panel dimensions are not persisted until application preferences have a versioned schema.
- This is an interface-architecture decision only; it does not change or validate geometry, NEC generation, solver behaviour, parsing, or RF results.
- No commercial application's exact layout, artwork, assets, or branding is adopted.

## D-029 — Validation is immutable exact-deck evidence with explicit discrepancy classifications

**Decision:** A validation case is a versioned manifest entry bound to the exact NEC deck hash, SI geometry, feed and segment identity, frequency, ground formulation, pattern grid, solver/program identity, expected outputs, signed differences, tolerances, classification, and investigation note. The automated campaign fails closed on missing families, changed deck hashes, changed comparator identity, uninvestigated differences, or exceeded tolerances. Allowed classifications are `Bug`, `Numerical tolerance`, `Different solver implementation`, `Different ground model`, `Geometry difference`, and `Unknown`.

**Consequences:**

- Application-generated values remain regression fixtures until compared with an external result, analytic bound, or controlled measurement.
- Same-deck agreement between related NEC-2 builds is useful integration evidence but is not described as independent proof of physical accuracy.
- Failed or non-equivalent comparisons remain visible; code and expected values cannot be tuned without recording the model difference and technical reason.
- Confirmed bugs require correction followed by the complete campaign, while a campaign with no confirmed bug does not authorize calculation changes.
- The manifest is reviewable and reproducible, but raw third-party output or package-authored decks are committed only after provenance and redistribution review.

## D-030 — Minimal Tauri/NSIS package around the verified Wasm path

**Decision:** Build the first Windows 11 distributable as a per-user Tauri 2 NSIS installer containing the production React assets and pinned nec2c/WebAssembly solver. Use the system-serviced Evergreen WebView2 supplied with Windows 11 and embed its small bootstrapper/check in the preferred package. Maintain a separate `offlineInstaller` configuration for an explicitly larger air-gapped-install candidate. Do not add the inherited Python/Docker service or a localhost listener. Limit native IPC to package information, bounded diagnostic logging, and opening the log directory.

**Consequences:**

- Normal users install one application and do not install development tools or a solver.
- The preferred installer is small and ordinary use is offline, but a stripped machine missing WebView2 can need connectivity during installation; only the larger offline variant can make a disconnected-install claim after testing.
- Program files are removed by NSIS while local projects/logs are deliberately preserved; full data deletion remains an explicit user operation.
- Electron remains a fallback if WebView2/Tauri fails representative Windows testing, not a parallel package to maintain now.
- PWA and local-service packaging remain possible distribution modes but do not meet the same controlled installer/diagnostic boundary.
- This checkpoint packages the best-validated current executable path. D-031 selects that path for the bounded v1 release; it does not approve every model or prevent a later native bake-off.
- The unsigned x64 installer can be a public artifact only with a published checksum and explicit unknown-publisher warning. Signing, reputation, ARM64, enterprise policies, and an air-gapped installer remain future platform claims rather than hidden v1 gates.

## D-031 — Pinned nec2c/WebAssembly is the v1 product runtime

**Decision:** For v1.0.0, select the existing pinned KJ7LNW/nec2c v1.3.3 WebAssembly build running in a dedicated Web Worker inside the Tauri/WebView2 package. Ship its exact source, build recipe and identity; bind all public accuracy claims to the immutable validation corpus. Treat the earlier native nec2c/NEC2++ bake-off as a post-v1 architecture investigation, not a condition that contradicts the tested v1 runtime.

**Rationale:** The Wasm path is the only end-to-end implementation exercised by the complete application, cancellation/stale-result regressions, external exact-deck corpus, and installed offline Windows test. Introducing an unimplemented native runner at release would add process, parser, packaging and parity risk without numerical evidence. Solver lineage is NEC-2 and validation remains deliberately narrow.

**Consequences:**

- Tauri IPC is limited to runtime/log functions in v1; solver execution remains local in the worker.
- Normal calculations require no listener, child executable, account or external connection.
- Same-deck NEC-2 comparison cannot establish universal physical accuracy; finite ground, feed networks, convergence and measurements retain explicit limitations.
- Future native or alternative solvers must pass the same canonical request/result contract, deck identity, validation corpus, cancellation, security and Windows package gates before replacement.
- This decision supersedes D-005/D-006 only for the released v1 architecture; it does not declare WebAssembly or nec2c permanently optimal.

## Second, adversarial architecture review

The following review intentionally argues against the preferred architecture. “Resolution” means either a concrete architecture change/gate or a documented reason to retain the risk; it does not mean the issue has already passed testing.

| Issue raised against the preferred design | Assessment | Resolution or documented disposition |
|---|---|---|
| **The preferred solver is fiction until its exact Windows package runs.** Early KJ7LNW/nec2c evidence was too weak to select it. | Valid. The first draft language could have been read as a final selection. | D-031 now selects only the exact pinned Wasm build that passed the application corpus, cancellation/stale-result tests, and installed/offline Windows gate. Native nec2c and NEC2++ remain challengers; the UI still depends on the adapter contract. |
| **Tauri does not guarantee offline use.** WebView2 may download at install/run time, defeating a core promise. | Valid. Windows 11 distributes Evergreen WebView2, but presence/update cannot be assumed on every modified image. | The test package uses an embedded bootstrapper/check and proves offline operation after install; a separate ~127 MB offline-installer configuration remains the disconnected-install candidate. Air-gapped VM evidence is still required. Electron remains a fallback if this gate fails. |
| **A new repository throws away years of UI work and contributor history.** | Valid cost, but not decisive. | Keep the new repository because the calculation/storage/deployment contracts differ. Create an explicit reuse inventory and preserve file history/notices for selected ports. Reassess effort after the vertical slice. |
| **GPL-3.0-or-later may deter contributors and integrations.** A permissive UI with a separate solver could have broader reach. | Valid tradeoff. | GPL is retained because planned AntennaSim reuse is GPLv3+ and solver provenance is conservative. A permissive clean-room alternative would require no GPL reuse, a resolved solver-distribution theory, contributor agreement, and a new decision. |
| **A native executable is inelegant and hostile to browser portability.** | True for portability, but no native solver runner reached end-to-end parity. | D-031 selects the tested Wasm worker for Windows v1. Retain the byte-deck adapter so a future native challenger can be evaluated without changing models. |
| **Text output parsing is brittle and can silently shift across solver versions.** | Valid and high consequence. | Pin exact binaries/locale, retain raw text, version parsers, fail on unknown/truncated sections, and run output fixtures from all shipped versions. Evaluate a structured NEC2++ wrapper only as an out-of-process adapter with equivalent raw evidence. |
| **A future child process would not be a strong sandbox.** A malicious or pathological deck could exploit a native solver. | Valid for the retained native alternative; it is not the v1 execution path. | Any native candidate must treat inputs as untrusted, enforce size/card/resource limits, prohibit external-resource/file-chaining cards, use a unique minimal environment, and pass restricted-token/job-object review before replacing D-031. |
| **No local HTTP service means no easy CLI, automation, or alternative UI.** | True but outside first-release needs. | Keep the v1 worker plus bounded diagnostic IPC. A future CLI can reuse the exact-deck/run-manifest contracts without opening a port; a service requires a new threat decision. |
| **React + Rust creates cross-language schema drift, just like AntennaSim's Python + TypeScript split.** | Valid only if both sides reproduce model semantics. | Electromagnetic schema/compiler/parser live once in TypeScript and remain inside the WebView/worker boundary. Rust exposes runtime/log operations only and does not reproduce the antenna model. |
| **Trusting a TypeScript deck compiler permits UI bugs to reach the solver.** | Valid, though the bundled UI is trusted product code. | The compiler is deterministic and test-gated, unsupported imported cards fail closed, exact decks are inspectable, and the solver worker is limited to same-origin bundled artifacts. Moving model semantics into Rust would duplicate them without protecting against ordinary modelling mistakes. |
| **4NEC2 is not an independent physical oracle if it uses a related NEC engine.** | Valid. A single established package can reproduce a shared flaw or different defaults. | Use 4NEC2 because the requirement asks for established-package comparison, but never alone. Combine original NEC examples/historical outputs, another implementation, analytic bounds, and convergence; record the 4NEC2 engine/settings. |
| **Pattern validation can pass numeric samples while the 3D rendering is still misleading.** | Valid. | Test raw-to-Cartesian mapping, asymmetric direction, seams, cut planes, radial formula, plot/table points, labels, and screenshots/geometry independently. Default radial mapping is documented rather than linear dB decoration. |
| **The project promises real ground beyond the available validation.** | Valid. | The exact GN/GE form and representation are visible, but finite-ground, radial-screen and explicit-radial accuracy remain outside the independent v1 campaign and are stated as limitations. |
| **Offline/no-update defaults can leave solver/runtime vulnerabilities unpatched.** | Valid residual risk. | Publish signed releases/checksums/advisories and provide a user-initiated manual update path. Any future updater is separately designed and cannot be required for modelling. |
| **Human-readable JSON will be enormous for currents and 3D sweeps.** | Valid for result caches, not canonical models. | Keep `.hfas` model/run references readable; results are optional and content-addressed. Select a versioned binary/container format only after measurements. |
| **Solver latency will make sliders and optimisers unusable.** | Valid. | The v1 worker is persistent per service, pointer changes are debounced, stale jobs terminate, caches are bounded, sweeps are capped, and complete browser regressions cover cancellation/responsiveness. Performance across low-end hardware remains a post-v1 measurement. |
| **The architecture is too elaborate for an open-source first release.** | Valid delivery risk. | Keep one TypeScript model/deck/result pipeline, a local worker, and three bounded native commands. Advanced features remain clients of that same boundary and retain explicit evidence limits. |
| **Project privacy claims can be broken by logs, browser storage, or remote UI assets.** | Valid. | Bundle assets, provide no telemetry/normal-use network path, bound diagnostic content, document storage/log locations, and test the installed solver with networking forced offline. Users must still review exported measurement/location data before sharing. |
| **The project name itself may be unavailable.** | Valid and untested. | Add a Phase 0 trademark/package/domain search. Rename before public branding if the result is adverse. |

### Changes made because of the adversarial review

The preferred architecture was retained, but the review tightened it in six material ways:

1. Solver choice is explicitly undecided rather than “nec2c selected”.
2. Electron is documented as a packaging fallback if offline WebView2 delivery fails.
3. Raw NEC preservation is separated from permission to execute unsafe/unsupported cards.
4. The host/TypeScript responsibility boundary avoids a second electromagnetic model while retaining native security limits.
5. Reference validation uses several evidence classes; 4NEC2 is not treated as the sole oracle.
6. The initial vertical slice was deliberately narrow; later work retained a persistent cancellable Wasm worker while keeping alternate runners behind the same contract.

## Cross-document consistency review

The planning set uses the following single positions:

| Topic | Consistent position |
|---|---|
| Repository | New repository, selective attributed AntennaSim reuse |
| Application license | GPL-3.0-or-later applied; exact dependency/release review still required |
| Initial platform | Windows 11 x64 desktop with bundled HTML/TypeScript UI |
| Runtime boundary | v1 product: WebView worker/Wasm plus three diagnostic IPC commands. A post-v1 native option would use isolated Tauri IPC. No localhost server. |
| Solver | v1 product: pinned KJ7LNW nec2c v1.3.3/WebAssembly under D-031 and bounded validation claims. Native nec2c/NEC2++ remain future challengers. |
| Wasm | Selected for v1.0.0 because it is the complete externally compared and installed/offline-tested path; replacement requires full parity evidence |
| Offline/privacy | No ordinary-use network feature; disconnected installer/run test required |
| Import | Loss-aware raw document plus explicit structured subset; no silent mutation |
| Coordinates | NEC theta/phi internal; labelled/tested UI transformations |
| Feature status | The listed workflows ship in v1.0.0 with regression evidence; only the exact models/metrics in the validation report are independently compared. The installed Tauri/NSIS package exercises that same Wasm application offline. |
| Optimization | Experimental bounded workflow included with explicit non-global claims; independent optimisation outcome validation remains future work |

Any future change to these positions requires an ADR update plus review of architecture, solver evaluation, roadmap, validation, risks, licensing, and product claims.
