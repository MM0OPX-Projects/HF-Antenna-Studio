# HF Antenna Studio user guide — v1.0.0

## Start safely

1. Create or open a project.
2. Choose a parametric family or the wire editor.
3. Set frequency, dimensions, conductor diameter, height, ground model, and reference impedance. Units are display conversions; the shared model uses SI units.
4. Read all geometry, segmentation, source, ground, and solver warnings.
5. Calculate and wait for the current-result indicator. A changed input invalidates older results; never treat a stale plot as belonging to the edited model.
6. Inspect the generated NEC deck and save/export the project evidence for consequential work.

The application predicts the mathematical model you supplied, not every unmodelled feed line, mast, soil layer, building, tree, or construction tolerance.

## Navigation

The home screen links to each laboratory. Every feature page has the shared HF Antenna Studio header; choose the product mark/Home control to return to the start. Browser Back/Forward and the unknown-route recovery page are covered by navigation regressions. In the main workbench, panel shortcuts and tabs move among model inputs, geometry, calculated results, patterns, sweeps, currents, and comparisons without closing the application.

## Projects

- **New** starts a clean project after handling unsaved work.
- **Save** updates the named local project; **Save As** creates another record.
- **Open/Recent** reads from the local project library.
- **Duplicate/Rename/Delete** manage records; deletion requires confirmation.
- **Export project** writes a portable `.hfas` file. **Import project** validates schema and migrations before storage.
- Autosave and recovery reduce accidental loss but are not backups. Export important work.

Project schema and migration behaviour are documented in [PROJECT_FILE_FORMAT.md](PROJECT_FILE_FORMAT.md).

## Antenna families

Templates generate the shared internal antenna model and then the dedicated NEC adapter. Frequency-derived dimensions are starting points, not promised resonance.

- **Verified dipole / height lab:** centre-fed horizontal wire, ground/height controls, patterns, currents, and saved height overlays.
- **Verticals:** ground-contact, elevated and ground-plane arrangements. In v1.0.0, explicit current-carrying radial wires are supported only in the elevated arrangement. The separate ground-contact radial-screen option is NEC's simplified reflection-coefficient approximation: its radial entries are density/radius parameters, not rendered wires, and it produces no radial segment currents. The ideal perfect-ground contact model has no radials. None of these represents explicit wires lying on or buried in real soil.
- **Loops and compact beams:** square/delta/diamond loops, cubical quad states, and a single-band hexbeam wire path. Feed geometry determines orientation/polarisation; the template name does not.
- **Yagis:** two-, three-, and configurable multi-element starting geometries with declared forward axis, axial rear samples, F/B and beamwidth.
- **Phased arrays:** ideal requested current/phase and physical feed-network modes are distinct. Do not infer a buildable coax network from an ideal-current pattern. The same v1.0.0 radial boundary applies: phased ground-contact elements do not yet gain explicit surface/buried radial systems merely by selecting a ground model.
- **Wire editor:** edit X/Y/Z wires, sources and supported loads; validate connectivity, overlap, intersections, ground contact, segmentation and source placement before solving.

## Results

- `R + jX Ω` is the complex feed impedance at the selected source/reference point.
- SWR is derived against the selected 50 Ω or 75 Ω reference; changing reference impedance changes SWR, not the solved antenna impedance.
- Gain is absolute dBi only when the view says so. Normalised patterns have a 0 dB peak and do not preserve absolute gain.
- Take-off angle is elevation above the horizon at the selected sampled maximum, not guaranteed sub-grid precision.
- F/B compares the declared forward and opposite axial samples. F/R may use a rear-region worst case and is labelled separately.
- Current views use NEC segment results. A normalised legend must not be interpreted as absolute amperes.

## Frequency analyser

Choose start/stop or centre/span, number of points, band preset, and reference impedance. The worker executes a batched NEC frequency card without a far-field grid at every point. Inspect exact cursor R, X, |Z|, SWR, reflection coefficient and return loss; optionally use the Smith chart. Saved overlays retain their conditions. Cancelled/partial sweeps are not published as complete results.

## Comparisons, sweeps, and optimiser

- Model comparison supports four states and warns when frequency, ground, reference impedance, or cut conditions differ.
- One- and bounded two-dimensional sweeps retain the exact parameter/model/NEC lineage for each point. Job-size limits protect responsiveness.
- The optimiser changes permitted parameters inside declared bounds and rejects invalid models. It retains the best evaluated candidates and reproducibility settings. It never proves a global optimum.

## Measurement comparison

Import Touchstone `.s1p` data containing frequency and S11 in RI, MA or DB form. The original measurement samples are retained. Derived impedance is valid only with a meaningful reference impedance. Exact-frequency comparison is preferred; when interpolation is mathematically allowed, it is labelled and never extrapolates. SIMULATION and MEASUREMENT remain visually/textually distinct.

Common differences include feed-line transformation/loss, common mode, connectors, calibration plane/error, real soil, nearby structures, material dimensions, and NEC assumptions.

## NEC import/export

Import retains the original deck text and reports unsupported cards. Supported cards are converted only after validation. A significant unsupported card blocks generated-state simulation/export; use the original-text export to preserve it. Exported generated NEC reflects the current supported model and may differ from original formatting, so inspect the displayed deck and warnings.

## Exports

Charts can export PNG where offered; tables/sweeps/comparisons can export CSV or project JSON/HTML. Exported reports state model conditions and evidence but are not validation certificates. Review files for private antenna locations or measurement details before sharing.

## Getting help

Open **About** for version, runtime, log directory, licences and notices. Consult [Known limitations](KNOWN_LIMITATIONS.md), [Validation report](VALIDATION_REPORT.md), and [Installation](INSTALLATION.md) before reporting a solver or package problem.
