# HF Antenna Studio — Risk Register

Status: active planning register
Last reviewed: 2026-08-02

## Scale and ownership

- Likelihood: Low (L), Medium (M), High (H).
- Impact: Moderate (M), High (H), Critical (C).
- State: Open, Mitigating, Accepted, or Closed.

“Owner” names the future accountable role rather than a currently staffed person. Residual risk is reassessed after the stated gate; it is not assumed to fall automatically.

## Register

| ID | Risk | Likelihood / impact | Evidence or trigger | Mitigation and gate | Owner | Residual / state |
|---|---|---|---|---|---|---|
| R-001 | The selected solver or integration gives numerically wrong results while producing plausible plots. | M / C | The verified 38 MHz free-space slice matches a published external NEC-2 case, and three ideal perfect-ground vertical decks match a separate 4NEC2 NEC-2D engine. Finite ground, radial approximations, convergence, and general models remain unverified. | Extend the exact-deck external corpus, analytic bounds, convergence studies, and raw evidence. Block selection/release on unexplained deviations. | Validation lead | M / Mitigating |
| R-002 | `nec2c` cannot be built, redistributed, or supported reliably on Windows 11. | M / C | Audited KJ7LNW source has no comparable Windows CI/build evidence; license/provenance signals conflict. | Reproducible Windows build and clean-VM run, source/legal review, documented patches. Keep NEC2++ as challenger and reject `nec2c` if gate fails. | Solver + release leads | M / Open |
| R-003 | NEC2++ behaves differently from expected NEC-2 decks or has insufficient output/diagnostics for the chosen subset. | M / H | It has an active regression suite and Windows CI, but HF Antenna Studio's exact build/path has not been run. | Run byte-identical corpus through out-of-process adapter; compare raw fields/cards; document dialect differences. | Solver lead | L–M / Open |
| R-004 | WebAssembly becomes a schedule distraction or ships with undetected parity problems. | H / H | The verified slice proves one Wasm exact-deck path and published case, but no native parity baseline exists; NEC2++ Wasm remains unsuitable. | Keep Wasm experimental until native validation exists; require exact corpus, warning, cancellation, and performance parity before product selection. | Architect | L–M / Mitigating |
| R-005 | Ground results are materially wrong for contact geometry or selected real-ground formulation. | M / C | Three ideal touching-ground monopoles now have independent same-deck comparator evidence. Elevated finite-ground and radial-screen results still have execution/regression evidence only. | Keep elevated/contact/screen cases separate; add original manual/reference decks, finite-ground comparator records, settings review, and convergence studies; keep formulation visible. | Validation lead | M / Mitigating |
| R-006 | Theta/phi, compass, or cut-plane errors mirror/rotate radiation results. | H / H | The dipole adapter now requests conventional theta 0–180/0–90 grids and labels maximum-containing cuts, but symmetric dipoles cannot expose mirroring. | Canonical coordinate contract, axis unit tests, asymmetric Yagi/phased-array cases, raw grid inspection, explicit plane labels. | Visualization lead | L / Mitigating |
| R-007 | Derived efficiency, gain, beamwidth, front/back, or SWR is based on the wrong quantity/domain. | M / H | AntennaSim integrates pattern-derived efficiency over questionable domains and caps at 100%. | Formula specifications, raw-field lineage, solver power-budget comparison, independent numeric fixtures, no silent capping. | Validation lead | L–M / Open |
| R-008 | NEC import silently drops or changes a valid antenna. | H / C | Audited import paths skip unsupported/malformed cards, clamp values, invent a source, and represent different subsets. | Ordered loss-aware NEC document, raw mode, conversion report, no implicit defaults, semantic solver round trips, dialect matrix. | Interop lead | M / Mitigating |
| R-009 | Project migrations or caches produce stale results under a new solver/compiler/schema. | M / H | AntennaSim project data does not fully capture solver/build/deck provenance. | Versioned schema, immutable run manifest, deck/solver/parser hashes, explicit stale state, migration fixtures, atomic save. | Domain lead | L / Mitigating |
| R-010 | Solver warnings are lost, misparsed, or obscured by application heuristics. | H / H | The worker now captures warning/error lines and the UI displays them; a false stderr usage-banner warning was found and fixed. Coverage is not yet a full diagnostic corpus. | Retain complete raw output/stderr; versioned diagnostic extraction; warning corpus; separate solver and application origins; unknown-warning display. | Solver lead | M / Mitigating |
| R-011 | A malformed project/deck or solver output exhausts memory/disk or crashes the app. | M / H | Text parsers and large grids are untrusted boundaries; solver may emit large files. | Input/output/frequency/segment/grid bounds, finite checks, streaming/bounded parsing, per-job temp dirs, timeout/cancel, fuzz/robustness tests. | Security lead | L–M / Open |
| R-012 | The native child solver is blocked by antivirus or leaves processes/files after cancellation. | M / H | Unmeasured on representative Windows endpoints; unsigned niche executables can be flagged. | Signed/checksummed builds, transparent provenance, no shell, process-tree job object, endpoint-security matrix, cleanup/recovery tooling. | Release lead | M / Open |
| R-013 | Offline installation fails because WebView2 or another dependency tries to download. | M / H | Tauri supports several runtime modes; a bootstrapper is not offline. | Choose embedded offline/fixed runtime by clean air-gapped VM test; bundle all assets/help/solver; block release on network dependency. | Release lead | L / Mitigating |
| R-014 | The application leaks private design metadata through telemetry, remote assets, update checks, logs, or crash services. | L–M / C | Privacy is a core promise; web stacks often pull remote fonts/assets by default. | No telemetry/network in v1, restrictive CSP/capabilities, bundled assets, instrumented network test, log review/redaction, documented local locations. | Security lead | L / Mitigating |
| R-015 | A localhost service creates an avoidable attack/lifecycle/support surface. | M / H | One evaluated approach exposes a local native service; ports introduce origin/auth/firewall concerns. | Use direct Tauri IPC with no listener in v1. Threat-review any future service separately. | Architect | L / Mitigating |
| R-016 | Dependency or solver supply-chain compromise enters an offline installer. | M / C | npm/Cargo/toolchain and solver artifacts are numerous; AntennaSim dependencies are not comprehensively locked. | Lock files, pinned source commits, reviewed minimal patches, reproducible builds, checksums/signing, SBOM, dependency scanning, controlled release provenance. | Release + security leads | M / Open |
| R-017 | GPL or third-party obligations are violated, or `nec2c` provenance remains ambiguous. | M / C | AntennaSim is GPL-3.0-or-later; nec2c README/COPYING/distribution labels conflict; assets/dependencies need inventory. | Adopt GPL-3.0-or-later for combined distribution, preserve notices/source, provenance review, third-party inventory, SBOM, release audit, legal advice for ambiguity. | Licensing lead | M / Open |
| R-018 | Copying inspiration crosses into proprietary code, artwork, documentation, trade dress, or trademarks. | L–M / C | Named established applications are product references; project name has not been searched. | Clean original UI/branding/text; use black-box comparisons only; asset provenance; trademark/name search; review comparator artifacts before distribution. | Product + licensing leads | L / Open |
| R-019 | Starting a new repository discards too much useful AntennaSim work and delays usable software. | M / H | AntennaSim has substantial tested UI/editor functionality. | Create reuse inventory early; selectively port components with history/provenance and contract tests; measure effort after vertical slice. | Architect | M / Accepted/Mitigating |
| R-020 | Reusing AntennaSim code imports hidden semantic debt and duplicated architecture. | H / H | Separate backend/browser compilers/parsers and lossy imports are documented. | New contracts first; port only after review; do not copy Python/Redis/Docker path or duplicated result logic wholesale. | Architect | L–M / Mitigating |
| R-021 | Solver output text changes across builds/locales and breaks parsing. | M / H | Both candidate paths rely on formatted text at some boundary. | Pin builds/locale, version adapter/parser, corpus all output sections, retain raw text, fail explicitly on unknown/truncated structure. Evaluate structured NEC2++ wrapper only behind process isolation. | Solver lead | M / Open |
| R-022 | Large geometry, fine pattern grids, or sweeps freeze the UI or create unbounded output. | H / H | Target includes 3D grids, currents, sweeps, and later optimization; limits are not yet measured. | Immutable bounded queue, workers/native process, conservative measured caps, progress/cancel, output budgets, performance matrix. | Performance lead | M / Open |
| R-023 | Process startup makes interactive sliders and optimization impractically slow. | M / M | Native process isolation incurs startup and repeated deck parsing; no Windows measurement yet. | Benchmark Phase 0/6; debounce/cancel/cache; evaluate persistent isolated worker or batched solver only after safety/parity tests. | Performance lead | M / Open |
| R-024 | Optimizer exploits discretization/numerical artifacts or produces invalid/unbuildable designs. | H / C | Optimization magnifies calculation and constraint defects. | Defer to Phase 7; bounds/constraints, failure penalties, convergence studies, independent final reruns, manufacturing tolerances, full provenance. | Optimization + validation leads | M / Mitigating |
| R-025 | Established-package comparison creates false confidence because it uses the same engine or different settings. | M / H | 4NEC2 can select NEC-family engines; ground and normalization settings may differ. | Record exact engine/settings/deck, use original reference outputs plus analytic/convergence checks and a second implementation when needed; investigate disagreements. | Validation lead | L–M / Mitigating |
| R-026 | Physical antenna results differ significantly from ideal NEC models and users interpret this as software failure or certainty. | H / H | Real soil, feed line, supports, conductors, environment, construction tolerances, and measurement calibration differ. | Prominent validity help, model/build comparison guidance, units/material assumptions, convergence tools, avoid certainty language. Optional measured benchmarks later. | Product + documentation leads | M / Open |
| R-027 | NEC thin-wire validity limits are incomplete, overly rigid, or presented as universal. | M / H | Rules vary with formulation, junctions, segment length/radius, wavelength, and geometry. | Trace every rule to manual/source/evidence; separate hard solver constraints from heuristics; show values and allow expert inspection without silent bypass. | Validation lead | M / Open |
| R-028 | Contributor changes alter numerical semantics without appropriate review. | M / C | UI, deck, parser, and charts can all change results. | CODEOWNERS/review roles, calculation-change checklist, validation CI, golden provenance, numeric diff reports, ADRs for semantics. | Maintainer | L–M / Open |
| R-029 | Upstream solver maintenance or small bus factor leaves security/correctness defects unaddressed. | M / H | KJ7LNW nec2c is small/quiet; NEC2++ is active but concentrated. | Pin source, own reproducible build/patch capacity, adapter abstraction, keep second validated candidate, monitor upstream/license changes. | Solver lead | M / Open |
| R-030 | Native project JSON is human-readable but becomes too large for pattern/current caches. | M / M | Dense 3D/sweep results can be large; JSON duplicates numeric overhead. | Make caches optional/content-addressed, keep model readable, measure before adopting a versioned container/binary array format, atomic writes. | Domain lead | L / Open |
| R-031 | Project/app name conflicts with an existing trademark or creates confusion. | L–M / H | No name clearance has been performed. | Search relevant software/radio trademark and package namespaces before public launch; rename before branding investment if needed. | Product + licensing leads | L / Open |

| R-032 | A fast parameter change displays a radiation pattern calculated for an older geometry. | M / C | The height lab now hides non-matching results, terminates in-flight Wasm workers, and has rapid-change browser and scheduler tests; the future native/multi-job runner does not yet implement this contract. | Make immutable SI model/run identity mandatory for every adapter and cache; test out-of-order completion, cancel races, worker/process death, and persisted-cache provenance on each runner. | Domain + solver leads | L / Mitigating |
| R-033 | Generated template dimensions, a shared segmentation rule, or idealised ground are mistaken for resonance or validated real-installation performance. | H / H | Eight templates now generate convenient frequency-linked starting models; same-engine solver regressions pass, but topology convergence and external comparisons are incomplete. | Label all generated dimensions as starting points; preserve manual override; expose exact deck/segment/feed/ground; require convergence, published/reference, native-parity, and established-package evidence per topology before support claims. | Domain + validation leads | M / Mitigating |
| R-034 | Users or maintainers conflate perfect ground, Sommerfeld/Norton finite ground, explicit radial wires, and NEC's radial-screen approximation, producing invalid decks or misleading physical conclusions. | H / C | A first implementation combined the screen fields with `GN 2`; both reviewed engines rejected it. The corrected feature uses separate typed configurations, labels, cards, validity rules, exact-deck display, and browser tests. Finite-ground and radial convergence remain incomplete. | Preserve D-018's non-convertible representations; test exact card combinations; expose missing radial currents in screen mode; require external finite-ground/screen and radial/feed-junction convergence evidence before release claims. | Domain + validation leads | M / Mitigating |

## Highest-priority pre-implementation risks

The following must be reduced in Phase 0 before broad UI work:

1. R-001 — numerical correctness.
2. R-002/R-003 — viable Windows solver selection.
3. R-005/R-006/R-007 — ground, coordinates, and derived-result meaning.
4. R-013 — truly offline Windows packaging.
5. R-017 — solver and combined-distribution licensing.
6. R-008/R-010 — silent import loss and missing solver diagnostics.

## Risk-review cadence

- Review at every phase gate and release candidate.
- Add or update a risk when an issue changes the supported model, solver build, dependency distribution, project schema, privacy boundary, or accuracy claim.
- Link closed risks to test reports or decisions; do not close based on intention alone.
- Reopen a risk when the solver version, compiler flags, Windows runtime, or relevant dependency changes.

## Stop conditions

Pause feature expansion if:

- neither native solver candidate passes the reference corpus;
- the exact solver's distribution rights cannot be resolved;
- Windows offline installation needs an undisclosed download or elevated background service;
- a supported import or result view is known to silently misrepresent the model;
- release evidence cannot reproduce the exact deck and binary used.

The response to a stop condition is to narrow scope, replace the failing component through the adapter, or document a blocker—not to weaken the claim silently.
