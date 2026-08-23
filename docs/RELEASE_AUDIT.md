# v1.0.0 release audit

Audit date: 2026-08-23

Status: **release candidate — tag/merge prohibited until every required gate below has recorded evidence**

## Gate register

| Area | Required evidence | Status |
|---|---|---|
| Version/source | All manifests at 1.0.0; clean signed-off release commit; recursive solver source pinned | Version/submodule pass; commit pending |
| Dependencies/security | Clean npm install/audit, RustSec audit in CI, secret scan, reviewed CSP/capabilities and unsafe DOM/process boundaries | npm/scan/review pass; RustSec CI pending |
| Licence/provenance | GPL text, DCO, notices, source/build scripts, JS SBOM, dependency and comparator/asset review, offline About notice | Local review pass; package CI pending |
| Unit/type/lint/build | Fresh `npm ci`, type-check, ESLint, complete Vitest, production Wasm build | Pass: 645 tests; lint 0 errors/13 reviewed warnings |
| Integration/UI | Complete Playwright suite, browser-console and every-route return audit, stale/cancel/error paths | Local pass: 93/93; clean-runner rerun pending |
| Solver/validation | Wasm solver tests and fail-closed 16-deck external 4NEC2 campaign | Pass: 9 primary, 16 exact decks/5 families |
| Data workflows | Save/load/migration/recovery, NEC import/export/round trip, measurement parsing/export regressions | Pass in unit/browser suites |
| Windows package | Clean Windows runner build/install/launch/offline solve/log/uninstall/data-preservation acceptance | Pending workflow |
| Documentation | README, user/install/validation/limitations/licence/release notes cross-reviewed against evidence | Pass: contradiction/link/claim review complete |
| Distribution | Main merged only after gates, annotated v1.0.0 tag, origin pushes, GitHub release if authenticated | Blocked by gates |

## TODO/FIXME classification

| Match | Classification | Disposition |
|---|---|---|
| NEC2++ `nec_wasm.cpp` TODO described in `SOLVER_EVALUATION.md` | Future feature / rejected candidate evidence | NEC2++ is not selected, linked, built, or shipped; retain the audit warning. |

No active HF Antenna Studio code TODO/FIXME was found. Git sample hooks and the solver submodule's internal repository metadata are excluded from product-source classification.

## Dependency decisions

- The transitive `nanoid` advisory was **Must fix before v1**. It is overridden to fixed `3.3.18`; calculation behaviour is unchanged.
- Major upgrades to Vite, ESLint, TypeScript and other current packages are **Future feature** because they require migration/regression work and no known release vulnerability requires them.
- Minor “wanted” updates without a security or compatibility defect are **Acceptable known limitation** for the pinned v1.0.0 graph. Reproducibility takes priority over release-day churn.
- The browser-only package does not use a React Server Components/action server. Advisories must nevertheless be evaluated against the final resolved graph, not dismissed by package name alone.

The final npm lock inventory contains 424 package entries and the generated CycloneDX SBOM. Licence metadata spans 0BSD, Apache-2.0, Apache-2.0 OR MIT, BSD-2/3-Clause, BlueOak-1.0.0, CC-BY-4.0, ISC, MIT, MIT AND ISC, MPL-2.0, Python-2.0 and Zlib. One transitive package, `webgl-constants@1.1.1`, omits the `license` property from its package manifest but includes an MIT licence file; this was manually reviewed and is not an unknown grant.

## Accepted build-quality warnings

- ESLint reports 13 warnings and zero errors. They cover imperative Three.js orbit-control mutation, effect-driven editor/tab/slider synchronisation and ref-based Smith-chart tooltip positioning. The complete mouse/keyboard/narrow-layout/editor/Smith-chart browser suite passes without console or page errors. These are code-quality/performance refactoring candidates, not suppressed diagnostics or known calculation faults.
- Vite reports the main minified chunk at approximately 770.83 kB against the project's 750 kB advisory threshold. The application uses route-level lazy chunks for major laboratories; further splitting is a post-v1 startup-performance task. The build succeeds and installed-package responsiveness remains part of Windows acceptance.
- The test runner prints a `NO_COLOR`/`FORCE_COLOR` environment warning inherited from its host. It does not originate in application code or affect test results.

## Security design review

- Tauri exposes only runtime information, bounded diagnostic append, and open-log-directory commands.
- The log-directory command passes a resolved application path directly to Explorer and does not build a shell command.
- CSP permits local assets, Wasm workers and Tauri IPC and has no external network origin for normal calculations.
- The engine factory now fails safe to local Wasm when no build-time engine is supplied; the historical backend path requires explicit `VITE_ENGINE=backend`.
- No updater, telemetry, cloud account, Redis, backend service or local HTTP listener is in the Windows package.
- Worker cancellation/request identity prevents superseded solver results being presented as current.
- The only reviewed `innerHTML` use receives project-authored labels and formatted numeric fields, not imported markup; residual risk is low but this remains a future hardening candidate.
- Project/measurement/NEC imports are parsed as data, preserve source/provenance where promised, and fail closed on unsupported future/significant content.

## Second critical release review

The release candidate was reviewed from the position that D-031 should be rejected. The review found and resolved these concrete issues:

- Old planning checkpoints still described a native solver as an unmet v1 gate. D-004 through D-006 and affected architecture, roadmap, risk, family and validation records now distinguish superseded history from the selected Wasm runtime.
- The first changelog rewrite allowed the inherited AntennaSim 1.4.2 entry to be absorbed into v1.0.0, producing duplicate React keys and repeated browser-console errors. Parseable inherited headings plus index-stable section keys fixed it; two complete 73-test browser runs then passed.
- The first clean Linux candidate run exceeded the generic 120-second limit inside one monolithic 17-route navigation test after 34 earlier solver-heavy cases. No route assertion failed before Playwright closed the page. The audit was split into 17 independently isolated desktop cases plus five compact cases and unknown-route recovery, preserving every assertion and console/page-error check. The expanded complete suite passes 93/93 locally; the clean-runner rerun remains a gate.
- The frontend engine factory defaulted to the historical network backend if its build variable was absent. It now fails safe to local Wasm; backend mode requires explicit `VITE_ENGINE=backend` and has a dedicated selection regression.
- GitHub's automatic source archive contains only a submodule gitlink, not the bundled solver's source. The package workflow now builds and hashes a named corresponding-source ZIP with the pinned nec2c tree expanded. Missing solver source blocks the workflow.
- Ground-contact vertical language could imply explicit radial systems that v1 does not implement. Known limitations and the user/release guides now distinguish perfect-ground contact, the single-vertical NEC radial-screen approximation, and elevated explicit current-carrying radials, including the phased-array boundary.

The preferred v1 architecture remains D-031 because it is the only complete runtime with application, cancellation, external exact-deck, and installed/offline evidence. The absence of a native parity baseline remains a documented residual risk, not evidence that an unimplemented native runner is safer to release.

## Release decision rule

Any failed required check, unexplained material reference difference, missing package artefact, security vulnerability, data-loss/import semantic defect, solver-source mismatch, external-network dependency, or contradictory validation claim blocks v1.0.0. Accepted limitations must be visible, bounded, documented, and not described as validated.
