# HF Antenna Studio — Product Vision

Status: planning baseline, 2026-08-02
Audience: contributors, maintainers, testers, and technically informed radio amateurs

## Purpose

HF Antenna Studio will be a modern, open-source antenna modelling application for Windows 11. It will combine a locally installed HTML/JavaScript user interface with a real, independently validated NEC-family electromagnetic solver. The initial frequency range is approximately 1.8–54 MHz and the initial modelling focus is wire antennas.

This document describes intended outcomes, not implemented capabilities. At this planning milestone, HF Antenna Studio has no application code and no solver has passed the project's acceptance suite.

## Product promise

The application should let an operator build or import an antenna model, inspect it in interactive 3D, run it without sending the design off the computer, and understand both the calculated result and the limits of that result.

The product will prioritize:

- trustworthy calculations over feature count;
- explicit modelling assumptions over silent correction;
- an offline, private-by-default workflow;
- reproducible results, including solver identity and input provenance;
- clear warnings when a model is outside NEC's reliable operating assumptions;
- conventional antenna-engineering plots and coordinate definitions;
- portable NEC interchange without claiming lossless conversion when cards are unsupported.

Usability may be inspired by the workflows of AN-SOF, 4NEC2, and EZNEC, but the project will not copy proprietary code, algorithms, branding, interface artwork, documentation text, or other copyrighted assets.

## Intended users

- Radio amateurs designing HF and 6 m wire antennas.
- Experimenters comparing geometry, ground, loading, and feed arrangements.
- Educators who need visible geometry, currents, and radiation patterns.
- Advanced users who want to inspect or exchange NEC decks and raw solver output.
- Contributors building parameter sweeps and, later, optimization workflows on a validated calculation core.

The first releases will not attempt to replace specialist professional electromagnetic tools.

## Planned product scope

### Initial validated release

The first generally usable release is intended to provide:

- local installation and execution on supported Windows 11 systems;
- a bundled HTML/TypeScript user interface that does not depend on an internet connection after installation;
- local-only project and result storage, with no telemetry or mandatory account;
- wire geometry creation and an interactive 3D view;
- NEC-file import and export with visible compatibility diagnostics;
- native project save/load with schema versioning;
- one or more voltage sources and the load types admitted by the chosen solver subset;
- free space, perfect ground, and documented real-ground models;
- single-frequency calculation and bounded linear frequency sweeps;
- impedance, resistance, reactance, SWR, far-field cuts, a 3D far-field view, and segment-current magnitude and phase;
- raw generated NEC input, raw solver output, solver build identity, and calculation warnings available for inspection;
- validity checks for segmentation, wire radius, wavelength, geometry connectivity, ground contact, source placement, and other applicable NEC constraints.

Each item remains planned until its test and validation gate is recorded as passing.

### Later scope

- Named parameters and interactive sliders that regenerate a model deterministically.
- Multi-dimensional parameter sweeps with cancellable jobs and reproducible caches.
- Optimization with explicit objectives, constraints, bounds, and result verification.
- Additional geometry cards and solver backends where licensing and validation permit.
- Optional alternate local packaging or a browser/Wasm execution mode if it meets the same numerical and warning-preservation requirements.

Optimization will not be enabled merely because a solver can be called repeatedly. It depends on stable model generation, convergence tests, constraint handling, cancellation, provenance, and independent validation.

## Explicit non-goals for the first release

- Inventing a new electromagnetic solver.
- Claiming full-wave accuracy for arbitrary structures, materials, frequencies, or environments.
- Cloud calculation, cloud project storage, collaboration accounts, or analytics.
- Mobile support, macOS support, or Linux packaging at the expense of Windows 11 reliability.
- Importing every NEC dialect without qualification.
- Silently approximating unsupported geometry or command cards.
- Copying the visual identity or workflow details of a proprietary antenna application.
- Treating an attractive 3D pattern as proof of numerical correctness.

## User experience principles

### Progressive technical depth

A new user should be able to create a simple dipole without learning the complete NEC card language. An expert should be able to inspect the exact deck, solver command, raw output, coordinate convention, ground parameters, and derivation of displayed values.

### No silent model mutation

Imports, unit conversions, segment changes, source relocation, and unsupported cards must produce explicit diagnostics. If a deck cannot be represented safely in the structured editor, the application will retain a raw-deck mode or refuse conversion; it will not quietly drop data.

### Warnings are results

Solver diagnostics and application validity checks are part of a simulation result, not transient log noise. They will be stored with the result, categorized by source and severity, and shown before an apparently precise plot.

### Coordinates are a contract

The internal convention will follow NEC: Cartesian geometry in metres; theta measured from +Z; phi measured in the XY plane from +X. Compass bearings and elevation-above-horizon are presentation transformations with tested labels. Azimuth plots will state the theta/elevation plane used, and elevation plots will state the phi/bearing plane used.

### Reproducibility by default

A saved result should identify the project schema, generated NEC input hash, solver name/version/binary hash, relevant solver build options, application version, units, frequency list, and warnings. Cached results must never be confused with results from a different solver build or input deck.

## Privacy and offline requirements

For the initial product:

- simulation is performed by a process on the user's computer;
- projects are read and written only at paths the user selects, apart from documented local preferences and temporary job files;
- the installed application makes no network request during ordinary use;
- no telemetry, crash upload, remote fonts, CDN scripts, or mandatory update check is included;
- installation media includes, or clearly and verifiably provisions, every runtime needed for an offline Windows 11 installation;
- temporary solver files are isolated per job and removed on normal completion, with a documented recovery/cleanup policy after crashes.

An optional update mechanism may be considered later, but it must be opt-in or explicitly configured and must not be required for modelling.

## Accuracy position

HF Antenna Studio will use a maintained or well-characterized open-source NEC implementation behind a replaceable solver adapter. A solver's ancestry or reputation is not enough: the exact distributed binary, deck generator, parser, coordinate mapping, and plots must pass the validation plan.

Results will be described as calculated estimates within the assumptions of the selected NEC formulation. The application will explain common limitations, including thin-wire approximations, segmentation sensitivity, very short or thick segments, close-spaced wires, junction geometry, loads, ground-model limitations, structures near interfaces, numerical convergence, and the difference between an idealized model and a built antenna.

No feature will be labelled “validated” until the applicable test evidence has been reviewed and recorded. Agreement with the application itself is not independent validation.

## Product-level acceptance criteria

The first validated release requires all of the following:

1. A clean Windows 11 installation succeeds without an internet connection using the release installer and documented prerequisites.
2. Ordinary use generates no network traffic in an instrumented offline/privacy test.
3. The selected solver binary and integration pass the numerical acceptance suite in `VALIDATION_PLAN.md` on supported Windows 11 configurations.
4. The suite includes published or traceable NEC reference cases and comparison with at least one established antenna package, not just snapshots generated by HF Antenna Studio.
5. Geometry, current, azimuth/elevation, and 3D-pattern coordinate tests pass with known asymmetric models.
6. Supported NEC imports round-trip semantically; unsupported or altered cards are retained or reported without silent loss.
7. Every calculation exposes raw input, raw output, solver provenance, and diagnostics.
8. Frequency sweeps can be cancelled, cannot freeze the interface, and retain the requested frequency ordering and provenance.
9. License, source, attribution, third-party notices, and reproducible build obligations are satisfied for the shipped bundle.
10. No release documentation claims an untested feature works.

## Open assumptions

The following require experimental verification and are tracked in the solver evaluation, roadmap, and risk register:

- that a chosen `nec2c` build can be produced, redistributed, installed, and run reliably on supported Windows 11 machines;
- whether native `nec2c` or NEC2++ gives the better maintainability and diagnostic behavior after equivalent-deck testing;
- whether the selected ground-card formulation and ground-connected-wire handling agree with reference cases;
- acceptable workload limits for geometry, pattern angular resolution, and frequency sweeps on representative hardware;
- whether an embedded or offline-installed WebView2 runtime is the most reliable packaging choice;
- whether security products flag the child solver process or temporary NEC files;
- the precise supported NEC import subset and dialect policy;
- numerical tolerances appropriate to each reference family;
- distribution-license provenance for the exact solver source and binary;
- whether the project name presents any trademark conflict.

These are gates, not presumed facts.
