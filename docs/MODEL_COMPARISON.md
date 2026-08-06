# Model comparison laboratory

Status: implemented experimental browser/Wasm feature on `feature/model-comparison`

## Scope

The `/model-comparison` route solves four explicit antenna slots and presents one side-by-side result table, compatible radiation overlays, compatible impedance-sweep overlays, warnings, and a standalone offline HTML report. Available comparison families are:

- centre-fed horizontal dipole, parameterised by height;
- elevated quarter-wave vertical with explicit radial wires, parameterised by radial count;
- two-element vertical phased array in ideal current/phase mode, parameterised by element-2 phase;
- three-element horizontal Yagi, parameterised by boom height.

Four-state presets cover dipole heights 5/10/15/20 m, vertical radial counts 2/4/8/16, phased-array phase 0/90/180/270 degrees, and Yagi heights 5/10/15/20 m. A mixed preset exercises one model from each family. Generated frequency-scaled dimensions remain starting points, not resonance or construction guarantees.

## Controlled conditions

One condition block applies to all slots in a run:

- frequency;
- infinite perfect ground or Sommerfeld/Norton real ground;
- conductivity and relative permittivity for real ground;
- 50- or 75-ohm reference impedance;
- common azimuth-cut elevation;
- common elevation-cut compass bearing;
- common sweep start, stop, point count, and reference impedance.

Cut controls use 10-degree increments. This is the common subset of the existing 2-degree and 5-degree solver grids, so an overlay never compares different nearest angular samples. Azimuth points are transformed to compass coordinates (`0° = +Y/north`, `90° = +X/east`) at the comparison boundary. The UI does not change each family’s canonical solver coordinates.

Changing a condition after calculation retains the metric snapshots but marks them stale and removes them from overlays. Results with different condition identities are never silently overlaid. Model edits receive the same treatment. A new run replaces the old set; solver failure or cancellation removes partial results.

## Solver and result path

Each family reuses its dedicated typed model, geometry generator, segmentation rules, NEC adapter, service, and result validator. The comparison layer does not create a second antenna compiler:

```text
common comparison conditions + slot parameter
  -> existing family SI model and generator
  -> existing family NEC adapter/service/validator
  -> full parsed NEC pattern result
  -> common exact-grid cuts and metric contract
```

Single-port dipole, vertical, and Yagi models also run one impedance-only NEC batch. The comparison service retains geometry, ground, source, and loads from the displayed family deck, replaces its single `FR`/`RP` execution with one multi-point `FR` plus `XQ`, and parses every complex impedance. Geometry and segmentation remain fixed throughout a sweep. A warning is emitted when the longest segment exceeds `0.1λ` at the stop frequency.

The ideal-current phased array deliberately has no R, X, SWR, or impedance sweep. It uses two coupled calibrated ports and does not define a single physical input impedance. Those cells display `N/A` with an explanation; no impedance is inferred from requested currents or source voltages.

## Metric meanings

- **Gain:** maximum/forward gain supplied by the family’s validated result contract.
- **Take-off angle:** elevation of the applicable maximum above ground; not reported for a free-space model (free space is not currently offered in this comparison page).
- **Front-to-back:** family-defined intended forward/reverse result for Yagi and phased arrays. Dipole and vertical rows use the strongest azimuth sample and its opposite sample; symmetric patterns should therefore be close to 0 dB and do not acquire a directional claim.
- **Beamwidth:** existing Yagi half-power beamwidth or a circular, interpolated `-3 dB` width on the family’s maximum-containing azimuth cut. A cut that never crosses `-3 dB` is reported as 360 degrees.
- **R/X/SWR:** parsed single-port feed impedance and SWR derived at the visible reference impedance. Ideal-current phased arrays report `N/A`.

Absolute-dBi and normalised-dB radiation modes retain the same solved points. Normalisation changes only display values.

## HTML report

The HTML export is standalone and contains no remote resources. It includes:

- creation time and report controls;
- per-model solved conditions and all requested metrics;
- warnings when snapshots differ;
- normalised azimuth/elevation SVG overlays for the largest compatible condition group;
- an SWR SVG overlay and exact sweep tables;
- unavailable-quantity explanations;
- every exact generated NEC pattern deck.

Labels and deck text are HTML-escaped. The report is generated locally and may disclose antenna dimensions by design; the application does not upload it.

The feature adds no third-party dependency, external artwork, reference-data licence, or network service. It reuses the repository's GPL-3.0-or-later code and existing attributed NEC/Wasm components, so the project-wide licensing and attribution checklist remains unchanged.

## Automated evidence

- Pure tests cover all four four-state presets, parameter labels/ranges, condition mismatch detection, NEC-to-compass cut extraction, circular F/B and beamwidth, omnidirectional width, exact pattern-to-sweep deck transformation, stop-frequency segment ratio, and safe standalone HTML generation.
- Playwright solves the mixed dipole/vertical/phased-array/Yagi set through local nec2c/Wasm, verifies four metric rows, four compatible azimuth/elevation series, three single-port sweep series, explicit phased-array `N/A` values, report download/content, stale-condition exclusion, example presets, real-ground controls, narrow layout, and browser/page errors.
- The full existing solver/regression corpus remains the family-specific numerical evidence. This feature does not create new independent physical reference cases.

## Critical review and resolutions

| Challenge | Resolution or retained limitation |
|---|---|
| Different families can use different cut planes and coordinate conventions. | Comparison cuts are re-extracted from full grids at one exact common 10-degree elevation/bearing and converted to labelled compass coordinates. |
| A stale result can look like it belongs to edited controls. | Complete condition/model identities gate every overlay; stale rows are labelled and rerun warnings are prominent. |
| Ideal-current excitation can be mistaken for a physical feed impedance. | R/X/SWR/sweep are `N/A`; the two-port limitation is repeated in UI/report. |
| A wide sweep can invalidate centre-frequency segmentation. | The exact fixed geometry is retained and a `>0.1λ` stop-frequency warning is generated; convergence remains the user’s responsibility. |
| Heterogeneous F/B and beamwidth values can imply equivalent antenna intent. | Definitions are explicit above; symmetric antennas receive axial values without a forward-performance claim. |
| An HTML report can silently overlay incompatible snapshots. | Only the largest exact condition group is plotted; every result retains its own solved-condition row and mismatch warning. |
| Four solver jobs could freeze the interface or publish partial results. | Jobs execute sequentially in cancellable workers, publish progress, and discard partial data on cancellation/failure. |

## Known limitations and manual checks

- Comparison slots are intentionally limited to four families and one primary parameter each; arbitrary Wire Editor project snapshots are not yet selectable.
- Phased-array physical feed-network comparisons are not included.
- Pattern interpolation between angular samples is not performed; controls deliberately use the common 10-degree grid.
- Sweep geometry is not re-segmented per frequency.
- Reports cannot yet be re-imported as editable comparison projects.
- Values should be cross-checked with the existing family reference cases; a comparison does not strengthen the underlying model’s validation status.
- Manually review report printing, colour differentiation, keyboard flow, long-warning/deck layout, cancellation timing, and Windows 11 browser/GPU behaviour.
