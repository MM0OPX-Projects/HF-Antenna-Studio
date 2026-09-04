# HF Antenna Studio user guide — v1.0.0

## Start safely

1. Create or open a project.
2. Choose a parametric family or the wire editor. The wire editor opens in a fixed Front X/Z construction plane; use its 2D/3D switch whenever you want the orbiting three-dimensional inspection view.
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

Choose the application-wide **Wire** material in the top bar: Copper is the default for new work, with Aluminium, Steel, Stainless steel, Perfect conductor and a positive custom conductivity in S/m also available. This is antenna-conductor conductivity, not ground conductivity. Finite choices generate a global NEC `LD 5` conductivity load and apply uniformly unless an imported/model-specific `LD 5` card already exists. Perfect conductor is an ideal lossless modelling option. Existing pre-v8 projects and imports without conductivity data remain Perfect conductor so opening them cannot silently alter earlier results.

- **Verified dipole / height lab:** centre-fed horizontal wire, ground/height controls, patterns, currents, and saved height overlays.
- **Verified Dipole transfer:** choose **Open in Wire Editor…** to review an exact editable transfer before replacing the current workspace. The review proves parity for represented NEC geometry, segmentation, source, ground and frequency; comments and output-request cards are regenerated deliberately. After confirmation, the editor displays **Exact transferred model** while its semantic fingerprint still matches. Any relevant free-form edit changes that status to **Transferred model modified**. The original Module sliders do not remain linked to the copied wire model. Save important existing editor work before confirming replacement.
- **Verticals:** ground-contact, near-surface, elevated and ground-plane arrangements. The frozen v1.0.0 release supports explicit current-carrying radial wires only in the elevated arrangement. The unreleased ground-radial branch adds horizontal explicit wires at visible positive clearance over real ground for the specialist vertical and reusable template; NEC-2 does not make that a buried-wire or exact soil-contact model. The separate ground-contact radial-screen option remains NEC's simplified reflection-coefficient approximation: its radial entries are density/radius parameters, not rendered wires, and it produces no radial segment currents. The ideal perfect-ground contact model has no radials.
- The primary Simulator's **Ground Plane Vertical** is still the elevated-radial template. Its scope notice links to **Verticals** for ground-mounted radials and **Phased Arrays** for two-element radial systems; selecting a different laboratory never silently changes the current Simulator geometry.
- **Loops and compact beams:** square/delta/diamond loops, cubical quad states, and a single-band G3TXQ broadband Hexbeam wire path. Feed geometry contributes to polarisation; the template name alone does not determine it.
- **Yagis:** two-, three-, and configurable multi-element starting geometries with declared forward axis, axial rear samples, F/B and beamwidth.
- **Phased arrays:** ideal requested current/phase and physical feed-network modes are distinct. Do not infer a buildable coax network from an ideal-current pattern. Ground-mounted arrays may use the explicit shared bonded or non-overlapping independent near-surface radial models; these are raised-wire NEC-2 approximations, never buried-wire claims.
- **Wire editor:** select a wire to open the Wire and Feedpoint Inspector. Edit X/Y/Z endpoints, length (keeping start, centre, or end fixed), bearing, elevation, diameter and segmentation in metric or imperial units. In the fixed 2D view, press and drag a wire body to reposition it directly while retaining its orientation. Drag either endpoint circle to reshape the wire with the opposite end anchored; bonded endpoints carry their neighbouring wire ends so a connected polyline deforms without silently disconnecting. Release creates one undo step and Escape/right-click cancels. Add mode can draw continuous joined wire chains; endpoint joining and Cartesian grid snapping are independent. Place a feedpoint by clicking/dragging along a wire or entering an exact percentage/distance. Always compare the requested point with the displayed actual NEC segment centre, and model an appropriate return path for end-fed systems.
- The Wire Editor keeps up to 100 Undo steps. Use the prominent **Undo/Redo** buttons beside 2D/3D or Ctrl+Z/Ctrl+Y. In normal 3D viewing, endpoint balls are hidden and conductor thickness is increased only visually for clarity; neither changes NEC geometry. The retained orange sphere is the NEC feedpoint/source. A compact viewport status identifies its wire and segment; full requested-versus-actual placement details remain in the Sources/feedpoint inspector. After solving, use **Pattern on/off** to hide or restore the 3D radiation bubble. The radiation surface uses a stable 1.5× display scale; zoom the complete scene with the viewport wheel.

## Results

The 3D radiation surface is a far-field visualisation and has no physical emission point. HF Antenna Studio places its display reference at the lowest physical antenna point, with the ground plane shown separately. The orange source marker remains at the actual NEC feed segment. This is a visual convention only and does not change NEC results.

- **Azimuth cut** and **Elevation cut** are presented together wherever a solved antenna model is inspected. Design and Wire Editor pin both windows in their result area; Compare overlays condition-compatible models; Sweeps and Optimiser show the selected exact point or retained solution. Frequency Analyser and Measurement Comparison preserve their fast impedance-only batch and then run one separately labelled, cancellable full-pattern calculation at the selected or minimum-SWR frequency. Changing the antenna or frequency hides the old cuts until recalculation, so an earlier pattern is never presented as current.
- `R + jX Ω` is the complex feed impedance at the selected source/reference point.
- SWR is derived against the selected 50 Ω or 75 Ω reference; changing reference impedance changes SWR, not the solved antenna impedance.
- **Absolute gain (dBi)** reports gain relative to an ideal isotropic radiator. Every numerical gain and cut-peak value in the radiation-cut inspector uses dBi in this mode. **Relative pattern (dB)** sets the strongest point in each displayed cut to `0.00 dB`; every other direction is a negative dB value relative to that peak. The inspector never mixes the two reference systems in one mode. Relative dB is not dBd: dBd is a separate absolute reference to a half-wave dipole, with `0 dBd = 2.15 dBi`, and is not currently a display mode.
- Elevation-cut views include a full-plane **Elevation cut angle** inspector. Its convention is `0° = primary/forward horizon`, `90° = zenith`, and `180° = opposite/rear horizon`; therefore 5° and 175° are equal elevations on opposite bearings and can be compared directly. Type any angle from 0° to 180°, click once to jump, hold the primary mouse button and drag continuously across the upper semicircle, or focus the plot and use the arrow keys (Shift+Arrow changes 5°; Home/End selects 0°/180°). The rear half uses actual NEC samples at the opposite azimuth bearing—it is not a mirror of the front half. The selected **Absolute gain (dBi) / Relative pattern (dB)** mode controls the entire inspector row: absolute mode includes only dBi, while relative mode includes only dB with the cut peak defined as 0 dB. For overlays, each trace is measured relative to its own cut peak in relative mode. **Exact NEC sample** means that direction was solved directly; an **Interpolated** value is a labelled linear estimate in decibels between the two displayed NEC angular samples and is not another solver execution. If NEC reports its `-999.99 dB` null sentinel at exactly 0° or 180°, the trace meets that horizon at the plot floor for visual completeness, but the inspector says that no valid numerical sample is available and does not invent or interpolate a gain value.
- Azimuth views include a separate **Azimuth cut elevation** box from 0° (horizon) to 90° (zenith). It chooses which horizontal slice of the retained three-dimensional NEC grid is drawn through the full 360° of bearing. Because NEC solves a finite angular grid, the interface states the actual nearest theta row used; moving this control does not pretend to run or interpolate a new electromagnetic solution. The **Azimuth bearing** cursor can then be clicked and held while dragging continuously around the circle, typed from 0° to 360°, or moved by keyboard. Its gain reading follows the same exclusive **Absolute gain (dBi) / Relative pattern (dB)** mode as the plot. Readings between adjacent bearings are visibly labelled as interpolation, including across the 360°/0° seam.
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
- In **Wire Editor**, select the intended driven wire and use **Radial systems** in its inspector. Choose **Add at Point 1** or **Add at Point 2** to identify the physical radial hub explicitly. The editor bonds every generated radial to that endpoint, places the source on the adjacent driven-wire segment, and exposes count, length, diameter, rotation, droop or near-surface clearance. Use **Explode** only when individual radial-wire editing is intended.
- Switch the Wire Editor to **3D** to inspect the complete radial field. Cyan conductors are the actual explicit NEC radial wires, and the on-view legend confirms their count, length, rotation and droop/clearance. Use **Top** to check spacing and rotation and **Front** or **Side** to check droop. The 2D view shows the same conductors projected into its active plane, so some evenly spaced radials can overlap visually without being absent from the model.

## Measurement comparison

Import Touchstone `.s1p` data containing frequency and S11 in RI, MA or DB form. The original measurement samples are retained. Derived impedance is valid only with a meaningful reference impedance. Exact-frequency comparison is preferred; when interpolation is mathematically allowed, it is labelled and never extrapolates. SIMULATION and MEASUREMENT remain visually/textually distinct.

Common differences include feed-line transformation/loss, common mode, connectors, calibration plane/error, real soil, nearby structures, material dimensions, and NEC assumptions.

## NEC import/export

Import retains the original deck text and reports unsupported cards. Supported cards are converted only after validation. A significant unsupported card blocks generated-state simulation/export; use the original-text export to preserve it. Exported generated NEC reflects the current supported model and may differ from original formatting, so inspect the displayed deck and warnings.

## Exports

Charts can export PNG where offered; tables/sweeps/comparisons can export CSV or project JSON/HTML. Exported reports state model conditions and evidence but are not validation certificates. Review files for private antenna locations or measurement details before sharing.

## Getting help

Open **About** for version, runtime, log directory, licences and notices. Consult [Known limitations](KNOWN_LIMITATIONS.md), [Validation report](VALIDATION_REPORT.md), and [Installation](INSTALLATION.md) before reporting a solver or package problem.
