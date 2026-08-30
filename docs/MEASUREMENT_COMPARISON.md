# Measurement comparison

Status: implemented experimental browser/Wasm workflow on `feature/measurement-comparison`

## Purpose and claim boundary

The `/measurement-comparison` route overlays imported one-port analyser data with a newly calculated NEC impedance sweep for the current Simulator antenna. Every view and export labels the sources as **MEASUREMENT** and **SIMULATION**. A disagreement is not automatically attributed to either source.

The measurement never changes antenna geometry, ground, loads, source, segmentation, sweep controls, or reference impedance automatically. “Use measurement range” and “Use measurement Z₀” are explicit user actions affecting only the next simulation setup.

This feature is comparison and provenance infrastructure. It is not evidence that the browser/Wasm solver, a particular physical installation, or a NanoVNA calibration is accurate.

## Initial accepted format

The safe initial interchange contract is a UTF-8 Touchstone `.s1p` file containing one-port `S` data:

- Touchstone 1.0 option/data form;
- a conservative Touchstone 2.0 one-port subset using `[Version]`, `[Number of Ports]`, `[Number of Frequencies]`, `[Reference]`, `[Network Data]`, `[Begin Information]`/`[End Information]`, and `[End]`;
- `Hz`, `kHz`, `MHz`, or `GHz` frequency units;
- `RI`, `MA`, or `DB` S11 representations;
- a finite positive option-line or `[Reference]` resistance.

The parser follows the public [IBIS Touchstone 2.0 specification](https://www.ibis.org/interconnect_wip/touchstone2_review_draft11.pdf) for option-line units, S parameters, RI/MA/DB representations, and reference resistance. The implementation is deliberately narrower than the complete specification. It rejects multi-port files, Y/Z/G/H parameter records, unsupported 2.0 keywords, continuation layouts, non-UTF-8 input, malformed numeric tokens, non-increasing/duplicate frequencies, and mismatched declared counts rather than guessing.

Limits are 5 MiB, 100,000 lines, 50,000 one-port points, and 16,384 characters per line. Embedded control characters and non-finite input values fail closed. These are browser safety limits, not claims about the maximum valid Touchstone file.

## NanoVNA investigation

NanoVNA is an ecosystem of hardware, firmware and desktop/mobile applications rather than one versioned CSV contract. NanoVNA-Saver describes itself as a tool for saving NanoVNA data as Touchstone, and NanoRFE's software page lists `.s1p`/`.s2p` plus separate CSV export for NanoVNA-QT and related tools:

- [NanoVNA-Saver repository](https://github.com/NanoVNA-Saver/nanovna-saver)
- [NanoVNA software and export overview](https://nanorfe.com/nanovna-software.html)

Touchstone therefore provides the safest common initial route. CSV files can contain raw RI values, magnitude/phase, SWR, impedance, display traces, different delimiters, locale decimal forms, or ambiguous reference-plane/calibration metadata. The current importer rejects `.csv` and tells the user to export `.s1p`. A future CSV importer requires named producer/version fixtures, explicit column/unit detection, calibration/reference metadata rules, and round-trip tests; it must not select columns by position or silently reinterpret display-derived values.

No NanoVNA code, sample file, artwork, executable, or documentation text is copied into the repository.

## Preserved and derived data

The imported dataset retains:

- original filename, byte length and browser-provided modification time;
- the complete decoded source text;
- original option line and declared format/reference;
- source line number, complete raw line, original numeric pair and original frequency for every point;
- derived complex S11, magnitude and phase;
- derived SWR and complex impedance where mathematically defined;
- import warnings without repairing the source.

For `Γ = S11 = a + jb` and real reference impedance `Z₀`:

```text
SWR = (1 + |Γ|) / (1 - |Γ|), for |Γ| < 1
Z = Z₀ × (1 + Γ) / (1 - Γ)
```

At `|Γ| = 1`, SWR is infinite. At `|Γ| > 1`, passive-load SWR is reported unavailable rather than applying an absolute-value shortcut. At `Γ = 1`, impedance is singular and unavailable. JSON exports encode non-finite derived values as explicit strings such as `"Infinity"`; they are never silently converted to JSON `null`. CSV uses `Infinity` and empty cells for unavailable quantities.

## Simulation boundary

Simulation calls the existing `runAnalyserSweep` service. That service generates one impedance-only NEC `FR` batch for the current typed Simulator request, executes it in the local worker, validates point count/frequencies, and derives match quantities from solved R+jX. After that batch, a separate, clearly labelled full-pattern calculation supplies paired azimuth/elevation cuts at the minimum-SWR simulated frequency. A model change hides those cuts until recalculation, and measurement values are never supplied to either solver job; no fitting occurs.

Simulation identity includes current geometry, source, ground, loads, transmission lines, frequency range, point count, and reference impedance. A later control/model change marks the completed simulation historical until rerun.

## Alignment and differences

Two user-visible modes exist:

1. **Exact frequency matches only:** compare only parsed frequencies equal within 0.001 Hz. No interpolation occurs.
2. **Linear SIMULATION R/X onto MEASUREMENT frequencies:** interpolate simulated R and X between bracketing solved frequencies, re-derive simulated SWR at the simulation reference impedance, and compare at the unchanged original measurement frequencies.

Linear mode never interpolates measurement data and never extrapolates beyond the simulation range. It is an approximation suitable only when the simulation grid resolves the impedance curve; sharp resonances require a denser solved grid and convergence review. The UI and CSV record whether each row is exact, linearly aligned, or not aligned.

Differences are always `MEASUREMENT − SIMULATION`. R and X are compared directly. SWR difference is withheld when the Touchstone and simulation reference impedances differ. The original overlay connects each source's own samples for plotting only; it does not create exported measurement samples.

## Why physical results differ

The UI explains these common causes:

- feed-line transformation between the VNA calibration plane and NEC source segment;
- unmodelled common-mode current on coax, mast, control cable or station wiring;
- connector, adapter and cable loss;
- soil moisture, layering, terrain, radial contact and other ground differences;
- nearby structures, vegetation, vehicles, supports and wiring;
- calibration standards, calibration plane, drift, cable movement and analyser dynamic range;
- actual wire sag, insulation, conductor taper, joints and construction tolerances;
- NEC thin-wire, segmentation, junction, geometry and ground-model limitations.

## Automated evidence

- Pure parser tests cover RI/MA/DB conversion, Touchstone 1.0 and bounded 2.0, source preservation, reference impedance, invalid/singular S11, malformed rows, unsupported parameters/keywords, duplicate frequencies, and non-finite values.
- Pure comparison tests cover exact matching, interpolation of simulation R/X, no extrapolation, unchanged measurement grids, reference-impedance mismatch, difference direction and CSV/JSON representation.
- A Playwright scenario imports an application-created NanoVNA-style `.s1p`, copies its range explicitly, executes five real local nec2c/Wasm frequencies, displays overlay/difference/table views, and verifies CSV/project downloads including exact raw source.
- Browser cases reject CSV and unordered data, cancel a 401-point solve atomically, check narrow layout, and collect console/page errors.
- Existing frequency-analyser and solver reference suites remain authoritative for the simulation path. The imported synthetic S11 fixture is parser/orchestration evidence, not a calibrated hardware reference.

## Remaining validation and manual checks

- Compare parser output against independently calculated RI/MA/DB fixtures and at least one RF library.
- Import files exported by identified versions of NanoVNA-Saver and NanoVNA-QT on Windows 11, preserving their complete source and metadata.
- Compare the same calibrated physical antenna at the feed point, through a characterised cable, and in a model that adds the known feed/nearby conductors.
- Check interpolation against a much denser solved sweep around resonance and prohibit conclusions from under-resolved curves.
- Test calibration-plane/reference-impedance workflows, very high SWR, `Γ` near 1, active/noisy `|Γ| > 1` samples, large files, UTF-8 failures, keyboard flow, chart colour/dash accessibility, and packaged Windows memory/performance.
- Add fuzz/property testing before broadening the parser or accepting untrusted emailed/downloaded files at release scale.

The feature adds original TypeScript, tests and documentation under GPL-3.0-or-later. It introduces no dependency, third-party dataset, analyser software, external executable, sample measurement, artwork, remote service, or network request.
