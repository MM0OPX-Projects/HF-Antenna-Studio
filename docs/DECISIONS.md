# HF Antenna Studio — Architecture Decision Record

Status: planning decisions
Decision review date: 2026-08-02

## Decision summary

| ID | Decision | Status |
|---|---|---|
| D-001 | Start a new repository; selectively reuse audited AntennaSim components with GPL provenance | Accepted |
| D-002 | License the combined application GPL-3.0-or-later before accepting code | Accepted, release checklist pending |
| D-003 | Use a Tauri 2 Windows desktop shell with bundled React/TypeScript UI | Accepted, offline WebView2 mode conditional on Phase 0 |
| D-004 | Use direct typed desktop IPC and an out-of-process native solver; no localhost service in v1 | Accepted |
| D-005 | Bake off native `nec2c` against native NEC2++; do not name a product solver before validation | Accepted gate; solver undecided |
| D-006 | Defer a Wasm solver to a post-native-validation adapter | Accepted |
| D-007 | Maintain one versioned project/deck/result contract and one model-to-NEC compiler | Accepted |
| D-008 | Preserve raw NEC documents and prohibit silent import conversion | Accepted |
| D-009 | Use NEC coordinates internally and tested explicit UI transforms | Accepted |
| D-010 | Gate supported-feature and accuracy claims on independent validation | Accepted |
| D-011 | Make v1 offline and private by construction, with no ordinary-use network feature | Accepted |
| D-012 | Start with human-readable `.hfas` JSON and optional separately keyed result cache | Accepted |
| D-013 | Defer parameters/optimization until the ordinary run path and metrics are validated | Accepted |
| D-014 | Preserve a runnable AntennaSim baseline branch without selecting its Wasm architecture for the product | Accepted, baseline-only |
| D-015 | Prove the first dipole slice with an exact displayed-deck boundary on the inherited branch | Accepted, experimental |
| D-016 | Supersede interactive solver jobs by terminating the worker and key every result/cache entry to the exact SI model | Accepted, experimental |
| D-017 | Define parametric antennas in one declarative registry that emits the shared SI model; do not create per-template calculation screens | Accepted, experimental |
| D-018 | Keep perfect-ground contact, elevated explicit radials, and NEC radial-screen approximations as distinct vertical configurations | Accepted, experimental |
| D-019 | Give directional models an explicit forward-axis and separate front/back from front/rear | Accepted, experimental |
| D-020 | Use explicit source bridges for polygon and folded-wire feeds | Accepted, experimental |
| D-021 | Treat initial hexbeam support as a disclosed single-band broadband-style topology | Accepted, experimental |
| D-022 | Keep enforced ideal currents and physical TL feed networks as distinct phased-array modes | Accepted, experimental |

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

Use React/TypeScript/Vite for the bundled HTML interface and a minimal Rust/Tauri 2 host for trusted Windows process/file functions.

### Consequences

- Meets the HTML/JavaScript UI requirement while enabling native offline solver execution and local file dialogs.
- Avoids requiring Docker, Python, Redis, or a user-managed web service.
- Introduces Rust, Tauri, WebView2, code-signing, and native installer expertise.
- Offline WebView2 delivery and package size are Phase 0 measurements, not assumptions.

### Rejected alternatives

- Electron bundles a larger Chromium/Node runtime and exposes a broader default native surface; it remains a fallback if WebView2/Tauri tests fail.
- A normal browser cannot reliably own the native process/file boundary without a service or Wasm solver.
- Docker/FastAPI adds deployment/support machinery unnecessary for a local single-user desktop.

## D-004 — Direct IPC to an isolated solver process

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

### Decision

Use native `nec2c` as the Phase 0 baseline because it matches the simple NEC deck/CLI boundary demonstrated by AntennaSim. Test native NEC2++ as an equal challenger because it has current Windows CI, CMake/library support, and a broader regression infrastructure.

The solver field remains **undecided** until both are evaluated as exact Windows binaries. If only one passes all mandatory criteria, select it. If both pass, prioritize diagnostic quality, supported cards, maintainability, output stability, performance, and package footprint. If neither passes, evaluate another open-source NEC implementation through the same adapter.

### Consequences

- Architecture and UI work cannot assume implementation-specific output beyond the adapter contract.
- Phase 0 may end in a different solver than the initial baseline.
- Shipping is delayed rather than allowing a familiar but unvalidated solver to become irreversible.

## D-006 — Defer WebAssembly

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

## D-013 — Optimization follows validation

### Decision

Deliver deterministic parameters/sliders/sweeps only after normal calculations and cache/cancellation are proven. Deliver optimization only after objectives, constraints, warnings, and convergence can invalidate candidates correctly.

### Consequences

- Optimization cannot be used as a marketing shortcut in the first release.
- The validated immutable run API remains the only route to a candidate result.
- Final candidates require finer/alternate verification rather than accepting the best objective value.

## D-014 — Runnable inherited baseline without product-architecture selection

### Decision

Preserve the audited AntennaSim 1.4.2 source and pinned NEC2C submodule on `feature/application-baseline`, make its browser-Wasm route reproducible on Windows 11, and use it as regression evidence during redevelopment. This is a reference snapshot, not a decision to retain AntennaSim's repository structure, duplicated backend/browser pipelines, or Wasm as HF Antenna Studio's product solver.

### Consequences

- Existing behavior can be observed and regression-tested before components are selectively ported.
- D-001, D-005, and D-006 remain in force: the target repository structure is new, the native solver bake-off is undecided, and Wasm must later pass parity against the accepted oracle.
- Baseline ranges prevent accidental behavior changes but cannot be promoted to independent validation evidence.
- GPL provenance remains explicit because the imported source and history are not represented as clean-room work.

## D-015 — Exact-deck verified dipole slice

### Decision

Implement the first centre-fed dipole vertical slice on the inherited baseline branch using a solver-independent SI schema, a dedicated NEC adapter, and an exact-deck worker message. The NEC text displayed to the user must be the same string written to the solver input file. Validate it against a published external NEC-2 case, while classifying application-generated ground cases only as regression evidence.

### Consequences

- The slice can test domain/compiler/parser/UI boundaries before repository migration.
- The generic AntennaSim deck builder is not used for this model, preventing displayed/solved deck drift.
- This decision supplies evidence for D-007 but does not reverse D-001, D-005, or D-006.
- Wasm remains an experimental adapter until it has byte-deck parity with the selected native solver and the full independent corpus.
- A 4NEC2 or equivalent established-package ground comparison remains release-blocking.

## D-016 — Model-keyed interactive calculations

### Decision

For the dipole height laboratory, geometry changes are synchronous UI state while solver work is debounced by 450 ms. A new request aborts the old request; because the current nec2c Wasm call blocks its worker, cancellation terminates and recreates that worker rather than sending a message it cannot process. Results and the bounded in-memory cache are keyed by the complete solver-independent SI model. A result is displayable only when its key equals the current model key.

### Consequences

- Geometry remains responsive during pointer movement and the solver does not run for every movement event.
- An old 2D/3D current trace is removed as soon as controls change; explicitly saved comparisons remain visible as labelled historical traces.
- Cancellation rejects every request sharing the single worker, which is acceptable for this single-model experimental page but not yet a general multi-job scheduler.
- The cache is process-memory only, limited to 40 exact models, and does not weaken D-009's future solver/compiler provenance requirements.
- The native product runner must implement equivalent process-tree cancellation and immutable run identity; this decision does not reverse D-004 or D-006.

## D-017 — Declarative antenna templates emit one shared SI model

### Decision

Represent antenna templates as data-plus-pure-generators in one registry. Each definition owns parameter metadata, starting dimensions, geometry, feed, loads, ground semantics, segmentation recommendation, validation, sliders, and band presets. Every definition emits the same solver-independent SI model and uses the same workbench, segmenter, NEC adapter, solver service, and result UI. Generated dimensions are explicitly starting points and manual dimensional override is preserved.

### Consequences

- New templates are added as reviewed definitions and tests, not independently hard-coded screens or solver routes.
- Display units cannot leak into geometry or NEC generation.
- Cross-parameter invalid geometry blocks execution rather than being silently clamped.
- The common schema supports loads even though the initial eight definitions intentionally emit none.
- A shared segment policy improves consistency but does not replace topology-specific convergence evidence.
- The experimental Wasm implementation supplies contract evidence only; D-003 through D-006 still control the proposed Windows product runtime.

## D-018 — Distinct vertical ground and radial representations

### Decision

Represent three vertical configurations explicitly and never convert between them silently: a ground-contact radiator over infinite perfect ground (`GE 1`, `GN 1`), elevated radial wires over perfect or Sommerfeld/Norton ground (`GE -1`, `GN 1`/`GN 2`), and NEC's reflection-coefficient radial-screen approximation (`GE 1`, `GN 0`, `RP 4`). The screen parameters describe an approximate ground screen, not explicit current-carrying radial geometry. Sommerfeld/Norton is not offered for that approximation because the reviewed NEC-2 engines reject the combination.

### Consequences

- Results and exact decks identify the active representation; perfect ground, finite ground, explicit wires, and the screen approximation are not described as physically identical.
- Real-ground explicit wires must remain above ground in this workflow; touching, buried, or lossy radial-wire models require a separately validated formulation.
- Screen mode cannot display radial-wire currents because no radial `GW` geometry exists.
- Configuration changes regenerate and revalidate one immutable SI model before the solver runs.
- The 40/20/10-m perfect-ground comparison is supporting evidence only. Finite-ground, screen, convergence, and packaged-native validation remain mandatory under D-005, D-006, and D-010.

## D-019 — Directional arrays have an explicit forward-axis contract

**Decision:** A directional antenna model defines its intended forward axis in domain coordinates. Metrics must not infer “front” by calling the unconstrained global maximum forward.

**Rationale:** Arbitrary Yagi dimensions can reverse the main response or create stronger sidelobes. Silently relabelling that maximum as front conceals a model/design failure and makes front-to-back ambiguous.

**Consequences:**

- The Yagi model places the reflector at negative Y, directors at positive Y, and fixes intended forward at `+Y` / NEC `phi = 90 degrees`.
- Forward gain is the best forward-hemisphere sample; axial rear and maximum-rear-hemisphere gain are retained separately.
- Front-to-back and front-to-rear are separate named results, with exact definitions in documentation and tests.
- Saved comparisons preserve the complete solved model and result definitions; a newer slider state cannot relabel or inherit an older pattern.
- `GW` output must remain within the classic 80-column portability bound demonstrated by the independent NEC-2D comparator.
- This decision does not validate arbitrary Yagi designs, select an optimizer, or reverse D-005, D-006, or D-010.

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

## Second, adversarial architecture review

The following review intentionally argues against the preferred architecture. “Resolution” means either a concrete architecture change/gate or a documented reason to retain the risk; it does not mean the issue has already passed testing.

| Issue raised against the preferred design | Assessment | Resolution or documented disposition |
|---|---|---|
| **The preferred solver is fiction until a Windows binary runs.** KJ7LNW/nec2c has weak Windows evidence, so basing the system on it could strand the project. | Valid. The first draft language could have been read as a final selection. | Solver selection is now explicitly undecided. Native nec2c is only the baseline; NEC2++ is an equal challenger; Phase 0 can reject both. The UI depends only on the adapter contract. |
| **Tauri does not guarantee offline use.** WebView2 may download at install/run time, defeating a core promise. | Valid. Windows 11 often includes WebView2, but presence/update cannot be assumed. | Phase 0 compares Tauri's embedded offline installer and fixed runtime in a disconnected clean VM. No release uses the download bootstrapper as its only path. Electron remains a fallback if this gate fails. |
| **A new repository throws away years of UI work and contributor history.** | Valid cost, but not decisive. | Keep the new repository because the calculation/storage/deployment contracts differ. Create an explicit reuse inventory and preserve file history/notices for selected ports. Reassess effort after the vertical slice. |
| **GPL-3.0-or-later may deter contributors and integrations.** A permissive UI with a separate solver could have broader reach. | Valid tradeoff. | GPL is retained because planned AntennaSim reuse is GPLv3+ and solver provenance is conservative. A permissive clean-room alternative would require no GPL reuse, a resolved solver-distribution theory, contributor agreement, and a new decision. |
| **A native executable is inelegant and hostile to browser portability.** | True for portability; less important than initial correctness/isolation. | Retain native process for Windows v1. Keep a byte-deck adapter so Wasm can be added after native parity. Browser portability is not a first-release goal. |
| **Text output parsing is brittle and can silently shift across solver versions.** | Valid and high consequence. | Pin exact binaries/locale, retain raw text, version parsers, fail on unknown/truncated sections, and run output fixtures from all shipped versions. Evaluate a structured NEC2++ wrapper only as an out-of-process adapter with equivalent raw evidence. |
| **A child process is not a strong sandbox.** A malicious or pathological deck may exploit the solver. | Valid. Process isolation protects the host from ordinary crashes but not every local exploit. | Treat inputs as untrusted, enforce size/card/resource limits, prohibit external-resource/file-chaining cards in executable raw mode, use a unique directory and minimal environment, and monitor solver advisories. A restricted-token/job-object spike is added to Phase 0/security work. |
| **No local HTTP service means no easy CLI, automation, or alternative UI.** | True but outside first-release needs. | Prefer smaller direct IPC now. Design the solver-run manifest and runner crate so a future local CLI can reuse them without opening a port. A service requires a new threat decision. |
| **React + Rust creates cross-language schema drift, just like AntennaSim's Python + TypeScript split.** | Valid if both sides reproduce model semantics. | Electromagnetic schema/compiler/parser live once in shared TypeScript packages; generated/runtime schemas cross IPC. Rust validates generic bounds, hashes, files, and process requests, not a second antenna model. Contract tests prevent drift. |
| **Trusting a JavaScript deck compiler permits UI bugs to reach a native solver.** | Valid, though the bundled UI is trusted product code. | The host verifies schema/request limits and deck hash; the compiler is deterministic and test-gated; users can inspect exact decks. Native safe-card/resource policy remains authoritative. Moving compiler semantics into Rust is rejected unless evidence shows a security benefit worth duplication. |
| **4NEC2 is not an independent physical oracle if it uses a related NEC engine.** | Valid. A single established package can reproduce a shared flaw or different defaults. | Use 4NEC2 because the requirement asks for established-package comparison, but never alone. Combine original NEC examples/historical outputs, another implementation, analytic bounds, and convergence; record the 4NEC2 engine/settings. |
| **Pattern validation can pass numeric samples while the 3D rendering is still misleading.** | Valid. | Test raw-to-Cartesian mapping, asymmetric direction, seams, cut planes, radial formula, plot/table points, labels, and screenshots/geometry independently. Default radial mapping is documented rather than linear dB decoration. |
| **The project promises real ground without knowing which formulation/data files are shipped.** | Valid. | Narrow the first ground subset after solver selection. Require explicit GN/GE card form and ground-reference cases. Do not label ground “supported” until contact/elevated cases pass. |
| **Offline/no-update defaults can leave solver/runtime vulnerabilities unpatched.** | Valid residual risk. | Publish signed releases/checksums/advisories and provide a user-initiated manual update path. Any future updater is separately designed and cannot be required for modelling. |
| **Human-readable JSON will be enormous for currents and 3D sweeps.** | Valid for result caches, not canonical models. | Keep `.hfas` model/run references readable; results are optional and content-addressed. Select a versioned binary/container format only after measurements. |
| **Process startup will make sliders and optimizers unusable.** | Unmeasured. | Benchmark startup in Phase 0/6. Use debounce, cancellation, content cache, and bounded batches first. Consider a persistent isolated worker only after state-reset and parity validation. Do not weaken v1 isolation for an unimplemented feature. |
| **The architecture is too elaborate for an open-source first release.** | Valid delivery risk. | Phase 1 is intentionally one wire, one source, free space, one frequency, raw evidence, and minimal views. Advanced schema nodes, cache containers, plugins, Wasm, and optimization remain deferred. Trust boundaries are kept because retrofitting them later is riskier. |
| **Native/project privacy claims can be broken by logs, temp files, or remote UI assets.** | Valid. | Bundle assets, no telemetry/network, document locations, minimize/redact logs, isolate/clean jobs, and use instrumented network/temp-file acceptance tests. Privacy is a tested release attribute. |
| **The project name itself may be unavailable.** | Valid and untested. | Add a Phase 0 trademark/package/domain search. Rename before public branding if the result is adverse. |

### Changes made because of the adversarial review

The preferred architecture was retained, but the review tightened it in six material ways:

1. Solver choice is explicitly undecided rather than “nec2c selected”.
2. Electron is documented as a packaging fallback if offline WebView2 delivery fails.
3. Raw NEC preservation is separated from permission to execute unsafe/unsupported cards.
4. The host/TypeScript responsibility boundary avoids a second electromagnetic model while retaining native security limits.
5. Reference validation uses several evidence classes; 4NEC2 is not treated as the sole oracle.
6. The initial vertical slice is deliberately narrower, and performance-driven persistent/Wasm/container work is deferred.

## Cross-document consistency review

The planning set uses the following single positions:

| Topic | Consistent position |
|---|---|
| Repository | New repository, selective attributed AntennaSim reuse |
| Application license | GPL-3.0-or-later applied; exact dependency/release review still required |
| Initial platform | Windows 11 x64 desktop with bundled HTML/TypeScript UI |
| Runtime boundary | Tauri IPC to isolated native child process; no localhost server |
| Solver | Native nec2c baseline and NEC2++ challenger; final choice pending Phase 0 |
| Wasm | Experimental dipole slice works; product selection/parity validation remains deferred |
| Offline/privacy | No ordinary-use network feature; disconnected installer/run test required |
| Import | Loss-aware raw document plus explicit structured subset; no silent mutation |
| Coordinates | NEC theta/phi internal; labelled/tested UI transformations |
| Feature status | Experimental verified-dipole, height-lab, shared-template, vertical, Yagi, loop/quad/hex, and phased-array slices are implemented on inherited branches; the target desktop architecture remains proposed |
| Optimization | Deferred until validated ordinary run and parameter infrastructure |

Any future change to these positions requires an ADR update plus review of architecture, solver evaluation, roadmap, validation, risks, licensing, and product claims.
