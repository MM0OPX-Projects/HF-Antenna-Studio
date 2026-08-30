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

New general wire-antenna models start with a **1 mm wire diameter**. This is an editable modelling default, not a recommendation for mechanical construction. Yagi/LPDA element-tube and magnetic-loop conductor defaults remain family-specific. Saved projects and imported NEC files retain their recorded conductor dimensions.

- **Verified dipole / height lab:** centre-fed horizontal wire, ground/height controls, patterns, currents, and saved height overlays.
- **Verticals:** ground-contact, near-surface, elevated and ground-plane arrangements. The frozen v1.0.0 release supports explicit current-carrying radial wires only in the elevated arrangement. The unreleased ground-radial branch adds horizontal explicit wires at visible positive clearance over real ground for the specialist vertical and reusable template; NEC-2 does not make that a buried-wire or exact soil-contact model. The separate ground-contact radial-screen option remains NEC's simplified reflection-coefficient approximation: its radial entries are density/radius parameters, not rendered wires, and it produces no radial segment currents. The ideal perfect-ground contact model has no radials.
- The primary Simulator's **Ground Plane Vertical** is still the elevated-radial template. Its scope notice links to **Verticals** for ground-mounted radials and **Phased Arrays** for two-element radial systems; selecting a different laboratory never silently changes the current Simulator geometry.
- **Loops and compact beams:** square/delta/diamond loops, cubical quad states, and a single-band G3TXQ broadband Hexbeam wire path. Feed geometry contributes to polarisation; the template name alone does not determine it.
- **Yagis:** two-, three-, and configurable multi-element starting geometries with declared forward axis, axial rear samples, F/B and beamwidth.
- **Phased arrays:** ideal requested current/phase and physical feed-network modes are distinct. Do not infer a buildable coax network from an ideal-current pattern. Ground-mounted arrays may use the explicit shared bonded or non-overlapping independent near-surface radial models; these are raised-wire NEC-2 approximations, never buried-wire claims.
- **Wire editor:** edit X/Y/Z wires, sources and supported loads; validate connectivity, overlap, intersections, ground contact, segmentation and source placement before solving.

## Results

- **Azimuth cut** and **Elevation cut** are presented together wherever a solved antenna model is inspected. Design and Wire Editor pin both windows in their result area; Compare overlays condition-compatible models; Sweeps and Optimiser show the selected exact point or retained solution. Frequency Analyser and Measurement Comparison preserve their fast impedance-only batch and then run one separately labelled, cancellable full-pattern calculation at the selected or minimum-SWR frequency. Changing the antenna or frequency hides the old cuts until recalculation, so an earlier pattern is never presented as current.
- `R + jX Ω` is the complex feed impedance at the selected source/reference point.
- SWR is derived against the selected 50 Ω or 75 Ω reference; changing reference impedance changes SWR, not the solved antenna impedance.
- **Absolute dBi** is gain relative to an isotropic radiator. **Relative to peak** sets the strongest point in each displayed cut to 0 dB and describes other directions as a positive number of decibels below that cut peak; it is not dBd and it is not absolute gain.
- Elevation-cut views include a full-plane **Elevation cut angle** inspector. Its convention is `0° = primary/forward horizon`, `90° = zenith`, and `180° = opposite/rear horizon`; therefore 5° and 175° are equal elevations on opposite bearings and can be compared directly. Type any angle from 0° to 180°, click once to jump, hold the primary mouse button and drag continuously across the upper semicircle, or focus the plot and use the arrow keys (Shift+Arrow changes 5°; Home/End selects 0°/180°). The rear half uses actual NEC samples at the opposite azimuth bearing—it is not a mirror of the front half. The plot's **Absolute dBi / Relative to peak** selection also controls the inspector's prominent reading. The smaller context value retains the other interpretation and states the absolute cut peak, so no conversion has to be inferred. For overlays, each trace is measured relative to its own cut peak. **Exact NEC sample** means that direction was solved directly; an **Interpolated** value is a labelled linear estimate in decibels between the two displayed NEC angular samples and is not another solver execution. If NEC reports its `-999.99 dB` null sentinel at exactly 0° or 180°, the trace meets that horizon at the plot floor for visual completeness, but the inspector says that no valid numerical sample is available and does not invent or interpolate a gain value.
- Azimuth views include a separate **Azimuth cut elevation** box from 0° (horizon) to 90° (zenith). It chooses which horizontal slice of the retained three-dimensional NEC grid is drawn through the full 360° of bearing. Because NEC solves a finite angular grid, the interface states the actual nearest theta row used; moving this control does not pretend to run or interpolate a new electromagnetic solution. The **Azimuth bearing** cursor can then be clicked and held while dragging continuously around the circle, typed from 0° to 360°, or moved by keyboard. Its gain reading follows the same **Absolute dBi / Relative to peak** mode as the plot. Readings between adjacent bearings are visibly labelled as interpolation, including across the 360°/0° seam.
- Take-off angle is elevation above the horizon at the selected sampled maximum, not guaranteed sub-grid precision.
- F/B compares the declared forward and opposite axial samples. F/R may use a rear-region worst case and is labelled separately.
- Current views use NEC segment results. A normalised legend must not be interpreted as absolute amperes.

## Frequency analyser

Choose start/stop or centre/span, number of points, band preset, and reference impedance. The worker executes a batched NEC frequency card without a far-field grid at every point. Inspect exact cursor R, X, |Z|, SWR, reflection coefficient and return loss; optionally use the Smith chart. After the impedance sweep, the selected frequency receives a separate full-pattern solve for its azimuth/elevation windows. Moving the cursor hides that earlier pattern until the new frequency is calculated. Saved impedance overlays retain their conditions. Cancelled/partial sweeps are not published as complete results.

## Comparisons, sweeps, and optimiser

- Model comparison supports four states and warns when frequency, ground, reference impedance, or cut conditions differ.
- One- and bounded two-dimensional sweeps retain the exact parameter/model/NEC lineage for each point. Job-size limits protect responsiveness.
- The optimiser changes permitted parameters inside declared bounds and rejects invalid models. It retains the best evaluated candidates and reproducibility settings. It never proves a global optimum.
- For vertical and phased-array work, choose the radial representation explicitly. Comparison, sweep, and optimiser `.hfas` projects preserve that identity; raised near-surface NEC wires are not buried or exact soil-contact models.

## Measurement comparison

Import Touchstone `.s1p` data containing frequency and S11 in RI, MA or DB form. The original measurement samples are retained. Derived impedance is valid only with a meaningful reference impedance. Exact-frequency comparison is preferred; when interpolation is mathematically allowed, it is labelled and never extrapolates. SIMULATION and MEASUREMENT remain visually/textually distinct.

Common differences include feed-line transformation/loss, common mode, connectors, calibration plane/error, real soil, nearby structures, material dimensions, and NEC assumptions.

## NEC import/export

Import retains the original deck text and reports unsupported cards. Supported cards are converted only after validation. A significant unsupported card blocks generated-state simulation/export; use the original-text export to preserve it. Exported generated NEC reflects the current supported model and may differ from original formatting, so inspect the displayed deck and warnings.

## Exports

Charts can export PNG where offered; tables/sweeps/comparisons can export CSV or project JSON/HTML. Exported reports state model conditions and evidence but are not validation certificates. Review files for private antenna locations or measurement details before sharing.

## Getting help

Open **About** for version, runtime, log directory, licences and notices. Consult [Known limitations](KNOWN_LIMITATIONS.md), [Validation report](VALIDATION_REPORT.md), and [Installation](INSTALLATION.md) before reporting a solver or package problem.
