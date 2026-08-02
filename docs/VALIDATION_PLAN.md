# HF Antenna Studio — Solver and Result Validation Plan

Status: proposed verification protocol
Last reviewed: 2026-08-02

## Objective

Establish defensible evidence that the exact distributed solver build, HF Antenna Studio deck compiler, result parser, coordinate transforms, derived metrics, and plots calculate and present the supported NEC subset correctly on Windows 11.

The application must not be its own oracle. Golden files generated only by HF Antenna Studio can detect regressions but cannot establish electromagnetic correctness.

## Claims this plan can and cannot support

Passing the plan can support a bounded claim such as:

> Version X with solver build Y reproduces the reviewed reference corpus for the documented straight-wire NEC-2 subset within stated tolerances on supported Windows 11 systems.

It cannot prove that every NEC model is accurate, that a simulated antenna will equal a physical installation, that an imported dialect is fully understood, or that optimization produces a buildable optimum.

## Validation layers

### 1. Pure contract tests

Test deterministic behavior without invoking the solver:

- unit conversions and finite-number rejection;
- model schema/migrations;
- tag, segment, source, and load mapping;
- NEC numeric formatting and card ordering;
- requested frequency expansion;
- output-parser tokenization and section boundaries;
- complex impedance, SWR, dB, normalization, and phase formulas;
- theta/phi to Cartesian and compass/elevation transforms;
- 2D-cut selection and 3D seam/mesh construction;
- diagnostics and severity mapping;
- project/cache identity hashes.

Parser fixtures at this layer are syntactic data, not physical reference results, unless their external provenance is recorded.

### 2. Direct-solver adapter tests

For every candidate and released solver binary:

- invoke a committed deck directly outside the application;
- invoke the same byte-identical deck through the application adapter;
- compare raw output hashes where output is deterministic after removing approved volatile fields such as elapsed time;
- compare parsed arrays field by field;
- verify stdout, stderr, exit status, diagnostics, timeout, cancellation, and truncated/missing output handling;
- record source commit, patches, compiler/version/flags, binary SHA-256, operating system, architecture, and locale.

This isolates process and parser defects, but it still compares the integration with its own solver and therefore is not sufficient alone.

### 3. Historical/published NEC references

Use traceable decks and expected outputs from:

- the [NEC-2 user manual examples and card documentation](https://www.nec2.org/part_3/toc.html);
- original or well-documented NEC-2 example decks/output distributed with sources where redistribution permits;
- NEC2++'s regression corpus comparing its results with nec2c and historical Fortran outputs, after auditing provenance and licenses;
- independently archived `nec2d`/`nec2dXS` reference execution where legally and technically practical.

Reference artifacts must record the originating document/source version, download URL or archive identifier, license/redistribution decision, original units, solver options, and any normalization applied by the comparison tool.

### 4. Established antenna-package comparison

At least one release-blocking comparison will use [4NEC2](https://www.qsl.net/4nec2/Home.htm), recording its exact version, selected NEC engine, ground mode, segmentation, pattern grid, frequency, impedance reference, and output values. 4NEC2 is selected because it is an established NEC-oriented modelling package and exposes NEC decks/settings.

[EZNEC Pro/2+](https://www.eznec.com/) may be used as a second comparator where its model features and result definitions align. No proprietary code, artwork, help text, or disallowed result bundle will be copied. Comparator screenshots/output files will be committed only if their terms permit; otherwise reviewed scalar tables and a reproducible manual procedure will be recorded.

Agreement with an established package is evidence, not absolute truth: it may use the same underlying formulation, different Sommerfeld ground data, different gain normalization, or its own defect. Disagreements trigger investigation against raw decks, the NEC manual, convergence studies, and another implementation.

### 5. Analytic and physical sanity bounds

Use carefully bounded expectations, not fictitious exact answers:

- a thin resonant half-wave dipole in free space should approach the familiar roughly 2.15 dBi broadside directivity when losses are absent and segmentation converges;
- a quarter-wave monopole over an infinite perfect ground should exhibit the expected image-theory relationship and upper-hemisphere pattern;
- passive model power quantities must be finite and physically consistent within solver definitions;
- symmetry operations must produce expected symmetric results;
- reciprocal/passive structures should not produce unexplained negative resistance or gain discontinuities;
- SWR recomputed from complex impedance and the stated real reference impedance must equal the displayed SWR.

These checks catch gross errors but are not replacements for reference NEC output.

### 6. Convergence and sensitivity studies

For selected models, vary segment density, source segment, wire radius within valid ranges, pattern resolution, and ground settings. Record convergence trends. A single model that matches a comparator because both use the same poor segmentation is not accepted as validated.

No application rule will promise convergence automatically. The product may guide a study and flag material changes.

### 7. End-to-end release tests

Run the validated corpus through the packaged Windows application, not only library or debug builds. Verify geometry display, raw evidence, numerical tables, cuts, 3D pattern, currents, project persistence, import/export, cancellation, and diagnostics.

## Reference corpus

Every corpus case gets a machine-readable manifest containing origin, purpose, geometry, units, exact deck(s), expected quantities, comparison sources, tolerance policy, known formulation differences, and reviewer sign-off.

### Required initial cases

| ID | Model | Frequencies/ground | Validates |
|---|---|---|---|
| REF-FS-DIPOLE | Centre-fed thin half-wave straight dipole | Resonance neighborhood in free space | GW/GE/GN/EX/FR/RP/PT, impedance, ~2.15 dBi sanity, currents, segmentation convergence |
| REF-SHORT-DIPOLE | Electrically short centre-fed dipole | At least 1.8 and 14 MHz scaled cases, free space | High reactance handling, small radiation resistance, finite output, scaling |
| REF-PG-MONOPOLE | Quarter-wave vertical touching perfect ground | Resonance neighborhood | GE contact semantics, GN perfect ground, upper-hemisphere coordinates, image relationship |
| REF-RG-ELEVATED | Horizontal dipole above real ground | At least two heights and ground constants | Sommerfeld/Norton selection, lobe/elevation behavior, ground gain definitions |
| REF-RG-VERTICAL | Ground-connected vertical over real ground | HF band sample | GE/GN interaction, contact/current interpolation, ground limitations |
| REF-LOOP | Single-wire loop with defined feed gap/segment | Free space and optional perfect ground | Junctions, segment current continuity, polarization/pattern orientation |
| REF-YAGI2 | Asymmetric two-element wire array | Free space | Front/back direction, phi handedness, azimuth cut, gain maximum |
| REF-PHASED | Two driven elements with unequal source phase | Free space | Multiple EX cards, complex phase, asymmetric current/pattern mapping |
| REF-LOAD-RLC | Loaded wire with series and parallel RLC variants | Sweep across load behavior | LD 0/1 mapping, frequency response, warnings |
| REF-LOAD-Z | Fixed complex impedance load | Single and swept frequency | LD 4 mapping, complex signs and segment range |
| REF-COND | Finite-conductivity wire | HF sweep | LD 5, loss/power/efficiency definitions |
| REF-TL | Two-wire model joined by a transmission-line card | Several frequencies | TL sign, impedance, source/load mapping |
| REF-MULTIBAND | Two disjoint frequency ranges | 1.8–2 MHz and 50–54 MHz | exact FR expansion/order, parser block association, range endpoints |
| REF-CURRENT | Asymmetric multiwire model | Single frequency | current magnitude/phase and tag/segment/position mapping |

### Required invalid/limitation cases

- zero-length wire;
- zero/negative radius;
- non-finite numeric value;
- duplicate or out-of-range tag/segment references;
- source/load segment outside the wire;
- segment length too large relative to wavelength;
- segment length too small relative to radius or numerical precision;
- close/intersecting non-connected wires;
- abrupt radius change at a junction;
- wire crossing or penetrating ground unexpectedly;
- unsupported or malformed NEC card;
- conflicting/multiple control blocks not representable in structured mode;
- excessive frequency/pattern/output request;
- truncated solver output, solver nonzero exit, hang, and crash.

Expected diagnostics are part of each case. A solver crash or missing output can never be reported as a successful run with empty arrays.

## Frequency and geometry coverage

The corpus must include exact or near-boundary cases at 1.8 MHz and 54 MHz as well as representative frequencies near 3.5, 7, 14, 21, 28, and 50 MHz. Scaling a single geometry is useful but not sufficient; include physically different small/large coordinates, radii, heights, and segment counts to expose parsing and numerical scale problems.

Initial support focuses on thin straight wires. Arcs, transforms, symmetry, networks, or additional load/ground cards enter the supported matrix only when they obtain their own reference cases.

## Pattern and coordinate protocol

The run manifest states:

- theta definition and range;
- phi definition and range;
- grid endpoint inclusion and seam policy;
- requested gain quantity and polarization;
- normalization mode;
- dB floor used only for display;
- azimuth/elevation cut plane;
- 3D radial transform.

Tests include:

1. axis-vector unit tests (`theta=0` maps to +Z; known theta/phi pairs map to the expected Cartesian axes);
2. a symmetric dipole to find obvious polar rotation errors;
3. an asymmetric Yagi and phased pair to detect mirroring and 180-degree label mistakes;
4. a ground model to prove that below-ground samples are not accidentally displayed or integrated;
5. seam tests at phi 0/360 without duplicate-area integration;
6. sampled plot/table comparisons at exact grid points;
7. total/vertical/horizontal gain definition checks against raw output headings.

If interpolation is used, raw sample markers remain inspectable and interpolation is tested separately from solver data.

## Current protocol

For current-capable cases:

- compare complex real/imaginary current where available, not magnitude alone;
- verify magnitude and phase derivations, degrees/radians, phase wrap, and reference;
- bind samples by wire tag and one-based solver segment before mapping to stable project segment identifiers;
- compare centre and end-segment behavior with raw output;
- test multiple wires with repeated local segment numbers;
- state whether displayed current is peak, RMS, normalized, or absolute under the solver convention;
- never interpolate across an electrical junction without an explicit visualization rule.

## Impedance, SWR, power, and efficiency protocol

Resistance and reactance are read from the documented solver input-impedance fields. The sign of reactance must be retained.

For a real positive reference impedance `Z0`, recompute:

```text
Γ = (Z - Z0) / (Z + Z0)
SWR = (1 + |Γ|) / (1 - |Γ|)
```

Handle `|Γ| >= 1`, zero/negative resistance, non-finite values, and rounding explicitly. The UI must not compare against a hidden 50-ohm reference when another value is selected.

Efficiency is accepted only after its source quantity is defined. Prefer a solver power budget when the implementation documents it. If pattern integration is used, validate solid-angle weighting, endpoint treatment, gain type, ground hemisphere, and normalization against power-budget cases. Do not cap unexplained values at 100% and call the calculation valid; an out-of-range result should create a diagnostic.

## Preliminary comparison tolerances

Tolerances are established per case after inspecting reference precision and formulation. The following are starting review thresholds, not permission to ignore a systematic discrepancy:

| Comparison | Preliminary threshold |
|---|---|
| App adapter vs direct invocation of exact same binary/deck | Parsed source/impedance fields within text-rounding precision; discrete fields exact |
| Repeated exact binary/deck on same platform | Identical numeric records after approved volatile metadata normalization |
| Complex impedance vs independent NEC reference | `max(0.5 Ω, 1% of magnitude)` per R and X for well-conditioned cases |
| Far-field gain at matching grid samples | 0.10 dB for free-space/perfect-ground cases; ground cases may receive a separately justified threshold |
| Direction of maximum/null | One requested angular grid interval, with interpolation evaluated separately |
| Complex segment current | 1% magnitude and 1 degree phase away from near-zero current; explicit absolute tolerance near zeros |
| Sweep vs separate single-frequency runs with same solver | Text-rounding precision at common frequencies |

A tolerance can be widened only with a written cause such as output rounding, known ground-kernel data differences, or documented implementation formulation. It cannot be widened merely to make a candidate pass. Near singularities, deep nulls, resonance crossings, and near-zero currents need absolute/error-domain rules rather than naive relative error.

## Comparator procedure

For each established-package comparison:

1. Begin from the same reviewed NEC deck where possible, not two independently redrawn models.
2. Record application version and solver engine/version selected by that application.
3. Record any import warning or automatic segmentation/edit made by the comparator.
4. Match frequency, ground constants/model, wire loss, source voltage/phase, loads, reference impedance, angular grid, polarization, and normalization.
5. Export or transcribe raw numeric tables at predefined sample points; do not estimate values from plot pixels.
6. Have a second reviewer check settings and transcription for release-blocking cases.
7. Store a hash of source deck and permitted output artifacts.
8. Explain differences before approving the case.

The comparison report must not claim 4NEC2 or EZNEC is an infallible oracle, nor imply endorsement.

## Import/export validation

Three distinct properties are tested:

- **Text preservation:** unchanged raw-mode documents retain all cards/comments/ordering except explicitly normalized line endings if documented.
- **Semantic round trip:** supported structured import followed by export produces a deck with the same solver meaning and matching results.
- **Diagnostic completeness:** every unsupported, malformed, dropped, defaulted, clamped, or transformed item is listed before conversion.

For semantic testing, run original and exported decks through an accepted solver and compare results. This is a regression/interoperability check; external reference cases are still needed for physical validation.

## Windows, offline, and privacy validation

Release matrix initially covers supported Windows 11 x64 versions on:

- a clean disconnected VM without developer tools;
- a normal user account without elevation for ordinary use;
- paths containing spaces and non-ASCII characters;
- representative low- and high-DPI displays/graphics adapters;
- representative endpoint protection settings.

Tests verify:

- installation with network physically disabled;
- correct WebView2 strategy without a runtime download;
- solver launch, cancellation, timeout, and cleanup;
- no listening port and no network requests during install/ordinary modelling unless a future explicitly optional feature is enabled;
- local files remain in selected paths and documented application-data/temp locations;
- uninstall/reinstall/upgrade behavior does not delete user projects;
- packaged assets and help render offline.

## Performance and robustness characterization

Performance thresholds will be set after Phase 0 measurement. Record at minimum:

- solver process startup;
- deck generation and parsing time;
- peak memory and output size;
- UI first interaction and frame rate for representative geometry/pattern sizes;
- cancellation latency;
- 1°, 2°, and 5° pattern grids;
- sweeps of 1, 11, 101, and the proposed maximum number of frequencies;
- segment counts spanning normal use to the proposed cap.

Limits are based on worst acceptable release hardware and solver behavior, not copied from AntennaSim's differing frontend/backend caps.

Fuzz/property tests target the NEC document parser, project JSON parser, result parser, numeric formatting, and coordinate transforms. Solver fuzzing is separately sandboxed by job limits and is not run on arbitrary user machines.

## Evidence storage and review

Each generated validation report identifies:

- application commit and build;
- solver source/build/binary hashes;
- operating-system/runtime details;
- corpus manifest commit;
- exact input/output artifact hashes;
- comparison formulas and tolerance version;
- pass/fail/deviation for every metric;
- reviewer and review date.

Golden updates require a pull request showing numeric diffs and provenance. “The code changed” is not a reason to update expected values. Generated reports are reproducible artifacts; hand-edited summaries link to them.

## Release blocking rules

A release is blocked by:

- an unexplained reference/comparator deviation;
- missing or misclassified solver diagnostics;
- an incorrect coordinate direction, plot cut, current mapping, or impedance/SWR derivation;
- a supported import that silently changes semantics;
- a Windows offline/privacy failure;
- missing solver/source/license provenance;
- a validation corpus generated solely by the application under test.

An accepted limitation must be narrow, visible to users, documented in the supported-feature matrix, and accompanied by a regression test. It is not silently reclassified as success.
