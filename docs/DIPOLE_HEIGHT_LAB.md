# Dipole height laboratory

Status: implemented and tested on `feature/dipole-height-lab`  
Last reviewed: 2026-08-02

## Scope and claim boundary

The laboratory demonstrates how height changes the NEC-2 pattern of one horizontal, centre-fed, perfect-conductor dipole. It uses the verified dipole's typed SI model, dedicated NEC adapter, exact displayed-deck worker route, parser, and result validation. The model is exactly 0.5λ long, 1 mm in diameter, X-oriented, and driven at its centre segment.

The current browser build executes the pinned nec2c WebAssembly engine locally and makes no network request for a calculation. This is an experimental inherited-branch implementation, not proof that the planned Windows desktop/native architecture is complete. Real/perfect-ground execution works in the tested browser build; real-ground numerical accuracy is not yet independently validated.

## Interaction and calculation contract

1. The slider and exact numeric field update one canonical height ratio. Metres/feet are display conversions; the solver model receives metres.
2. Frequency changes preserve height in wavelengths, so physical height and the exact 0.5λ wire length change together.
3. Side-view and 3D geometry update in the same render as the controls.
4. The scheduler waits 450 ms after the last change before invoking NEC.
5. A superseding request clears a pending timer or aborts an in-flight request. Because nec2c blocks synchronously inside the Web Worker, abort terminates the worker.
6. The complete SI model is the result/cache key. The UI displays a current result only when its key matches the controls.
7. The memory cache retains at most 40 exact model results. It is not persisted and is not an accuracy oracle.
8. Up to four explicitly saved, labelled traces may remain visible as comparisons. They are dashed and never labelled as the current result.

The automatic sweep visits 0.10λ, 0.25λ, 0.50λ, 1.00λ, and 2.00λ sequentially. It waits for each current result before advancing and reuses an exact cached result where available.

## Displayed quantities and coordinates

- Take-off angle is `90° - NEC theta` at the solver's global sampled maximum.
- Peak gain is the maximum absolute dBi on the requested grid.
- Low-angle gain is the greatest absolute dBi sample from 0° through 10° elevation, inclusive.
- Elevation and azimuth plots show absolute dBi on a fixed -30 to +12 dBi scale or **Relative to peak** on a -40 to 0 dB scale. In the relative view, each trace's strongest point is 0 dB and other points are labelled by how far they fall below that trace's cut peak.
- Normalisation changes display values only; it does not change solver output or saved absolute data.
- The 3D mesh uses NEC theta/phi samples and closes the phi seam. Radius and colour use the selected display scale.
- PNG exports the elevation SVG rendering. CSV exports absolute and normalised numeric samples for the current and saved traces.

The exact NEC deck requests five-degree theta and phi spacing. Reported angles therefore have five-degree sampling precision; no interpolated maximum is claimed.

## Perfect-ground regression evidence

All cases use 14.1 MHz, a 10.631 m dipole, 1 mm wire, and the same pinned nec2c/Wasm build. These values are same-engine regression envelopes and are not independent electromagnetic truth.

| Height | R (Ω) | X (Ω) | Peak gain (dBi) | Take-off | Low-angle gain shown |
|---:|---:|---:|---:|---:|---:|
| 0.10λ | 23.63 | +67.01 | 8.83 | 90° | -23.14 dBi |
| 0.25λ | 94.11 | +75.78 | 7.49 | 90° | -21.23 dBi |
| 0.50λ | 72.80 | +25.90 | 8.43 | 30° | 2.73 dBi |
| 1.00λ | 76.45 | +34.54 | 8.23 | 15° | 7.21 dBi |
| 2.00λ | 77.64 | +39.38 | 8.14 | 60° | 7.18 dBi |

At 2λ the pattern has multiple elevation lobes. The 60° global maximum does not mean the low-angle lobe disappeared; the separately calculated 0–10° metric is 7.18 dBi. This distinction is why both quantities are displayed.

## Test and review evidence

The completed loops cover:

- rapid preset changes before debounce and while a result is current;
- metres/feet editing and wavelength/SI conversion;
- worker and injected-solver cancellation, timeout, and stale-promise rejection;
- polar normalisation and non-NaN SVG paths;
- four comparison overlays and refusal of a fifth;
- real-solver 0.10/0.25/0.50/1.00/2.00λ regression cases;
- full automatic sweep completion;
- PNG and CSV downloads;
- a 390 × 844 responsive viewport and slider keyboard operation;
- type-check and production build, 423 passing unit tests in 27 files, 14 passing real-browser tests including all inherited baseline/verified regressions, and browser console review.

The React Three Fiber dependency currently emits a Three.js `Clock` deprecation warning when a Canvas starts. No application exception or WebGL error was found. Replacing framework internals solely to silence that upstream warning was judged higher risk than documenting it; dependency upgrades remain normal maintenance.

## Critical review against this design

| Objection | Finding and disposition |
|---|---|
| Terminating a shared worker is coarse cancellation. | Valid. It is deterministic for this single lab, but a future concurrent job manager needs per-job worker/process ownership or an explicit queue. Documented in D-016. |
| A 450 ms debounce may be too short on slow Windows hardware. | Unmeasured. It is a tested interaction default, not a product-wide constant. Measure native startup/cancellation latency before reuse. |
| Forty cached grids can consume substantial memory. | Valid but bounded. This page uses small five-degree grids; profile representative future grids before adopting the limit elsewhere. |
| A colourful 3D surface may imply more angular precision than the solver supplied. | Valid. The UI states five-degree sampling; raw 2D sample-derived values and CSV remain inspectable. Add optional sample markers in a later visualization review. |
| A symmetric dipole cannot prove compass handedness or mirroring. | Valid for this lab alone. Later asymmetric Yagi/phased-array cases cover directional mapping; this limitation does not broaden the dipole evidence. |
| The perfect-ground family only compares the application with itself. | Confirmed. It is explicitly labelled regression evidence; an established package and one-degree convergence study remain open. |
| Preserving ratio on frequency changes may surprise users expecting fixed metres. | Deliberate for an educational height-in-wavelengths lab and stated beside the control. A general editor must expose parameter dependency explicitly. |
| Saved traces can compare different frequency/ground settings and mislead. | Labels and CSV include height, frequency, and ground. Conductivity/permittivity remain available only in CSV; a future legend should show every differing parameter. |

## Remaining experimental verification

1. Run the five height decks byte-for-byte in 4NEC2 or another established package and record exact engine, ground, and grid settings.
2. Repeat with one-degree theta sampling and quantify peak/take-off movement, especially the 2λ multi-lobe case.
3. Validate average/pastoral/dry/custom real-ground values against a matched Sommerfeld-Norton reference.
4. Measure debounce, cancellation latency, peak memory, WebGL frame rate, and cache size on low-end Windows 11 hardware.
5. Exercise loss of WebGL, worker startup failure, and repeated cancel/recreate cycles in a packaged offline Windows build.
6. Prove azimuth orientation and 3D handedness with an asymmetric antenna before reusing these views generally.
7. Confirm exported PNG styling across Chromium/WebView2 theme modes and high-DPI displays.
