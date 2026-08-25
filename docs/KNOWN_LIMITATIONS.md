# Known limitations — v1.0.0

This document distinguishes release-blocking defects from accepted, visible boundaries. No open item below is evidence that an affected calculation is validated.

## Accepted engineering limitations

- **NEC-2 applicability:** results inherit NEC-2 thin-wire, junction, segmentation, ground, and numerical limits. Very close/overlapping wires, abrupt radius changes, electrically short/long segments, buried wires, complex materials, and geometries outside those assumptions require specialist review.
- **Validation breadth:** nine primary and seven supplemental exact decks have external comparison evidence. This does not validate every template, dimension, frequency, pattern grid, current value, or arbitrary imported model.
- **Real ground:** the UI can request the nec2c Sommerfeld/Norton real-ground formulation, but v1.0.0 has no independent finite-ground numeric campaign comparable to its perfect-ground suite. Treat real-ground output as supported solver capability with incomplete product-level validation.
- **Ground-mounted radial systems:** the post-v1 development branch supports current-carrying near-surface radial wires for single and phased verticals, but NEC-2 requires those wires to be raised above Sommerfeld/Norton ground. It is not a buried-wire, exact surface-contact, ground-stake, or soil-interface model. Perfect-ground images, elevated wires, the separate `GN/RP` screen approximation, independent phased fields, and the explicit shared bonded network remain physically different. See `docs/GROUND_RADIAL_SYSTEMS.md`.
- **Loss and construction detail:** conductor loss, insulation, earth discontinuities, masts, feed line, baluns, common mode, connectors, nearby structures, terrain, weather, and manufacturing tolerances are not automatically represented.
- **Pattern precision:** displayed extrema are selected from requested angular samples. They are not evidence of sub-grid angular accuracy. Deep-null values are particularly sensitive to grid and numerical precision.
- **Current display:** currents come from parsed NEC segment results. Magnitude/phase lineage and mapping are regression-tested, but absolute complex-current values have not received a separate broad external campaign. Normalised modes are labelled and must not be read as amperes.
- **Physical phased-array feeds:** ideal-current excitation is not equivalent to a coax-fed network. The physical transmission-line mode is limited to the documented ideal NEC `TL` arrangements and lacks a broad external feed-network validation campaign.
- **Optimiser:** the optimiser is an experimental bounded deterministic search. “Best solution found” means best among evaluated valid candidates, never a proven global optimum. Results can be dominated by constraints, sampling, segmentation, and the chosen objective.
- **Parameter sweeps/comparisons:** orchestration, exact-model lineage, cancellation and cache behaviour are tested. Only selected points receive independent RF reference coverage.
- **Measurement comparison:** Touchstone `.s1p` RI/MA/DB parsing and derived network quantities are tested. NanoVNA files vary; unsupported headers/columns are rejected. No controlled constructed-antenna campaign establishes expected simulation-to-measurement agreement.
- **NEC import:** the editor preserves original text and diagnostics, but only the published GW/GE/EX/LD/TL/GN/FR subset can be represented for editing. Solver-significant unsupported cards block generated-state simulation/export rather than being silently altered.
- **Project storage:** the local WebView profile provides save/autosave/recovery, not a durable backup. Clearing application/site data can remove local projects. Export important `.hfas` files.
- **Schema migration:** versions 1–4 are reviewed and future schemas fail closed. The application does not overwrite an unsupported future project; unusual hand-edited files may still require manual recovery.

## Windows distribution limitations

- The v1.0.0 x64 NSIS installer is unsigned and may trigger SmartScreen's unknown-publisher warning. Verify the published SHA-256.
- Windows 11 x64 is the supported release platform. ARM64, Windows 10, multi-user deployment, enterprise policy combinations, repair/downgrade, and non-Windows desktop packages are not release claims.
- The small installer expects a serviceable Evergreen WebView2 runtime. If it is missing, installation may require internet access. Normal calculations are offline after installation. The larger fully air-gapped installer variant is not a v1.0.0 claim.
- Local user projects/logs are intentionally preserved on ordinary uninstall. Complete data removal is manual after exporting needed projects.
- Automatic updating and code signing are not included.
- The cross-platform Rust lockfile includes unmaintained Linux GTK3 and older build/parser transitive crates. RustSec also identifies `glib 0.18.5` as unsound, but that GTK/glib path is not compiled into the supported Windows x64 package. This acceptance is Windows-specific and must not be reused as evidence for a Linux release.

## Licence/provenance limitations

- The pinned nec2c tree contains inconsistent historical public-domain/GPL descriptions. The release retains every upstream notice, exact source, and build recipe and conservatively distributes the combined work under GPLv3. This is documented provenance handling, not a legal determination.
- A formal trademark clearance for “HF Antenna Studio” and legal opinion on historical NEC/nec2c provenance are outside the engineering audit. No affiliation with commercial modelling packages is claimed.

## TODO/FIXME audit

The v1.0.0 source scan found no active HF Antenna Studio code `TODO` or `FIXME`. The only tracked-source match describes a TODO inside an evaluated but **unselected** NEC2++ WebAssembly stub in `docs/SOLVER_EVALUATION.md`. Classification: **Future feature / rejected candidate evidence**, not shipped code and not a v1.0.0 defect.

Future feature requests in roadmap documents are not hidden release defects. Any newly discovered incorrect deck, parser, stale-result, data-loss, security, or offline-package behaviour is a bug and must be triaged independently of this list.
