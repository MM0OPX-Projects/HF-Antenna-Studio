# Application baseline

## Purpose and status

This document records the reproducible AntennaSim-derived baseline for HF Antenna Studio. It is an implementation and regression baseline, not an electromagnetic validation certificate. The baseline was exercised on Windows 11 on 2026-08-02.

The application source is imported from EA1FUO/AntennaSim commit `96e153ceefffd25819e42142d591ca811b4790d3` (application version 1.4.2). The solver submodule is pinned to KJ7LNW/nec2c commit `55be1e0e3fe5ee9dad4ce6050711450d19c562fd`, tagged `v1.3.3`. The imported source and its provenance are preserved in commit `0aa3afc`.

The supported baseline execution mode is the browser-local WebAssembly engine. The Python/native-service path remains in the source tree for reference but is not the recommended Windows baseline.

This branch is a preserved, runnable reference snapshot. It does not reverse D-001 (new product repository with selective reuse), D-005 (native solver bake-off), or D-006 (Wasm must later prove parity with the accepted native oracle). Making the inherited application reproducible is evidence-gathering before redevelopment, not a decision to ship its architecture unchanged.

## Tested Windows 11 toolchain

| Component | Tested version |
| --- | --- |
| Windows | Windows 11 |
| Node.js | 24.14.0 |
| npm | 11.19.0 |
| Emscripten SDK | 3.1.56 |
| CMake | 3.31.6 |
| Ninja | 1.11.1 |
| nec2c | v1.3.3 at commit `55be1e0e...` |
| Playwright | 1.62.1 |
| Automated browser | Chromium 151 (Playwright build 1234) |

Node and npm versions are constrained in `frontend/package.json`; `.nvmrc` records the Node version. A newer major version is not part of this baseline until it has completed the same review loops.

## Fresh checkout, installation, and startup

Prerequisites:

- Git for Windows.
- Node.js 24.14.0, including npm 11.x.
- Emscripten SDK 3.1.56, activated at least once with `emsdk install 3.1.56` and `emsdk activate 3.1.56`.
- CMake and Ninja on `PATH`.

From PowerShell:

```powershell
git clone --recurse-submodules <HF-Antenna-Studio-repository-url>
Set-Location HF-Antenna-Studio

powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\build-wasm.ps1 `
  -EmsdkPath C:\path\to\emsdk

Set-Location frontend
npm ci
npm run dev:wasm
```

Open `http://localhost:5173/`. The browser-local solver performs no network request. Keep the terminal open while using the development server.

For a production build and local preview:

```powershell
Set-Location frontend
npm run build:wasm
npm run preview -- --host 127.0.0.1
```

The generated solver artifacts are intentionally ignored by Git and must exist at:

- `frontend/public/wasm/nec2c.js`
- `frontend/public/wasm/nec2c.wasm`

The Windows build script refuses to run against a dirty solver submodule, applies the repository's Emscripten compatibility patch temporarily, builds the pinned source, copies both artifacts, prints SHA-256 hashes, and restores the submodule. The baseline build produced a 61,435-byte JavaScript loader and a 265,721-byte Wasm module.

## Exact solver execution path

The `VITE_ENGINE=wasm` build-time variable selects `WasmEngine` in `frontend/src/engine/index.ts`. There is no native process or HTTP service in this mode.

1. The React store calls `WasmEngine.simulate` or `simulateAdvanced`.
2. `frontend/src/engine/wasm/index.ts` validates the frequency range and posts the immutable request to a module Web Worker.
3. `frontend/src/engine/wasm/worker.ts` converts the model into a NEC card deck with `buildCardDeck`.
4. The worker loads `/wasm/nec2c.js`, which loads `/wasm/nec2c.wasm`, and creates a fresh Emscripten module.
5. It writes the deck to Emscripten's in-memory filesystem as `/input.nec`.
6. It invokes the compiled NEC2C `main` function as `callMain(["-i", "/input.nec", "-o", "/output.out"])`.
7. It reads `/output.out`, parses impedance, current, power, near-field, and far-field sections, and posts structured results to the UI.
8. The caller is configured to reject a crashed/unreadable worker and terminates a simulation that exceeds 120 seconds, allowing a fresh worker on the next attempt. The timeout/reset path is unit-tested; explicit browser fault injection for the other worker events remains to be added.

The unused native-service alternative runs `nec2c -i <temporary-input> -o <temporary-output>` via Python `subprocess.run` with `shell=False`, a configured timeout, and a private temporary work directory. The Docker image installs Debian's `nec2c`. A Windows native NEC2C executable is not bundled and this path was not validated on Windows.

## NEC representation confirmed from source and tests

| Model concept | NEC representation |
| --- | --- |
| Wire geometry | `GW` cards, then `GE -1` for free space or `GE 0` with ground |
| Free space | `GN -1` |
| Perfect ground | `GN 1 0 0 0 0 0` |
| Real ground | Sommerfeld/Norton `GN 2` with relative permittivity and conductivity |
| Voltage sources | One or more type-0 `EX` cards with tag, segment, real voltage, and imaginary voltage |
| Loads | `LD` cards using the stored NEC load type and three parameters |
| Transmission lines | `TL` cards |
| Frequency sweep | Linear `FR 0`; multiple sweep segments emit separate `FR`/output-request blocks |
| Segment currents | `PT 0` enables current output; `PT -1` suppresses it |
| Radiation pattern | `RP 0` grid, full sphere in free space and upper hemisphere with ground |
| Near field | `NE` grid when requested |

Input deck construction and output parsing have unit tests. Those tests verify formatting and parser behavior; they do not independently prove NEC2C's numerical accuracy.

## Current supported features

“Supported” here means present in the baseline and exercised where the test column says so. It does not imply every combination has been validated.

| Feature | Baseline status | Evidence |
| --- | --- | --- |
| Local browser execution | Working | Windows 11 development and production Wasm builds |
| Offline calculation after local installation | Working while served locally | Browser worker uses local static assets; no service worker/PWA installation exists |
| Private local designs | Working for local use | Wasm path has no server call; save/open uses local file interaction |
| Built-in antenna templates | Present | Dipole, vertical, and Yagi exercised; other templates not individually smoke-tested |
| Custom wire editor | Present | Unit tests/build pass; full interactive editing workflow not baseline-tested |
| Interactive antenna geometry | Working | Visible WebGL canvas confirmed manually and by browser smoke tests |
| 2D azimuth/elevation patterns | Working | Pattern tab and both plot headings confirmed for three examples |
| Interactive 3D radiation surface | Working | Rendered WebGL canvas confirmed; numerical surface values are not independently validated |
| Resistance, reactance, impedance, SWR | Working for baseline examples | Summary and sweep plots checked against recorded envelopes |
| Frequency sweeps and segmented sweeps | Present | Deck/parser unit tests; single-segment sweeps exercised in browser |
| Element current magnitude and phase | Present | Parsed per segment; magnitude colouring and point inspection expose phase |
| Free-space, perfect, preset real, and custom real ground | Present | Card generation unit-tested; average real ground exercised in browser |
| NEC import/export | Present | Parser/generator unit tests pass; browser round-trip not in the baseline smoke suite |
| Native project save/load | Present | Existing `.antennasim` implementation and unit tests; manual OS file-dialog flow not automated |
| Loads and transmission lines | Present in advanced editor | Deck generation unit-tested; not independently solver-validated |
| Matching and Touchstone export | Present | Unit tests pass; not independently measured or externally validated |
| Parameter optimization | Present | Not accepted as validated or stable by this baseline |

## Baseline regression examples

These values were recorded from the pinned Wasm solver on Windows 11. Automated tests use ranges to catch gross regressions without changing calculation behavior to satisfy a fixture. They must not be cited as physical-reference validation.

| Existing example, defaults | Selected point | SWR | Impedance | Maximum gain | Sweep points |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dipole, average ground | 14.483 MHz | 1.42 | 71.0 - j1.7 Ω | 7.21 dBi | 36 |
| Quarter-wave vertical | automatically selected best point | 1.47 | 34.1 + j2.7 Ω | -0.03 dBi | 54 |
| Yagi, default three elements | automatically selected best point | 1.98 | 25.4 - j2.8 Ω | 12.65 dBi | 26 |

The smoke suite also requires a visible 3D canvas, opens the Pattern and impedance tabs, confirms the 2D plot headings, and fails on browser-console errors or uncaught page errors.

## Automated checks

Run from `frontend` after building the Wasm artifacts:

```powershell
npm ci
npm run type-check
npm run lint
npm test
npm run build:wasm
npx playwright install chromium
npm run test:smoke
```

Current baseline results:

- TypeScript type check: pass.
- Vitest: 396 tests in 22 files pass, including the simulation-worker timeout/reset path.
- Production Wasm build: pass.
- Playwright baseline: three real-solver examples pass.
- ESLint: pass with 13 warnings and no errors; see known UI limitations.
- npm audit: two high-severity entries representing one React Router RSC-mode CSRF advisory. This application is a client-rendered SPA and does not use React Server Components or server actions. npm offers only a forced downgrade, so the dependency is documented rather than changed unsafely. Reassess when a non-breaking patched release is available.
- All dependencies within the existing compatible version ranges were refreshed. ESLint 10, Vite 8, TypeScript 7, React plugin 6, Node 26 types, and newer Three.js are intentional major/minor migration work rather than baseline dependency fixes and remain deferred.

CI builds the pinned Wasm solver, runs static checks and unit tests, creates a Wasm production build, installs Chromium, and runs the browser smoke suite. A dedicated `windows-latest` job repeats the build, unit, production, and browser baseline on feature-branch pushes and pull requests to `main`.

## Licensing status

The imported application remains under AntennaSim's GPL-3.0-or-later grant and its root copyright notice. Frontend and backend package metadata now state `GPL-3.0-or-later`; the complete license text is at repository root. The NEC2C submodule retains its own `COPYING` file and exact Git history. Its conflicting public-domain/GPL provenance signals remain an open release issue under `LICENSING.md`; no more-permissive claim is made here. Generated Wasm binaries must be distributed with corresponding-source and notice obligations satisfied.

## Current broken or incomplete features

- A stock Windows checkout cannot use the backend engine: no native `nec2c` executable or Redis service is bundled. Use `dev:wasm`.
- Wasm artifacts are build outputs and are not shipped in Git. Startup fails to calculate if they were not built and copied; the smoke precheck now reports this explicitly.
- NEC2C stdout/stderr is suppressed by the Wasm wrapper and `SimulationResult.warnings` is always empty. Consequently native NEC warnings are not surfaced in the UI. The TypeScript preflight validator does display its own geometry warnings, but this is not a substitute.
- No PWA/service worker caches assets. “Offline” currently means the application and toolchain are installed locally and the local server is running; it is not an installable standalone desktop/PWA package.
- Optimization, complex multi-source phasing, loads, transmission lines, near fields, every ground preset, NEC import edge cases, and all templates have not completed independent baseline or physical validation.
- The backend has no test suite in the imported repository and was not made part of this Windows baseline.
- Worker crash, unreadable-message, and synchronous `postMessage` handlers were added but have not yet been exercised through browser fault injection; only timeout/reset is unit-tested.

## Known calculation limitations

- NEC2/NEC2C is a thin-wire method-of-moments engine. Results become unreliable for invalid segment length/radius ratios, wires too close to one another, extreme geometry, unsuitable segmentation, and geometries outside NEC2's formulation.
- The application accepts 0.1–2000 MHz, inherited from AntennaSim, while HF Antenna Studio's intended product range is approximately 1.8–54 MHz. Operation outside the product range is not validated.
- Real ground uses NEC2's Sommerfeld/Norton ground model and homogeneous material parameters. It does not model arbitrary terrain, layered ground, nearby buildings, insulation, lossy supports, feedline common-mode current, connector loss, or fabrication tolerances unless explicitly represented by supported NEC constructs.
- SWR is derived from parsed complex input impedance and the selected reference/matching configuration. It is not an independent solver output.
- Pattern interpolation, 3D meshing, beamwidth, efficiency integration, matching calculations, and post-processing are application code layered on NEC2C and require their own validation.
- The current regression envelopes compare the application with its own pinned historical output. They guard behavior but do not meet the independent validation requirements in `VALIDATION_PLAN.md`.

## Known UI and browser limitations

- The imported product name and version remain “AntennaSim 1.4.2” in the UI during the baseline phase. Rebranding is intentionally deferred.
- Dense editor and results panels remain complex on small screens; automated tests use a desktop viewport.
- WebGL capability and performance depend on the browser/GPU. There is no dedicated WebGL-unavailable fallback.
- Chromium logs one known Three.js deprecation warning: `THREE.Clock` is deprecated in favor of `THREE.Timer`. The call originates in the current React Three Fiber/Three.js dependency combination, not application code. No console errors were observed.
- ESLint reports 13 React compiler warnings in legacy UI code: responsive Smith-chart ref measurement, effect-driven local UI reset/synchronization, and imperative OrbitControls mutation. These are recorded technical debt. The baseline removed two safe effect warnings but did not hide or behaviorally rewrite the remaining interactions.
- Browser automation verifies that charts/canvas render and that result data appears. It does not assess visual correctness pixel-by-pixel or test every interaction.

## Review-loop record

1. **Clean install:** a lockfile-based `npm ci` was run after stopping the development server that held a Windows native module open. The direct `three-stdlib` dependency was added because source imports it directly. npm 11.19.0 resolves Windows optional packages consistently.
2. **Build:** Emscripten 3.1.56/CMake/Ninja Wasm build and Vite production build pass on Windows 11. The new PowerShell build path leaves the solver submodule clean.
3. **Solver:** the worker/CardDeck/Emscripten filesystem/callMain/output-parser path was traced and observed running the pinned solver. Worker crash, unreadable-message, synchronous-start, and timeout handlers were added; the timeout/reset path has an automated fake-worker test and the other fault paths remain documented as untested.
4. **Existing antennas:** dipole, vertical, and Yagi complete in the real browser-local solver and are automated as regression examples.
5. **Browser console:** no errors or uncaught exceptions; one upstream Three.js deprecation warning remains documented.
6. **Regression:** type check, unit tests, build, and three browser examples pass after dependency and error-handling changes. Calculation formulas and expected outputs were not altered to make tests pass.
7. **Documentation:** installation, solver identity/path, features, broken areas, limitations, audit findings, and test boundaries were cross-checked against source and observed behavior.

## Exit criteria for leaving the baseline phase

This baseline is suitable for starting controlled redevelopment once it is committed and reviewed. It is not suitable for claims of solver accuracy. The next validation work must compare reference NEC decks with independently obtained expected values and at least one established antenna package, as specified in `VALIDATION_PLAN.md`.
