# v1.0.0 release audit

Audit date: 2026-08-23

Status: **release-candidate application gates passed; distribution remains conditional on green workflows for the final release-branch commit, merged `main` commit, and `v1.0.0` tag**

## Gate register

| Area | Required evidence | Status |
|---|---|---|
| Version/source | All manifests at 1.0.0; clean signed-off release commit; recursive solver source pinned | Pass on candidate; final distribution commits must retain the same versions, pin and sign-off |
| Dependencies/security | Clean npm install/audit, RustSec audit in CI, secret scan, reviewed CSP/capabilities and unsafe DOM/process boundaries | Pass for Windows target; RustSec warnings classified below |
| Licence/provenance | GPL text, DCO, notices, source/build scripts, JS SBOM, dependency and comparator/asset review, offline About notice | Pass: review complete and corresponding-source package gate proven |
| Unit/type/lint/build | Fresh `npm ci`, type-check, ESLint, complete Vitest, production Wasm build | Pass: 645 tests; lint 0 errors/13 reviewed warnings |
| Integration/UI | Complete Playwright suite, browser-console and every-route return audit, stale/cancel/error paths | Pass: 93/93 locally and the frontend job in clean-runner CI #14 |
| Solver/validation | Wasm solver tests and fail-closed 16-deck external 4NEC2 campaign | Pass: 9 primary, 16 exact decks/5 families |
| Data workflows | Save/load/migration/recovery, NEC import/export/round trip, measurement parsing/export regressions | Pass in unit/browser suites |
| Windows package | Clean Windows runner build/install/launch/offline solve/log/uninstall/data-preservation acceptance | Pass: package workflow #11; required again on the final branch/tag tree |
| Documentation | README, user/install/validation/limitations/licence/release notes cross-reviewed against evidence | Pass: contradiction/link/claim review complete |
| Distribution | Main merged only after gates, annotated v1.0.0 tag, origin pushes, GitHub release if authenticated | Operational gate: verify final branch workflows, merge, verify `main`, tag, verify tag package, then publish |

## TODO/FIXME classification

| Match | Classification | Disposition |
|---|---|---|
| NEC2++ `nec_wasm.cpp` TODO described in `SOLVER_EVALUATION.md` | Future feature / rejected candidate evidence | NEC2++ is not selected, linked, built, or shipped; retain the audit warning. |

No active HF Antenna Studio code TODO/FIXME was found. Git sample hooks and the solver submodule's internal repository metadata are excluded from product-source classification.

## Dependency decisions

- The transitive `nanoid` advisory was **Must fix before v1**. It is overridden to fixed `3.3.18`; calculation behaviour is unchanged.
- RustSec reports no vulnerability advisory that affects the shipped Windows target. It reports 16 unmaintained transitive crates and one unsoundness warning for `glib 0.18.5` (`RUSTSEC-2024-0429`). The `glib` finding belongs to Tauri's non-shipped Linux GTK3 dependency path; the clean Windows compilation does not build GTK/glib. Unmaintained GTK3, proc-macro and `rust-unic` lockfile entries remain dependency-maintenance debt. This classification permits the Windows-only v1 release but blocks any Linux support claim until the applicable graph is upgraded/re-audited.
- Major upgrades to Vite, ESLint, TypeScript and other current packages are **Future feature** because they require migration/regression work and no known release vulnerability requires them.
- Minor “wanted” updates without a security or compatibility defect are **Acceptable known limitation** for the pinned v1.0.0 graph. Reproducibility takes priority over release-day churn.
- The browser-only package does not use a React Server Components/action server. Advisories must nevertheless be evaluated against the final resolved graph, not dismissed by package name alone.

The final npm lock inventory contains 424 package entries and the generated CycloneDX SBOM. Licence metadata spans 0BSD, Apache-2.0, Apache-2.0 OR MIT, BSD-2/3-Clause, BlueOak-1.0.0, CC-BY-4.0, ISC, MIT, MIT AND ISC, MPL-2.0, Python-2.0 and Zlib. One transitive package, `webgl-constants@1.1.1`, omits the `license` property from its package manifest but includes an MIT licence file; this was manually reviewed and is not an unknown grant.

## Accepted build-quality warnings

- ESLint reports 13 warnings and zero errors. They cover imperative Three.js orbit-control mutation, effect-driven editor/tab/slider synchronisation and ref-based Smith-chart tooltip positioning. The complete mouse/keyboard/narrow-layout/editor/Smith-chart browser suite passes without console or page errors. These are code-quality/performance refactoring candidates, not suppressed diagnostics or known calculation faults.
- Vite reports the main minified chunk at approximately 770.83 kB against the project's 750 kB advisory threshold. The application uses route-level lazy chunks for major laboratories; further splitting is a post-v1 startup-performance task. The build succeeds and installed-package responsiveness remains part of Windows acceptance.
- The test runner prints a `NO_COLOR`/`FORCE_COLOR` environment warning inherited from its host. It does not originate in application code or affect test results.
- GitHub forces several current actions—including checkout, setup-node, setup-emsdk and RustSec—from their declared Node 20 runtime onto Node 24 and emits a deprecation warning. The jobs complete successfully on Node 24. Upgrade each action when an upstream Node 24 declaration is available; setting GitHub's insecure Node-version escape hatch is prohibited.

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
- The first clean Linux candidate run exceeded the generic 120-second limit inside one monolithic 17-route navigation test after 34 earlier solver-heavy cases. No route assertion failed before Playwright closed the page. The audit was split into 17 independently isolated desktop cases plus five compact cases and unknown-route recovery, preserving every assertion and console/page-error check. The expanded complete suite passes 93/93 locally and in the frontend job of clean-runner CI #14.
- The frontend engine factory defaulted to the historical network backend if its build variable was absent. It now fails safe to local Wasm; backend mode requires explicit `VITE_ENGINE=backend` and has a dedicated selection regression.
- GitHub's automatic source archive contains only a submodule gitlink, not the bundled solver's source. The package workflow now builds and hashes a named corresponding-source ZIP with the pinned nec2c tree expanded. Missing solver source blocks the workflow.
- Repeated clean Windows package runs exposed background-WebView timing while dismissing the release-notes modal: native CDP input stalled after Playwright reported the button actionable, and a DOM click did not render React's close-state within five seconds. Changelog dismissal is test setup rather than the installed-package acceptance subject, and the complete browser suite already exercises it through normal user input. The package test now writes the documented first-party “seen” record, reloads, asserts the modal is absent, then performs all consequential launcher, navigation, solver, offline, logging and persistence interactions normally. The exact final-tree packaging workflow must prove this correction.
- A later clean package run exposed a transient WebView2 attach condition before any application assertion: the CDP endpoint returned a WebSocket URL and Playwright connected, but the attach handshake exceeded 60 seconds; the two preceding installer runs passed. The package harness now permits one bounded attach retry after one second and still fails after the second 60-second attempt. This does not retry calculations or application assertions, and an exact final-tree package run must prove the bound is sufficient.
- A subsequent installed-package run exposed a second WebView2/CDP lifecycle mismatch after the runtime had attached and navigated successfully: Playwright recorded navigation to `tauri.localhost`, but the custom-protocol page did not forward the awaited `DOMContentLoaded` event before 30 seconds. The harness now resolves the reload at navigation commit and separately requires the hydrated HF Antenna Studio navigation link to become visible within 30 seconds before any application interaction. This replaces an unreliable transport lifecycle signal with a stronger application-readiness assertion; no installed-app, offline-solver, runtime-identity, logging, storage, uninstall/reinstall or network-isolation check is retried or removed.
- The Windows clean-runner browser gate exposed a second CI-only mismatch: the job built the production application, then ignored it and ran all 93 solver-heavy cases through Vite's on-demand development server. On the constrained hosted Windows runner, the eight-template aggregate case exceeded its whole-test timeout and later solver cases cascaded into timeouts. Switching to the production preview removed that bottleneck, but reusing one Chromium worker across every solver-heavy file eventually closed the browser after the optimiser cases. The Windows gate now runs all 21 spec files, and therefore all 93 behavioural cases, in sequential fresh Playwright processes against the production preview without weakening their feature assertions. Linux retains the complete single-process production-preview run, and the independent NSIS workflow exercises the installed offline application. Cancelled diagnostic runs are not release evidence; an exact final-tree CI run must pass all three jobs.
- The isolated Windows runs then made the remaining limits explicit: both tests which intentionally iterate every template exhausted the generic two-minute whole-test budget, while all five later template cases passed; after lifting that aggregate limit, the first horizontal-dipole result exceeded its otherwise adequate 30-second local/Linux wait. The two aggregate cases retain every per-template geometry, feed, segmentation, NEC, solver, numeric-result, range and slider assertion. On Windows CI only, the solver loop has a 20-minute total bound with 120 seconds per result, and the range/UI loop has a ten-minute bound; local and Linux runs retain the two-minute aggregate and 30-second result limits. This accommodates the hosted runner's software-rendered 3D/Wasm throughput without accepting a wrong result or unbounded hang.
- Once the aggregate template suite completed on hosted Windows, the independent baseline file exposed the same whole-test coupling: the dipole had not published its result before the generic 120-second test deadline, while the vertical had published a result and visible Three.js canvas but exhausted that deadline while Playwright queried the canvas bounds; the Yagi completed. The three baseline cases retain their recorded SWR/R/X/gain envelopes, visible 3D canvas and dimensions, pattern/impedance tabs, and console/page-error assertions. Windows CI alone now permits a six-minute whole-test bound with four minutes for result publication; local and Linux retain the two-minute bounds.
- Fresh-browser isolation also exposed Chromium's exact WebGL `ReadPixels` GPU-stall performance diagnostic while Playwright captured 3D output. That browser-driver warning does not originate in application code. A unit-tested exact-match filter ignores only that diagnostic (plus the already-reviewed Three.js Clock deprecation); every other browser warning, error and page error collected by the verified-dipole test remains release-failing.
- Ground-contact vertical language could imply explicit radial systems that v1 does not implement. Known limitations and the user/release guides now distinguish perfect-ground contact, the single-vertical NEC radial-screen approximation, and elevated explicit current-carrying radials, including the phased-array boundary.

The preferred v1 architecture remains D-031 because it is the only complete runtime with application, cancellation, external exact-deck, and installed/offline evidence. The absence of a native parity baseline remains a documented residual risk, not evidence that an unimplemented native runner is safer to release.

## Release decision rule

Any failed required check, unexplained material reference difference, missing package artefact, security vulnerability, data-loss/import semantic defect, solver-source mismatch, external-network dependency, or contradictory validation claim blocks v1.0.0. Accepted limitations must be visible, bounded, documented, and not described as validated.

The immutable GitHub evidence established before the final distribution operation is [CI #14](https://github.com/MM0OPX-Projects/HF-Antenna-Studio/actions/runs/32650420967) for the corrected complete frontend/navigation tree and [Windows package #11](https://github.com/MM0OPX-Projects/HF-Antenna-Studio/actions/runs/32649234771) for install/launch/offline solve/log/uninstall/reinstall/data-preservation and corresponding-source packaging. The release operator must additionally require green checks on the exact final branch, merged `main`, and tag as described above; those later run identities belong in the published release record rather than in a commit that would itself retrigger packaging.
