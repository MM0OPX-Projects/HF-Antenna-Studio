# HF Antenna Studio — Solver and Foundation Evaluation

Historical status: this document records the initial foundation/bake-off recommendation. D-031 in [`DECISIONS.md`](DECISIONS.md) supersedes the deferred-product-solver position for v1.0.0 by selecting the externally compared, packaged nec2c/WebAssembly path. Native alternatives remain future studies.

Status: repository audit and architecture recommendation
Audit date: 2026-08-02

## Executive finding

EA1FUO/AntennaSim is valuable prior art and a useful source of selectively reusable GPL components, but it is not the best repository foundation for HF Antenna Studio. Start a new repository and port only reviewed components with provenance.

For the calculation engine, use a native command-line process boundary as the initial architecture. Treat native `nec2c` as the baseline and native NEC2++ as the challenger in a Phase 0 Windows and numerical bake-off. Do not permanently select either until the exact distributed build passes the independent validation plan. Defer WebAssembly as an optional adapter.

The recommendation is intentionally conditional. This audit demonstrated that AntennaSim's deployed Wasm path can execute simple models, but it did not validate either candidate solver or an HF Antenna Studio Windows binary.

## Audit scope and evidence

The AntennaSim source snapshot was [`96e153ceefffd25819e42142d591ca811b4790d3`](https://github.com/EA1FUO/AntennaSim/tree/96e153ceefffd25819e42142d591ca811b4790d3), dated 2026-07-31 and describing itself as version 1.4.2. Repository history, source, tests, workflows, Docker files, Wasm build files, license, and linked solver submodule were inspected.

The KJ7LNW/nec2c submodule was pinned at [`55be1e0e3fe5ee9dad4ce6050711450d19c562fd`](https://github.com/KJ7LNW/nec2c/tree/55be1e0e3fe5ee9dad4ce6050711450d19c562fd), corresponding to its v1.3.3 history.

NEC2++ was separately reviewed at [`865851d15c5de8e64054adf5621a12e5b9984233`](https://github.com/tmolteno/necpp/tree/865851d15c5de8e64054adf5621a12e5b9984233), version 2.3.2 at the audit date.

The [NEC-2 user manual](https://www.nec2.org/part_3/toc.html) is the primary source for card semantics. 4NEC2 and EZNEC are comparison applications, not sources to copy.

### Checks performed

- Cloned and enumerated tracked files and submodules.
- Read frontend, backend, deployment, solver-runner, deck-generator, parser, model, and test code.
- Inspected current GitHub workflow state and selected historical issues.
- Ran the AntennaSim frontend with the bundled local Node runtime using a strict `pnpm` install.
- Ran 395 frontend tests in 21 files successfully.
- Ran lint: no errors and 15 warnings.
- Built production frontend assets successfully.
- Ran `tsc --noEmit`; it failed because `three-stdlib` is used but not declared directly under strict dependency isolation. Upstream npm CI was green, so this is a dependency-declaration finding rather than a claim that its supported build is broken.
- Found no backend test suite and no test that invokes a real NEC executable.
- Smoke-tested the deployed AntennaSim browser application. A default average-ground dipole sweep completed, then a free-space sweep completed. The selected free-space point near 14.36 MHz displayed approximately 2.14 dBi maximum gain. This proves only that the deployed Wasm flow can run that interaction; it is not a reference validation.

No native Windows solver was built or run during this audit. No numerical acceptance claim follows from these checks.

## AntennaSim repository assessment

### Structure

The repository contains three principal implementation paths:

- a React 19/TypeScript/Vite frontend using Zustand, Recharts, Three.js, and React Three Fiber;
- a FastAPI/Pydantic backend with a subprocess solver runner, SciPy-based optimizer, Redis cache, and Docker deployment;
- an Emscripten build of a pinned KJ7LNW/nec2c source tree for a browser Web Worker.

Docker packaging combines Nginx, Supervisor, Redis, the Python backend, and a distribution-installed `nec2c`. A separate GitHub Pages deployment uses the Wasm engine. This is broad deployment coverage, but it creates two calculation pipelines and multiple copies of the domain/deck/parser logic.

### License

AntennaSim's root `LICENSE` carries an AntennaSim copyright notice and the GNU GPL version 3 text/“or later” grant. GitHub reports `NOASSERTION` because the file is not a stock unmodified detector target. For reuse planning, the conservative classification is GPL-3.0-or-later.

There is no complete third-party notice inventory or software bill of materials in the audited snapshot. Docker base images, Debian packages, Python packages, npm packages, fonts/icons/assets, and the solver require a release-level inventory.

The linked KJ7LNW/nec2c repository contains conflicting provenance signals: its README calls the program public domain, while `COPYING` contains GPLv3 and distributions such as [Fedora classify the package as GPL-3.0-only](https://packages.fedoraproject.org/pkgs/nec2c/nec2c/index.html). Until that discrepancy is resolved, a distributor should comply with the more restrictive plausible terms, preserve notices/source, and obtain a documented provenance review.

### Useful components and concepts

- Mature React component organization and a reasonably broad UI test suite.
- Interactive 3D wire geometry, measurements, junction editing, camera controls, and result presentation concepts.
- State stores for editor and simulator workflows.
- Antenna templates and parameter-editing concepts.
- Web Worker isolation for calculation and optimization.
- Project schema version/migration concept.
- Matching-network utilities and chart components that can be independently retested.
- NEC text parsing fixtures and deterministic card-generator test patterns.

Reuse is subject to GPL obligations, file-level provenance, and fresh correctness/accessibility review.

### Technical debt and incomplete or risky behavior

#### No independent solver-validation suite

The frontend “integration” tests check card shape, parser behavior, and round trips without executing NEC. A pattern fixture described as a free-space half-wave dipole expects 6.76 dBi, inconsistent with the approximately 2.15 dBi directivity of that ideal reference case. The fixture may be useful for parser mechanics, but not as a physical oracle.

Backend tests were not present. Claims of “same results” between native/backend and Wasm paths are not supported by an exact-deck, exact-build comparison suite in the audited repository.

#### Parallel implementations can drift

The backend and frontend independently represent models, generate NEC cards, parse output, derive values, and validate ranges. The Docker backend installs the operating-system `nec2c` package, while Wasm uses a pinned source commit. Versions and patches can therefore differ even for nominally identical inputs.

#### Warnings are incomplete

The backend runner explicitly scans for only limited geometry/segment error strings and adds a small set of impedance heuristics. Stderr is logged. The browser Wasm response initializes its application warning list as empty. This does not meet the requirement to preserve NEC warnings and modelling limitations as first-class results.

#### Import/export is lossy

The browser import parser recognizes some LD and TL syntax but the returned import structure does not retain those records. Unsupported and malformed lines may be skipped; numeric values may be clamped; a source may be invented if one is absent. The backend parser covers a different subset. RP, PT, XQ, near-field controls, transforms, arcs, symmetry, networks, and multiple control blocks are not represented consistently.

An imported deck therefore cannot be assumed to round-trip. Silent loss or normalization is especially dangerous because the generated model may still look plausible.

#### Angular and plotted-result semantics need correction or proof

The generators request RP grids with theta ranges that include negative theta; the ground path also requests values corresponding to below-horizon directions. NEC theta is canonically measured from +Z. These grids can duplicate physical directions or introduce below-ground values, affecting meshes and integrations.

The 2D “azimuth” view selects the theta row containing the global maximum rather than necessarily theta 90 degrees/the horizontal plane. The 3D view linearly maps a normalized dB interval to radius. Both may make useful pictures, but neither is an adequately specified engineering display without labels and independent coordinate tests.

Pattern-derived efficiency is numerically integrated and capped at 100%. Given the angular-domain issue and differences between NEC pattern quantities, this derivation needs comparison with solver power-budget outputs and reference cases.

#### Ground-connected geometry requires specific testing

The generator represents free space as `GE -1` and `GN -1`, perfect ground as `GE 0` plus `GN 1`, and real ground as `GE 0` plus `GN 2` with permittivity/conductivity. According to the [GE card documentation](https://www.nec2.org/part_3/cards/ge.html), the GE flag affects ground presence and current interpolation at ground; the [GN card](https://www.nec2.org/part_3/cards/gn.html) selects the ground parameters/model. Always using `GE 0` for grounded cases may be correct for some non-contact geometries but cannot be generalized to a wire ending on ground without reference tests.

Feature checkpoint: the later dedicated verified-dipole adapter does not reuse this convention. It emits `GE 0` for free space and `GE -1` for its always-elevated wire over perfect or real ground, matching the manual flag definitions and avoiding `GE 1` contact interpolation. This does not silently change the inherited generic builder.

#### Reproducibility data is incomplete

The native project schema records useful editor data, but not enough of the raw imported NEC document, complete control-card intent, exact compiler version, solver version/binary hash, build flags, or raw input/output to reproduce every result.

#### Packaging/offline gaps

The static browser deployment did not include an explicit service worker/offline installation design, so incidental browser caching is not an offline guarantee. The Docker image can operate locally after installation, but its Windows footprint and multiple processes are not the preferred desktop experience. Dependency versions/build inputs are not comprehensively locked.

#### Rapid feature evolution increases regression pressure

Recent issue history includes coordinate labels, elevation orientation, free-space pattern rendering, transformer SWR, frequency-graph artifacts, efficiency, ground schema, and template/feed corrections. Many were closed, which shows active maintenance, but also confirms that result presentation and model semantics need a stronger physical regression suite.

## Exactly how AntennaSim invokes NEC

### Python/backend path

In [`backend/src/simulation/nec_runner.py`](https://github.com/EA1FUO/AntennaSim/blob/96e153ceefffd25819e42142d591ca811b4790d3/backend/src/simulation/nec_runner.py), the backend:

1. creates a UUID-named working directory under a configured temporary root;
2. writes `input.nec`;
3. calls `subprocess.run` with the argument vector `nec2c -i <input> -o <output>`, `shell=False`, captured text output, a working-directory setting, and a timeout that defaults to 180 seconds;
4. reads the generated output file;
5. applies limited string checks and passes text to the parser;
6. removes the temporary directory.

The Docker build installs Debian's `nec2c` package. It does not build the same pinned submodule used by the browser path.

### Browser/Wasm path

The Wasm build compiles the pinned KJ7LNW/nec2c split C sources with Emscripten. The build exports `main`, a modularized JavaScript factory, and Emscripten filesystem/call helpers, allows memory growth, and applies small patches for POSIX signal/header behavior and timing. The call path is in [`frontend/src/engine/wasm/worker.ts`](https://github.com/EA1FUO/AntennaSim/blob/96e153ceefffd25819e42142d591ca811b4790d3/frontend/src/engine/wasm/worker.ts).

The frontend Web Worker loads the generated module, creates a fresh module instance for a run, writes `/input.nec` to the Emscripten filesystem, invokes:

```text
callMain(["-i", "/input.nec", "-o", "/output.out"])
```

It then reads `/output.out` and parses the text in TypeScript. A fresh module per run limits stale global state but does not establish numerical parity or comprehensive diagnostics.

## AntennaSim card representation

The two generators are broadly organized as:

```text
CM comments
CE
GW / GA / transforms as applicable
GE
GN
LD
TL
PT
EX
FR
NE (when requested)
RP
... repeated control blocks for additional frequency ranges ...
EN
```

Exact ordering varies between paths/features and should be tested against the selected solver dialect.

### Geometry and sources

- Straight wires use `GW` with tag, segment count, endpoints, and radius.
- Some code paths also model arcs (`GA`) and transforms/symmetry (`GM`, `GR`).
- Sources use `EX 0` voltage excitation with wire tag, one-based segment number, and real/imaginary voltage components.
- Multiple sources are representable in the editor model.

### Loads and networks

Represented load types include:

- `LD 0` series RLC;
- `LD 1` parallel RLC;
- `LD 4` fixed complex impedance;
- `LD 5` wire conductivity;
- `TL` transmission-line cards.

Support is not consistent across import, project persistence, browser, and backend paths. Network (`NT`) and broader NEC dialect behavior are not a safe assumed subset.

### Ground

Observed forms:

| Model | Cards |
|---|---|
| Free space | `GE -1`, `GN -1` |
| Perfect ground | `GE 0`, `GN 1 ...` |
| Real/preset/custom ground | `GE 0`, `GN 2 ... εr σ` |

Presets include salt water, fresh water, pastoral, average, rocky, city, and sandy values. Values are input data, not proof that the corresponding ground solution or contact geometry is valid.

The audited preset pairs `(relative permittivity, conductivity S/m)` are: salt water `(80, 5)`, fresh water `(80, 0.001)`, pastoral `(14, 0.01)`, average `(13, 0.005)`, rocky `(12, 0.002)`, city `(5, 0.001)`, and sandy `(3, 0.0001)`. HF Antenna Studio must trace and validate any presets it adopts instead of copying names and numbers without provenance.

The eventual implementation must separately define ground type, radial screen parameters if supported, cliff/second-medium options if supported, and the GE contact/interpolation choice. These must not be inferred only from a friendly preset name.

### Frequency sweeps

A linear sweep is emitted as `FR 0 <count> ... <start> <step>`. Multiple disjoint requested ranges become repeated frequency/output blocks. In the audited code, a backend range is capped at 201 points and multiple ranges at 301 total. Separately, geometry workload policies conflict: the backend caps total segments at 5,000, while the frontend warns above 2,000 and rejects only above 10,000. These are implementation limits rather than validated physical/performance limits, which is another reason for one canonical compiler and run-limit policy.

The result contract must retain the exact requested frequency list and map every output record to it without relying on floating-point string equality.

### Currents and patterns

- `PT 0` requests current printing; `PT -1` suppresses it in paths that do not need currents.
- The parser extracts current magnitude/phase and segment position from text output.
- `RP 0 NTH NPH 1000 ...` requests a far-field grid. Under the [RP card definition](https://www.nec2.org/part_3/cards/rp.html), the digits in `1000` select vertical/horizontal/total output, no normalization, power gain, and no averaging; HF Antenna Studio should encode those choices symbolically rather than retain an opaque integer.
- AntennaSim parses vertical/horizontal/total gain values and derives maximum gain, beamwidth, front-to-back ratio, and pattern visualizations.

The audited frontend requests approximately `theta=-180..180` for free space and `theta=-90..90` for grounded models, with phi spanning `0..360` without the repeated endpoint. Because NEC theta is conventionally measured from +Z, these domains can duplicate directions or include below-ground requests. They must not be inherited without direct raw-grid validation.

Every derived quantity needs a formula, input-field definition, coordinate convention, and reference test in HF Antenna Studio.

## Solver option evaluation

Ratings below preserve the initial planning assessment. They are not current benchmark results. D-031 later selected option 3—the pinned KJ7LNW/nec2c WebAssembly worker—for the validation-bounded v1.0.0 runtime after exact-deck, cancellation, and installed/offline Windows gates passed. Native nec2c and NEC2++ remain post-v1 challengers, not unmet v1 gates.

| Option | Strengths | Gaps/risks | Planning disposition |
|---|---|---|---|
| 1. NEC-2 implementation already used by AntennaSim | Known end-to-end deck/output workflow; deployed Wasm smoke run succeeded; open source is available; easy to compare with upstream | Two different builds in AntennaSim; sparse upstream maintenance/tests; Windows native build unproven here; license provenance signals conflict; warnings/parity not validated | Reuse knowledge and pinned source as a bake-off input, not AntennaSim's dual pipeline wholesale |
| 2. `nec2c` compiled for local execution | Simple deck-based CLI; process isolation; raw standard-like input/output; small integration surface; can be checksummed and reproduced | Need a supported Windows build recipe, toolchain patch audit, cancellation/process-tree testing, numerical corpus, redistribution review, and maintenance plan | Preferred baseline for Phase 0; product selection conditional on gates |
| 3. `nec2c` or equivalent in WebAssembly | No native child executable; potential browser portability; worker isolation; AntennaSim proves a simple route is feasible | Emscripten/POSIX patches; virtual filesystem; memory/performance limits; hard cancellation; warning capture; floating-point/runtime parity; browser offline packaging; candidate NEC2++ entry point is a stub | Defer until a native oracle and exact parity suite exist; optional future adapter only |
| 4. NEC2++ | C++17 library/CLI; CMake; current Windows CI; regression corpus comparing historical implementations; active recent work; potentially better integration API | GPL-2.0-or-later implications; smaller maintainer base; output/API differences; exact Windows release binary still untested here; in-process fault/cancel risks; current Wasm wrapper does not run a deck | Strong native challenger; test as out-of-process CLI/wrapper first |
| 5. Local service invoking native NEC | Decouples browser UI and native solver; can support alternate frontends; isolates solver | A localhost server adds ports, authentication/origin/firewall, lifecycle, update, and attack-surface concerns; HTTP is unnecessary inside a desktop shell | Use the process-invocation concept behind Tauri IPC, not a listening service in v1 |

## NEC2++ observations

The audited NEC2++ repository uses C++17/CMake, supplies a library and command-line tools, documents MSVC/MinGW paths, and has Linux/macOS/Windows continuous integration. Its regression material compares numerous models with nec2c and historical Fortran outputs, which is valuable evidence infrastructure.

Its current WebAssembly workflow only proves compilation. The `nec_wasm.cpp` entry point creates a C++ input stream but calls geometry parsing through `stdin`, runs only preparation, and contains a TODO indicating that stream parsing is not wired through. It should be treated as a stub, not a working Wasm NEC solver.

NEC2++'s native maturity makes it a serious candidate, but upstream regression success is not a substitute for testing HF Antenna Studio's exact build, input compiler, process wrapper, parser, and plots.

## Post-v1 native bake-off retained from Phase 0

The following experiment remains useful as an architecture comparison, but D-031 makes it post-v1 work rather than a release condition.

Build reproducible x64 Windows candidates for:

1. pinned KJ7LNW/nec2c or another provenance-resolved nec2c source;
2. pinned NEC2++ with a deck-compatible CLI or minimal out-of-process wrapper.

For each candidate:

- record source commit, patches, compiler, flags, runtime dependencies, license texts, and binary hash;
- run on two clean Windows 11 environments, including a disconnected VM;
- verify paths with spaces/non-ASCII characters, no admin execution, cancellation, timeout, crash handling, and endpoint-security behavior;
- run the exact validation corpus and preserve raw outputs;
- compare supported card coverage, diagnostics, output stability, runtime, memory, and packaging size;
- repeat representative models to test determinism;
- conduct segment-convergence families rather than compare only one discretization;
- review maintainer health and the feasibility of carrying essential patches.

### Required decision criteria

Numerical correctness and diagnostic preservation are mandatory. A candidate is rejected if it:

- cannot meet the reference-model tolerances without an explained formulation difference;
- omits or corrupts currents, impedance, ground results, or requested patterns in the supported subset;
- cannot be cancelled or safely bounded on Windows;
- has unresolved redistribution rights for the exact shipped artifact;
- requires online installation or an elevated/background service;
- cannot be reproduced from documented source and patches.

If both pass, choose using, in order: warning/error quality, supported-card coverage, build/maintenance sustainability, output stability, performance, and bundle size. Familiarity with AntennaSim alone is not a deciding criterion.

## Recommendation on repository strategy

### Start a new repository

Reasons:

- HF Antenna Studio has a different deployment boundary: a Tauri/WebView2 Windows package with one local Wasm worker pipeline instead of AntennaSim's Python/Redis/Docker plus browser-Wasm dual architecture. A narrow native IPC/process alternative remains a post-v1 option.
- A new canonical schema/compiler/parser is central to accuracy and maintainability.
- Loss-aware NEC import and solver provenance are foundational requirements, not incremental UI fixes.
- The application needs validation evidence before inheriting broad feature claims.
- A clean name, asset set, threat model, and release process reduce branding/provenance confusion.

### Reuse selectively, with history

This is not a clean-room mandate. Reusing GPL-compatible AntennaSim code can save time where its concepts fit. Each port should:

1. identify the source file and audited commit;
2. preserve copyright/license notices;
3. record whether it was copied, adapted, or only conceptually reimplemented;
4. add tests against HF Antenna Studio's contracts;
5. avoid importing obsolete backend/branding/assets incidentally.

A Git fork is therefore not the recommended starting shape, but upstream credit and license compliance remain mandatory for any actual reuse.

## Experimental assumptions still open

Native-candidate rows below affect a possible post-v1 replacement, not the selected v1 runtime.

| Assumption | Required experiment | Decision affected |
|---|---|---|
| Native `nec2c` can be built and redistributed reliably for Windows 11 x64 | Reproducible clean build, provenance review, clean-VM execution | Default solver |
| NEC2++ deck results and diagnostics are at least as suitable | Same corpus and process-boundary spike | Default/fallback solver |
| `GE`/`GN` choices handle elevated and ground-connected structures correctly | Reference decks across perfect and real ground | Ground compiler rules |
| A native child process will not create unacceptable antivirus friction | Signed/unsigned installer matrix with representative endpoint security | Packaging/support model |
| WebView2 can be delivered for fully offline installation at acceptable size | Air-gapped installer tests for offline/fixed runtime variants | Installer manifest |
| Text output is stable enough for a versioned parser | Corpus across exact solver versions plus malformed/truncated outputs | Result adapter design |
| Pattern workload is practical at useful angular resolution | Timed 1°, 2°, 5° grids across representative machines | Defaults and caps |
| Solver startup overhead is acceptable for sliders/sweeps | Batched process and repeated-process benchmark | Future worker/pool design |
| NEC import can preserve unsupported cards safely | Dialect corpus and round-trip report | Raw/structured mode boundary |
| A selected project name is legally usable | Trademark/name search before public launch | Branding/release |

Until these experiments are recorded, related statements must remain “proposed”, “candidate”, or “planned”.
