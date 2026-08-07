# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Added a minimal Windows 11 Tauri 2 host and per-user NSIS packaging workflow that embeds the production HTML interface and pinned nec2c/WebAssembly solver without Node.js, Python, Docker, or a separate NEC install for end users
- Added local-only CSP/capability boundaries, synchronized package-version checks, bounded native diagnostic logs, About-page runtime/log information, deterministic icon generation, preferred small and optional fully offline WebView2 installer configurations, and `docs/WINDOWS_PACKAGING.md`
- Added clean Windows-runner acceptance covering installer registration, launcher startup, installed-app package identity, a real offline WebView2 dipole calculation, external-request rejection, log creation, uninstall, preserved user data, checksums, and a 14-day distributable test artifact

- Added a systematic validation campaign covering a free-space dipole, dipole over ground, quarter-wave vertical, full-wave square loop, delta loop, two- and three-element Yagis, and broadside/end-fire two-element phased vertical arrays
- Added a SHA-256-pinned machine-readable reference manifest, exact dipole fixtures, application-deck identity tests, a fail-closed unified Windows comparator runner, and 16 exact-deck executions through a separately installed 4NEC2 NEC-2D build
- Added `docs/VALIDATION_REPORT.md` with complete model/settings/result records, signed differences, honest discrepancy classifications, investigation notes, unresolved release gates, and reproducible commands; no RF calculation behaviour was changed because no new calculation bug was confirmed

- Added an original Windows-first Simulator workbench with independently resizable/collapsible model-input, geometry, calculated-summary, and analysis regions; compact tablet/mobile layouts mount only one WebGL viewer
- Added explicit result-currency and input-condition summaries, modelling/solver diagnostics, contextual help, keyboard panel shortcuts, accessible resizers/tabs/dialogs, locally rendered light/dark design tokens, browser usability coverage, and `docs/UI_OVERHAUL.md`

- Added a browser-local project library with New, Save, Save As, Open/recent, automatic named-project saves, separate crash-recovery journalling, duplicate, rename, confirmed delete, and `.hfas` import/export without a cloud account
- Added immutable schema 1-4 migration review, future-schema rejection, optimistic revision conflicts, atomic local collection replacement, unload recovery, explicit simulator sweep persistence, lifecycle/browser regression coverage, and `docs/PROJECT_FILE_FORMAT.md`

- Added experimental Touchstone `.s1p` measurement comparison with bounded RI/MA/DB S11 import, immutable source-line provenance, derived SWR/R/X, and explicit SIMULATION versus MEASUREMENT labelling
- Added exact-frequency and labelled simulation-only linear R/X alignment, no extrapolation, reference-impedance mismatch gating, overlay/difference plots, aligned tables, CSV/project export, NanoVNA format guidance, and real-Wasm browser coverage

- Added an experimental bounded antenna optimiser for one or two declared dipole, vertical, Yagi, or phased-array parameters using the unchanged family NEC pipelines
- Added seven selectable objective modes, weighted raw-unit scoring, RF constraints, deterministic coordinate-pattern search, progress/cancellation, exact-model caching, retained best-found models, history and start/final comparisons
- Added complete optimisation JSON evidence, cautious non-global claims, simple known-task/unit coverage, real-Wasm dipole/Yagi browser runs, and `docs/ANTENNA_OPTIMISER.md`

- Added bounded one-dimensional and two-dimensional parameter sweeps for dipole height/length, vertical length/radial count, Yagi director spacing/height, and phased-array spacing/phase
- Added sequential cancellable worker orchestration, exact-model LRU caching, 81-job protection, metric line plots, numeric heat maps, full point lineage, and versioned local reproducibility JSON export
- Added pure grid/model/cache/cancellation/evidence tests, real-Wasm dipole and vertical browser studies, and `docs/PARAMETER_SWEEPS.md`

- Added a four-slot model-comparison laboratory for dipole height, explicit-radial verticals, ideal-current phased-array phase, and three-element Yagi height under shared frequency, ground, reference-impedance, cut-plane, and sweep conditions
- Added condition-safe compass-coordinate azimuth/elevation overlays, side-by-side gain/take-off/F-B/beamwidth/R/X/SWR metrics, three-family batched impedance sweeps, stale-result warnings, cancellable sequential calculation, and standalone offline HTML reports with exact NEC evidence
- Added four-state example presets, stop-frequency segmentation warnings, pure comparison/report tests, and real-Wasm mixed-family browser coverage
- Added `docs/MODEL_COMPARISON.md` with metric definitions, compatibility rules, solver lineage, report contents, critical review, and validation limitations

- Added a shared segment-resolved NEC current visualisation for the Simulator, Wire Editor, verified dipole, vertical, loop/quad/hex, Yagi, and phased-array workflows, with magnitude, phase, combined, and slowed per-segment phasor modes
- Added exact wire/tag and segment inspection with parsed XYZ position, engineering current units, phase, accessible selection, explicit normalised-scale legends, and five-family real-Wasm browser coverage
- Added `docs/CURRENT_VISUALISATION.md` with data lineage, coordinate/animation semantics, evidence limits, test coverage, and outstanding complex-current validation work

- Added a local virtual frequency analyser for the current Simulator antenna with start/stop and centre/span entry, Region 1 band presets, 3–401 points, configurable reference impedance, exact cursor inspection, six impedance/match traces, an optional Smith chart, and four saved overlays
- Added an impedance-only NEC sweep path using one batched `FR` card and `XQ` execution in the cancellable Web Worker, avoiding per-frequency far-field grids while retaining the established output parser and preventing partial or superseded result publication
- Added CSV, active-chart PNG, and versioned analyser project-data exports plus calculation, deck, parser-contract, failure, cancellation, real-Wasm, overlay, download, and browser-console regression coverage
- Added `docs/FREQUENCY_ANALYSER.md` with formulas, solver execution, evidence boundaries, export contracts, and unresolved independent-validation and usability checks

- Added a reusable arbitrary-wire editing completion pass with numeric XYZ geometry, source/load placement, selection translation and centroid rotation, explicit all-axis mirror-copy controls, object-list source/load markers, NEC coordinate/scale labels, and existing 3D drag/snap/connect/split/duplicate/undo workflows retained alongside templates
- Added a loss-aware NEC document import gate that retains the browser-decoded original source text and ordered card diagnostics, converts the published GW/GE/EX/LD/TL/GN/FR subset without clamping or source invention, preserves GE ground-contact semantics, blocks unsupported solver-significant cards, and distinguishes Original NEC from supported-state Generated NEC export
- Added duplicate-tag, disconnected-group, partial-overlap, interior-intersection, ground-crossing, segmentation, source, load, and transmission-line validity checks plus exact/semantic parser round-trip, transform/undo, native-project, browser, and real-solver regression coverage
- Added `docs/WIRE_EDITOR.md` with the coordinate/edit contract, NEC card matrix, data-loss boundary, validation behavior, evidence scope, and limitations

- Added a two-element phased vertical-array laboratory with configurable SI geometry, metres/wavelength spacing, compass bearing, ideal-current and physical-feed modes, perfect/real ground, explicit radials, immediate 3D geometry, phasor/current views, debounced patterns, automatic phase sweep, and four saved overlays
- Added coupled-port admittance calibration that converts ideal target currents into NEC voltage sources and rejects final patterns when parsed complex currents do not verify; physical mode instead uses one source junction and explicit ideal `TL` cards with solved currents and input impedance
- Added stable circular beam-heading plateau centring, explicit forward/reverse and front-to-back/front-to-rear metrics, non-grazing 2-degree patterns, exact deck inspection, line-length/VF/delay conversions, shunt terminations, topology and validity warnings, and stale-result suppression
- Added broadside and forward/reversed end-fire exact-deck fixtures that pass a separate 4NEC2 NEC-2D comparison, plus model/adapter/matrix/result/failure/cancellation/browser/mobile/keyboard/overlay/phase-sweep tests and `docs/PHASED_ARRAYS.md`

- Added a dedicated loop and compact-beam laboratory for square, delta, and diamond loops, two-to-four-element cubical quads, and single-band broadband-style hexbeams on 20/17/15/12/10 metres
- Added explicit generated wire paths and non-conducting hex supports, exact one-segment feed bridges, three delta feed regions, immediate 3D geometry, debounced/cancellable NEC solves, exact-deck inspection, 2D/3D patterns, impedance/SWR/gain/take-off metrics, and every-wire current magnitude/phase
- Added derived feed-conductor orientation without inferring polarisation from antenna names, plus explicit +Y front/back metrics only for the directional quad and hex families
- Added five perfect-ground exact-deck fixtures and a reproducible independent 4NEC2 NEC-2D comparison, with geometry/connectivity/feed/segmentation/result/failure tests and real-solver browser coverage for every family
- Added `docs/LOOP_AND_HEXBEAM_MODELS.md` with topology, dimension provenance, numeric evidence, review findings, limitations, and remaining family-specific validation gates
- Added a dedicated 2-to-8-element Yagi beam laboratory with independent reflector/driven/director dimensions and spacings, height, diameter, perfect/real ground, amateur-band starting presets, and explicit 50/75-ohm SWR reference
- Added immediate orbitable array geometry, debounced/cancellable NEC calculation, exact-deck inspection, azimuth/elevation/3D patterns, every-element current magnitude/phase, and four immutable comparison overlays
- Added explicit +Y forward-axis metrics for forward/rear gain, separate front-to-back and front-to-rear ratios, interpolated azimuth beamwidth, take-off angle, feed impedance, and SWR
- Added exact 2/3/5-element perfect-ground fixtures that pass a separate 4NEC2 NEC-2D same-deck comparison, plus a scaled NBS/NIST three-element pattern sanity case
- Added Yagi model/adapter/result/failure/debounce/cache tests and real-solver browser coverage for rapid sliders, comparisons, validity, mobile layout, keyboard controls, 3D/current views, and console errors
- Added `docs/YAGI_BEAMS.md` with coordinate/metric definitions, independent numeric evidence, RF review findings, provenance, limitations, and remaining validation gates
- Added a dedicated vertical-antenna laboratory for ideal ground-mounted monopoles, elevated explicit-radial systems, and NEC's separate reflection-coefficient radial-screen approximation
- Added interactive SI-backed controls for amateur-band frequency, radiator dimensions, feed height, radial count/length/diameter/droop, ground conductivity/permittivity, metric/imperial display, and 50/75-ohm SWR reference
- Added exact NEC-deck inspection, interactive geometry and 3D pattern views, polar elevation/azimuth cuts, impedance/SWR/gain/take-off results, and per-wire current magnitude/phase displays
- Added strong configuration, ground-clearance, geometry, thin-wire, feed-junction, and segmentation validity diagnostics for vertical models
- Added 40/20/10-m exact-deck regression fixtures and a reproducible independent comparison against the locally installed 4NEC2 NEC-2D engine, plus an explicit-wire equivalent of NEC-2 User's Guide Example 10
- Added vertical-model, NEC-adapter, parser/current-mapping, real-solver, radial-count/height, ground-mode, mobile, unit, invalid-model, and browser-console regression coverage
- Added `docs/VERTICAL_ANTENNAS.md` with ground-model distinctions, numeric evidence, RF review findings, provenance, limitations, and remaining convergence/real-ground validation gates
- Added a reusable declarative antenna-template registry and one common workbench for horizontal dipole, inverted-V, sloper, quarter-wave vertical, ground-plane vertical, full-wave loop, delta loop, and square loop models
- Added an SI-only shared template model with typed parameters, display units/ranges, geometry/feed/load/ground contracts, amateur-band presets, frequency-linked starting dimensions, explicit manual override, validation rules, and shared odd-segment recommendations
- Added exact generated NEC inspection and local-solver results through one adapter, plus immediate interactive 3D geometry, metric/imperial controls, and ground presets
- Added geometry, feed, segmentation, NEC, load, solver, UI-range, live-regeneration, mobile-width, invalid-model, unit-invariance, and eight-template numeric regression coverage
- Added `docs/ANTENNA_TEMPLATE_SYSTEM.md` with contract details, RF/adversarial review, regression evidence, claim limits, and external validation work still required
- Added an interactive dipole-height laboratory with immediate side/3D geometry, debounced local NEC calculation, polar azimuth/elevation plots, an orbitable 3D radiation surface, absolute/normalised scales, height/frequency/ground controls, and educational pattern labels
- Added up to four labelled comparison traces, five wavelength-height presets, an automatic sweep animation, PNG/CSV export, reset, keyboard operation, and responsive mobile layout
- Added cancellation at the synchronous Wasm worker boundary, stale-result suppression by exact SI model identity, and a bounded result cache
- Added rapid-slider, cancellation, cache, units, pattern, comparison, export, animation, mobile, accessibility, real-solver validation, and full regression coverage for the height lab
- Added a dedicated verified centre-fed horizontal dipole workflow with SI-domain types, m/mm/ft/in display conversion, perfect/real/free-space ground, 50/75-ohm SWR, exact generated NEC, 2D patterns, and current magnitude/phase
- Added a byte-identical raw-deck worker route so the NEC model shown in the verified workflow is the model executed by local nec2c/WASM
- Added safe odd-segment selection and visible thin-wire, geometry, ground-clearance, and segmentation diagnostics based on NEC-2 modelling guidance
- Added unit, adapter, parsing/result, failure, timeout, browser-console, six-geometry regression, and published external NEC-2 validation coverage
- Added `docs/VERIFIED_DIPOLE.md` with the pipeline, numeric evidence, claim limits, and unresolved established-package/ground validation work
- Applied the HF Antenna Studio product name to the local application shell and page metadata while retaining upstream provenance in documentation
- Added a reproducible Windows 11 browser-local baseline with pinned Node, npm, Emscripten, and NEC2C versions
- Added a guarded PowerShell build path for the pinned NEC2C WebAssembly solver
- Added Playwright real-solver smoke tests for the existing dipole, vertical, and Yagi examples, including 2D/3D rendering and SWR/impedance checks
- Added `docs/BASELINE.md` with exact installation, solver execution, known limitations, review evidence, and regression boundaries

### Changed

- Replaced the four 3D compass labels' runtime font worker/CDN fallback with local canvas textures so strict-CSP Windows packages render them offline without generating an unhandled worker error

- Replaced the legacy wire-average “Flow” particles with animation derived independently from each parsed NEC segment-current phasor, avoiding an unsupported travelling-current implication

- Updated compatible frontend dependencies and declared the directly imported `three-stdlib` package
- Made Wasm development and production commands cross-platform on Windows and Unix-like systems
- Extended CI to build the real Wasm solver before running browser smoke tests

### Fixed

- Limited generated Yagi `GW` cards to the classic NEC 80-column input constraint after an independent NEC-2D comparison exposed a cross-engine portability failure
- Prevented the NEC radial-screen approximation from being combined with the incompatible Sommerfeld/Norton ground option; the generated model now uses `GN 0` plus `RP 4` and labels the formulation explicitly
- Corrected element-current position mapping for NEC output whose segment numbers are absolute across tags, restoring the radial current trace
- Corrected the ground-mounted quarter-wave template to use explicit NEC touching-ground geometry at `z = 0` with a perfect-ground default, and made the polygonal full-wave loop feed symmetric at bottom centre
- Filtered nec2c's ordinary stderr usage banner so it is not presented as a modelling warning while retaining warning/error lines
- Added explicit simulation-worker handling for crashes, unreadable messages, startup failures, and a 120-second timeout
- Removed two safe React effect warnings without changing calculation behavior

### Security

- Reduced the clean-install audit from 12 vulnerabilities to two entries for one React Router RSC-mode advisory; the client-only SPA does not use the affected RSC/server-action path, and the offered forced downgrade was not applied

## [1.4.2] - 2026-07-31

### Added

- Added tested geometry primitives for closest-point wire spacing, per-axis offsets, and orientation-independent wire angles
- Added shared mouse/touch wire selection, selected-wire highlights, and 3D closest-point axis guides to both viewport renderers
- Added a responsive Measure control to the Simulator and Wire Editor with unit-aware results, clear instructions, and built-in usage help (#76)
- Added closest, farthest, and explicit endpoint-pair measurement modes with labeled endpoints and an in-scene acute-angle arc for unambiguous wire comparisons (#76)

### Fixed

- Kept the angle guide anchored at the wires' closest approach when switching endpoint measurement modes, including at shared fan-antenna feed points (#76)
- Prevented viewport endpoint badges from clipping or wrapping and preserved each wire's color when labels share a point (#76)
- Hid the in-scene angle guide for parallel wires while retaining the numeric 0.0° result in the measurement panel (#76)
- Made closest-point calculations scale-invariant so millimetre-scale crossing and spacing measurements remain accurate (#76)
- Extracted tested angle-guide and endpoint-label geometry while avoiding unnecessary hit-target rebuilding and explicitly disposing replaced Three.js resources (#76)
- Isolated Wire Editor shortcuts and excitation picking during measurement mode so editing commands cannot mutate geometry unexpectedly (#76)
- Improved measurement panel accessibility with a labelled section, focused live-result announcements, associated help controls, and more legible mobile text (#76)
- Hid decorative 3D endpoint and angle annotations from assistive technology so the structured measurement summary remains authoritative (#76)
- Added regression coverage for point-like wires, collinear and oblique endpoint clamping, reversed angle axes, and fully coincident endpoint labels (#76)

## [1.4.1] - 2026-07-30

### Added

- Added Touchstone `.s1p` export for using simulated frequency sweeps in VNA and external RF analysis software

## [1.4.0] - 2026-07-19

### Added

- Added tested endpoint and junction geometry primitives for precise editor connection tools
- Added undo-safe editor state for endpoint snapping and persistent junction locks, including connection-aware coordinate edits, transforms, and wire-shaping tools
- Added ordered endpoint picking with responsive Snap, Keep Length, Lock, and Unlock controls; matching S, Shift+S, and J shortcuts; connection feedback; and junction-aware drag gestures
- Added junction persistence to `.antennasim` editor projects with schema validation and automatic compatibility for schema v1 files
- Added endpoint-origin wire creation in Add mode, including larger touch targets, live wire previews, optional endpoint-to-endpoint creation, and automatic junction locking
- Added prominent Wire Editor navigation and responsive Simulator invitations so custom-geometry tools are discoverable on desktop and mobile

### Fixed

- Kept locked junction members together when wire lengths are edited numerically, while respecting length locks on adjacent wires
- Ensured a complete endpoint or wire drag is stored as one undoable gesture instead of one history entry per pointer movement

## [1.3.1] - 2026-07-19

### Fixed

- Included the canonical changelog in frontend Docker build contexts so the in-app version history builds in standalone, all-in-one, and development images, while keeping unreleased development notes out of the released-version list

## [1.3.0] - 2026-07-19

### Added

- Added a responsive “What’s new” dialog with desktop and mobile reopen controls, an expandable history of every release back to the initial public version, and 30-day local dismissal storage so the same changelog does not repeatedly interrupt returning users

### Fixed

- Aligned frequency validation, templates, and MMANA/NEC imports across the REST backend and browser/WASM engine at 0.1–2000 MHz, replacing stale 500 MHz converter and sweep limits
- Made antenna geometry, feedpoints, current overlays, patterns, ground aids, and camera framing scale with antenna dimensions; thick wires no longer hide feedpoints, and large low-frequency antennas are framed after controls initialize
- Scaled scene fog with antenna dimensions so very large low-frequency antennas no longer fade into the background
- Allowed shared slider headings and unit selectors to wrap cleanly on narrow mobile screens

### Changed

- Wire Editor design-frequency controls now reach 2 GHz; numeric fields preserve stored precision, millimeter snap increments are available, and new-wire size follows the design frequency
- Added explicit, shared length-unit selectors to Editor and Simulator controls, following the global preference with m/cm/mm choices in metric mode and ft/in choices in imperial mode while preserving canonical meter values internally
- Height sliders now change scale only when the user selects a unit, using a predictable 1–100 range in meters, centimeters, millimeters, feet, or inches

## [1.2.2] - 2026-06-01

### Fixed

- README API reference documented the simulate request body with the wrong keys — `ground.type` (the API expects `ground_type`) and `excitations[].real`/`.imag` (the API expects `voltage_real`/`voltage_imag`). Submitting the documented payload silently fell back to default ground/voltage. Corrected the example to match the API (#61)

### Changed

- Simulate request models now reject unknown/misspelled fields with a 422 validation error instead of silently ignoring them and using defaults (e.g. `ground: { "type": ... }` now errors clearly instead of defaulting to average ground) (#61)
- Reorganized documentation: trimmed the README to a quick-start front page and moved the detailed usage, development, deployment, and API guides into a new `docs/` folder with an index. Refreshed the landing page with live badges (stars, Docker pulls, Pages deploy), a value-prop hook, and a prominent "Launch the live demo" button

## [1.2.1] - 2026-06-01

### Fixed

- Azimuth radiation pattern was rotated relative to the 3D viewport and compass — the polar plot drew NEC phi angles directly under the N/E/S/W labels, so a north-firing antenna appeared to point east. The azimuth cut now maps NEC phi to compass bearing so the trace lines up with the cardinal labels and the 3D viewport
- -3 dB beamwidth was reported incorrectly (near 360°) for lobes pointing North after the azimuth orientation fix, because the main lobe straddles the 0°/360° seam and its span was measured with a plain min/max. Lobe angles are now unwrapped before the span is measured, restoring the correct beamwidth

## [1.2.0] - 2026-05-30

### Added

- Transmission-line feeders (and other non-radiating structures) now render as dashed lines in the 3D viewport, in both the Simulator and the Wire Editor — so antennas whose feeders are modelled as transmission lines (G5RV, log-periodic) no longer show a feedpoint floating disconnected from the antenna

### Changed

- Antenna templates can now declare lumped loads (`generateLoads`) and multiple/phased excitations (`generateExcitation` may return an array), enabling antennas that need tuning capacitors or phased feeders. The Simulator now runs through the unified advanced engine path; existing single-excitation templates are unaffected (verified identical results)

### Fixed

- Moxon Rectangle template produced grossly oversized elements (~1 wavelength wide instead of ~0.37λ), causing SWR >99 across the band. Replaced the dimension formulas with L.B. Cebik's (W4RNL) MoxGen regression equations and corrected the full-width vs. half-width handling (#63)
- End-Fed Half-Wave template stretched the radiating wire when the far-end height was changed (horizontal span was fixed at the half-wave length), making the conductor longer than λ/2 and shifting resonance below the band. The wire is now held at a fixed half-wave length and the far end tilts as a sloper, restoring resonance near the design frequency (SWR at design drops from ~3.9 to ~1.5 for the default 40m design)
- Fan Dipole template was only usable on its lowest band — 20m and 10m showed very high SWR. Three issues: (1) every element shared a single center node with the source on the longest element, so only that dipole was driven differentially while the others hung off the feed as quasi-parasitic stubs; (2) applying the fan spread stretched each element beyond its resonant length; (3) the end-effect shortening placed the coupled elements above their bands. Now all left/right halves connect to two feed terminals bridged by the driven segment (every dipole is fed across its center), each arm stays a fixed length while the spread only tilts it, and the element length compensates for fan coupling. Verified with nec2c: 20m SWR ~14→2.3 and 10m ~27→1.9 at band center for the default design
- Small Magnetic Loop template never resonated — it had no tuning capacitor and was fed directly (a directly-fed small loop is <1Ω, so SWR pegged near infinity). It now models a closed main loop with a series tuning capacitor (computed from the loop inductance) plus a fed Faraday coupling loop, with two controls: Coupling Loop Size (sets the feed resistance) and Capacitor Tuning (peaks resonance on frequency). Verified with nec2c: SWR ~500 → ~1.4 at resonance for the default design. Also corrected the feedpoint marker to use NEC coordinates
- G5RV template modelled the 450Ω open-wire matching section as a single radiating wire, giving the wrong impedance (~99:1 SWR by default). It now models a single dipole wire fed at its center segment through a 450Ω transmission line (with the line's velocity factor applied to the electrical length) to a coax stub. Verified with nec2c: ~1.9:1 on 20m (the G5RV's design band) with realistic per-band behaviour elsewhere
- Log-Periodic Dipole Array template only fed the front element, leaving the rest as floating parasitics — it was not a working LPDA. It now models the proper transposed phase-line feeder: a Carrel-designed feeder characteristic impedance, crossed (transposed) transmission lines between element centers, a shorted rear termination stub, and an element range extended past both band edges. Verified with nec2c: ~11 dBi forward gain and SWR mostly under 2 across 14–30 MHz. Also relaxed the backend transmission-line impedance constraint to allow a negative characteristic impedance, which is NEC's convention for a crossed/transposed line
- Wire Editor: transmission-line and lumped-load segment references now scale with the wire when a design-frequency change re-segments it (previously only excitations were scaled), keeping a loaded G5RV/LPDA feeder valid for simulation and fixing the feeder dashed line rendering at the wrong angle. The viewport also defensively clamps a stale segment reference onto the wire

## [1.1.1] - 2026-04-30

### Fixed

- Hang wire tool not applying the default +1m length unless manually edited

## [1.1.0] - 2026-04-30

### Added

- Editable wire length field in Wire Editor properties panel and wire table
- Length lock toggle to maintain wire length during 3D endpoint drags
- Bend Wire tool to split a straight wire into equal-length segments at a configurable angle while preserving total length
- Hang Wire tool to simulate catenary sag between wire endpoints with adjustable wire length and segment count
- Blender-style axis constraints: press X/Y/Z during drag to lock to that axis, Shift+X/Y/Z to exclude an axis, with colored axis indicator lines
- Multi-wire move: dragging one wire in a multi-selection moves all selected wires together
- Templates now set their recommended transformer automatically (EFHW → 49:1, OCFD → 4:1, delta loop → 4:1)

### Fixed

- Incorrect `end_mhz` field name in README API example (should be `stop_mhz`)
- Frequency slider displaying bands in click order instead of ascending frequency order
- Impedance chart zigzag lines when simulating non-contiguous multi-band sweeps
- Frequency slider SWR display ignoring transformer/matching configuration
- Multi-band analysis table ignoring transformer/matching configuration
- Radiation efficiency always showing 100% regardless of ground type
- Wire dragging at elevated heights no longer jumps to distant positions
- Whole-wire drag sensitivity now matches mouse movement regardless of camera angle

### Changed

- Wire editor drag system rebuilt with camera-facing plane approach for smooth movement from any angle
- Move matching/balun selector next to band presets in Wire Editor for discoverability

## [1.0.1] - 2026-03-24

### Added

- Manual wire segment override in the Wire Editor with sticky behavior (persists through geometry changes)
- Editable segments in both WirePropertiesPanel and WireTable with "Auto" reset button
- Visual indicator (*) for manually overridden segments in the wire table

### Changed

- Renamed "Band Presets" label to "Band Sweep Presets" for clarity

## [1.0.0] - 2026-03-05

### Added

- Multi-segment frequency sweeps: simulate multiple band ranges in a single NEC2 run (e.g., 20m + 15m + 10m simultaneously)
- `FrequencySegment` type and `frequencySegments` field on both stores, engine request types, and backend Pydantic model
- BandPresets dual interaction: click to toggle band as frequency segment, Ctrl+click (long-press on mobile) to change antenna design frequency and set single-band sweep
- FrequencySegmentEditor component: compact segment list with per-segment start/stop/steps controls, total point counter, and 301-point cap
- Card deck builders (WASM + backend) emit interleaved FR + NE + RP card blocks for multi-segment sweeps
- `bandToSegment`, `hasBandSegment`, `removeBandSegment` utilities in `ham-bands.ts`
- NumberInput click-to-edit component replacing all raw `<input type="number">` fields across 5 files
- Frequency sweep controls (start/stop/steps) on the Simulator page for manual sweep range override
- Adaptive sweep step count (`computeSteps`): ~25 pts/MHz, clamped [11, 101], auto-adjusts when range changes
- Frequency sweep controls and validation warnings on the Simulator mobile bottom sheet
- ProjectActions (save/load) on the Simulator mobile bottom sheet
- Ham band frequency presets with ITU Region 1/2/3 support and band analysis utilities
- Band preset pill buttons integrated into Simulator and Editor pages for quick frequency selection
- Project save/load (.antennasim JSON format) with schema validation and round-trip integrity
- Save/Open project buttons with Ctrl+S / Ctrl+O keyboard shortcuts on both pages
- Pre-simulation validation engine with 12 checks (lambda/10, zero-length wires, below-ground, segment limits, overlapping wires, etc.)
- Validation warnings banner shown above the Run button in both Simulator and Editor pages
- Multi-band analysis results tab showing per-band SWR, gain, bandwidth, and quality rating for all HF bands
- Impedance matching network calculator with L, Pi, and T network topologies
- Matching network results tab showing component values, Q factor, bandwidth, and schematic
- Wire editor power tools: copy (Ctrl+C), paste (Ctrl+V), duplicate (Ctrl+D), and mirror selected wires
- Copy/paste/duplicate/mirror buttons in editor toolbar
- `setFrequencyRange` action on antennaStore for overriding template-derived frequency range
- Extracted shared ham band definitions from SWRChart into reusable `utils/ham-bands.ts`
- 78 new tests for multi-segment sweeps, ham bands (including computeSteps), project files, validation engine, and matching networks (total: 308)

### Fixed

- Band preset frequency ranges no longer get overwritten when template parameters change (antennaStore `_frequencyOverride` flag)
- Sweep step count now adapts to bandwidth instead of staying at a hardcoded value

## [0.8.0] - 2026-03-05

### Added

- Testing infrastructure with Vitest and @vitest/coverage-v8
- Snapshot tests for all 17 antenna templates (geometry, excitation, frequency range, feedpoints)
- Parameter boundary tests verifying templates don't crash at min/max values
- NEC2 card deck generation tests (GW, EX, GN, FR, RP, PT, LD, TL, NE, GA, GM, GR cards)
- NEC2 output parser tests (SWR computation, impedance extraction, pattern parsing, current distribution)
- WASM engine parity tests (card deck determinism, structural consistency across all templates)
- Test step in CI workflow (runs `npm test` between lint and build)
- `npm test`, `npm run test:watch`, and `npm run test:coverage` scripts

## [0.7.7] - 2026-03-05

### Added

- CHANGELOG.md with full release history back to v0.2.0

### Changed

- Upgraded all frontend dependencies to latest versions:
  - Tailwind CSS 3.4 -> 4.2 (migrated to CSS-first config with @tailwindcss/vite plugin)
  - Vite 6 -> 7.3
  - TypeScript 5.7 -> 5.9
  - Three.js 0.170 -> 0.183
  - Recharts 2.14 -> 3.7 (updated tooltip/formatter type signatures)
  - React 19.2.0 -> 19.2.4
  - React Router 7.1 -> 7.13
  - @vitejs/plugin-react 4 -> 5
  - eslint-plugin-react-hooks 5 -> 7 (new strict rules set to warn)
  - eslint-plugin-react-refresh 0.4 -> 0.5
  - Zustand 5.0.0 -> 5.0.11
  - All @types/* packages updated
- Removed postcss.config.js and autoprefixer (handled by @tailwindcss/vite)
- Removed tailwind.config.ts (migrated to CSS @theme in index.css)
- Added root .dockerignore to reduce Docker build context size (node_modules, .git, build artifacts were being sent unnecessarily)

## [0.7.6] - 2026-03-05

### Fixed

- Full-sphere radiation pattern in free space -- RP card was hardcoded to upper hemisphere only; now computes full sphere (theta -180 to +180) when no ground plane is present
- Stale raycaster targets after template switch -- SceneRaycaster cached targets by top-level child count, missing deep scene graph changes; now collects fresh targets via scene.traverse() on each raycast

## [0.7.5] - 2026-03-04

### Fixed

- Light mode 3D scene rendering -- corrected lighting, material properties, and background colors for the light theme
- Editor current distribution display in light mode

## [0.7.4] - 2026-03-04

### Fixed

- Axis labels on 3D viewport corrected for NEC2-to-Three.js coordinate mapping
- Elevation radiation pattern polar chart rendering
- Beamwidth arc calculation for multi-lobe patterns (each lobe now gets its own -3dB arc)

## [0.7.3] - 2026-03-03

### Added

- Animated loading overlay during simulation -- pulsing antenna icon with progress message replaces blank viewport while waiting for results

## [0.7.2] - 2026-03-03

### Fixed

- Mobile layout polish -- touch targets, spacing, and overflow issues on small screens
- Screenshot export now respects the current theme (dark/light) instead of always using dark

## [0.7.1] - 2026-03-03

### Fixed

- Comprehensive mobile layout overhaul -- panels, charts, and 3D viewport properly adapt to phone and tablet screen sizes
- Touch-friendly controls for sliders and parameter editors

## [0.7.0] - 2026-03-03

### Added

- WebAssembly engine for serverless deployment -- nec2c compiled to WASM runs entirely in the browser via Web Workers, no backend server required
- GitHub Pages deployment workflow (deploy-pages.yml) -- automated WASM build + static site deploy
- TypeScript ports of all backend Python modules: NEC2 card deck builder, output parser, .nec/.maa importers and exporters, Nelder-Mead optimizer
- Engine abstraction layer (`SimulationEngine` interface) with `BackendEngine` and `WasmEngine` implementations
- `VITE_ENGINE` env var to select engine at build time (`backend` or `wasm`)

### Fixed

- SPA routing on GitHub Pages with base path support
- WASM workers now use Vite `BASE_URL` for correct asset loading on subpath deployments
- Stale results cleared when switching between Simulator and Editor pages
- NE card generation in WASM engine for near-field computation
- Compare overlay color index tracking

## [0.6.1] - 2026-03-03

### Fixed

- Symbolic NEC file import -- SY card expressions (variables, arithmetic) now evaluated correctly during .nec import
- Dense NEC files with many wires/segments no longer timeout during simulation

### Changed

- Updated README and .env.example to reflect current architecture and deployment options

## [0.6.0] - 2026-03-01

### Changed

- Decluttered viewport controls -- consolidated toolbar with cleaner layout
- Redesigned wire editor panel -- improved organization of wire table, tools, and property editors

## [0.5.1] - 2026-03-01

### Fixed

- Rate limiting is now opt-in (disabled by default) -- previously it was always active, breaking single-user self-hosted setups
- Rate limit parameters configurable via environment variables (`RATE_LIMIT_ENABLED`, `RATE_LIMIT_PER_HOUR`, `MAX_CONCURRENT_PER_IP`)

## [0.5.0] - 2026-03-01

### Added

- Docker Hub publishing -- automated CI builds and pushes images on version tags
- All-in-one Docker image (`ea1fuo/antennasim`) bundling frontend, backend, Redis, and nginx in a single container
- `docker run -p 80:80 ea1fuo/antennasim` one-liner deployment

## [0.4.0] - 2026-03-01

### Added

- Horizontal delta loop (skyloop) antenna template
- CI workflow (ci.yml) -- runs TypeScript type-check, ESLint, and Vite build on all PRs and pushes to main
- PR title validation workflow enforcing Conventional Commits format
- Contributing guidelines

### Fixed

- Excitation placement now works on any wire segment (was restricted to center segment)
- Frequency controls and slider UX improvements -- better step snapping, debounce, and text input handling

### Changed

- Renamed project from AntSim to AntennaSim
- Centralized version management in a single `VERSION` file at the project root

## [0.3.2] - 2026-02-27

### Fixed

- Production API routing -- switched to relative URLs and fixed tmpfs permissions in the Docker container

## [0.3.1] - 2026-02-27

### Added

- Screenshots to README

### Changed

- Renamed project to AntennaSim in documentation

## [0.3.0] - 2026-02-27

### Added

- Chart legends on all charts -- SWR zones, impedance lines, Smith chart markers, polar pattern
- 3D hover measurements -- gain, wire dimensions, current magnitude, and near-field tooltips
- Balun/unun impedance matching with 10 presets (1:1 to 49:1)
- Custom ground model with user-defined dielectric constant and conductivity

### Fixed

- Smith chart popup clipping -- unique clipPath IDs per instance
- Chart popup sizing -- responsive SVG, proper height fill, tooltip positioning
- Current segment positions converted from wavelengths to meters
- Chart margins increased to prevent annotation clipping
- Stale simulation results now cleared when antenna parameters change

### Changed

- 3D tooltip performance -- deferred raycasting with requestIdleCallback, no React re-renders during hover
- NEC2 simulation timeout increased from 30s to 180s
- Docker production stack -- fixed nginx startup, CORS configuration, and build pipeline

## [0.2.0] - 2026-02-27

### Added

- Wire editor -- click-to-add wires, drag endpoints, move mode, undo/redo, snap grid
- 17 antenna templates: dipole, inverted V, EFHW, vertical, J-pole, slim jim, delta loop, horizontal delta loop, cubical quad, magnetic loop, Yagi-Uda, Moxon, hex beam, LPDA, off-center fed, G5RV, fan dipole
- Nelder-Mead optimizer with 5 objective functions and real-time WebSocket progress
- Import/export for .nec (NEC2 card deck) and .maa (MMANA-GAL) files
- Compare mode -- overlay multiple simulation results for A/B comparison
- Screenshot export
- CSV data export
- Advanced 3D visualization -- current distribution with animated flow particles, volumetric radiation shells, near-field heatmap, ground reflection, pattern slice animation
- Smith chart with frequency markers, constant SWR circles, and click-to-inspect tooltips
- Lumped loads (series/parallel RLC, fixed impedance, wire conductivity)
- Transmission lines (impedance, length, velocity factor, shunt admittance)
- GA/GM/GR NEC2 cards for wire arcs, coordinate transforms, and cylindrical symmetry
- .s1p NanoVNA overlay on SWR chart
- Library page for browsing all templates
- Learn page with educational content on NEC2, SWR, impedance, and radiation patterns
- Error boundaries and keyboard shortcuts (17 bindings)
- Dark/light theme with system-aware detection
- Redis caching with SHA-256 keys and zlib compression
- Rate limiting (configurable per-IP)
- Sandboxed NEC2 execution in isolated temp directories

This was the initial public release -- a complete rewrite of the original prototype into a production-quality application with React 19, TypeScript, FastAPI, and Docker.

[1.4.2]: https://github.com/EA1FUO/AntennaSim/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/EA1FUO/AntennaSim/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/EA1FUO/AntennaSim/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/EA1FUO/AntennaSim/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/EA1FUO/AntennaSim/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/EA1FUO/AntennaSim/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/EA1FUO/AntennaSim/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/EA1FUO/AntennaSim/compare/v1.1.1...v1.2.0
[1.0.0]: https://github.com/EA1FUO/AntennaSim/compare/v0.8.0...v1.0.0
[0.8.0]: https://github.com/EA1FUO/AntennaSim/compare/v0.7.7...v0.8.0
[0.7.7]: https://github.com/EA1FUO/AntennaSim/compare/v0.7.6...v0.7.7
[0.7.6]: https://github.com/EA1FUO/AntennaSim/compare/v0.7.5...v0.7.6
[0.7.5]: https://github.com/EA1FUO/AntennaSim/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/EA1FUO/AntennaSim/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/EA1FUO/AntennaSim/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/EA1FUO/AntennaSim/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/EA1FUO/AntennaSim/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/EA1FUO/AntennaSim/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/EA1FUO/AntennaSim/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/EA1FUO/AntennaSim/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/EA1FUO/AntennaSim/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/EA1FUO/AntennaSim/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/EA1FUO/AntennaSim/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/EA1FUO/AntennaSim/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/EA1FUO/AntennaSim/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/EA1FUO/AntennaSim/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/EA1FUO/AntennaSim/releases/tag/v0.2.0
