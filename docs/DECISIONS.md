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

Adopt GPL-3.0-or-later for the combined application distribution. Add the canonical root license and contribution policy before accepting application code. Treat `nec2c` under conservative GPL obligations until provenance is resolved.

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

AntennaSim's deployed KJ7LNW/nec2c Wasm flow completed a simple smoke run. That establishes feasibility, not parity. The audited NEC2++ `nec_wasm.cpp` path is explicitly incomplete and its CI tests artifact creation rather than simulation.

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
| Application license | GPL-3.0-or-later before code; exact dependency review still required |
| Initial platform | Windows 11 x64 desktop with bundled HTML/TypeScript UI |
| Runtime boundary | Tauri IPC to isolated native child process; no localhost server |
| Solver | Native nec2c baseline and NEC2++ challenger; final choice pending Phase 0 |
| Wasm | Deferred optional adapter, not assumed functional/validated |
| Offline/privacy | No ordinary-use network feature; disconnected installer/run test required |
| Import | Loss-aware raw document plus explicit structured subset; no silent mutation |
| Coordinates | NEC theta/phi internal; labelled/tested UI transformations |
| Feature status | Planning only; no HF Antenna Studio feature is claimed implemented |
| Optimization | Deferred until validated ordinary run and parameter infrastructure |

Any future change to these positions requires an ADR update plus review of architecture, solver evaluation, roadmap, validation, risks, licensing, and product claims.
