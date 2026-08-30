# Frequency Analyser

Status: implemented on `feature/frequency-analyser`; validation evidence is limited to the checks listed below

## Supported workflow

The `/frequency-analyser` laboratory sweeps the antenna currently selected and parameterised in the main Simulator. A direct visit or page refresh therefore starts from the Simulator's default half-wave dipole. The header names the antenna under test and links back to the Simulator. Arbitrary Wire Editor models are not yet an analyser input.

The controls support start/stop and reversible centre/span entry, 3–401 linearly spaced points, Region 1 amateur-band presets from 160 m through 6 m, and a positive reference impedance up to 1000 ohms with 50/75-ohm shortcuts. A completed result remains visibly marked as the last result if its range controls are subsequently changed.

Available views are SWR, resistance, reactance, impedance magnitude, return loss, reflection-coefficient magnitude, exact cursor values, an optional Smith chart, and paired azimuth/elevation cuts for one selected solved frequency. The cuts are produced by a separately labelled full-pattern NEC calculation; moving the cursor or changing the model hides the old cuts until the newly selected conditions are solved. Up to four immutable completed sweeps can be saved and overlaid. The active analyser chart can be exported as PNG; active plus visible saved data can be exported as CSV. Project-data export is versioned JSON containing the antenna request snapshot, completed configuration, raw parsed frequency records, derived records, warnings, and saved overlays. Import of that analyser JSON is not implemented in this phase.

The separate experimental `/measurement-comparison` route now consumes this same impedance-sweep service and compares it with immutable one-port Touchstone measurement data. It does not import analyser project JSON or alter this page's sweep/overlay state. See [`MEASUREMENT_COMPARISON.md`](MEASUREMENT_COMPARISON.md).

## Calculation definitions

The NEC engine supplies frequency and complex feed impedance `Z = R + jX`. For a positive real reference impedance `Z0`, the analyser independently derives:

```text
|Z| = sqrt(R² + X²)
Γ = (Z - Z0) / (Z + Z0)
SWR = (1 + |Γ|) / (1 - |Γ|), for |Γ| < 1
return loss = -20 log10(|Γ|)
```

A perfect match has `Γ = 0`, SWR 1, and infinite return loss. `|Γ| >= 1` is retained and reported with infinite SWR; the coefficient is not silently clamped. CSV uses the literal `Infinity` where a finite decimal does not exist. Changing `Z0` re-derives these quantities from unchanged solver impedance and does not run NEC again.

## Solver execution and responsiveness

One local browser Web Worker runs the existing GPL nec2c WebAssembly engine. The analyser generates exactly one NEC `FR` card for the requested linear sweep, suppresses current printing with `PT -1`, and uses `XQ 0` instead of `RP`. This avoids calculating a far-field angular grid at every frequency. The existing NEC output parser reads every `ANTENNA INPUT PARAMETERS` table into the normal `FrequencyResult` contract.

NEC execution remains synchronous inside its worker, not on the React/main thread. Cancel terminates that worker, rejects its outstanding request, and creates a fresh worker for the next job. A monotonically increasing UI job identity prevents a superseded completion or rejection from publishing state. No partial result is presented after cancellation.

After a completed impedance sweep, the page requests one independent full-pattern deck at the selected frequency (initially the minimum-SWR point). That job is cancellable and carries an exact model/frequency identity. It does not add `RP` work to every sweep point and it cannot publish an earlier frequency's pattern after the cursor changes.

## Evidence completed on this branch

- Unit calculations cover matched, real, complex, short-circuit, alternate-reference, limit, centre/span, and cursor-selection cases.
- Deck regression proves one `FR` block, one `XQ`, no `RP`, and suppressed current printing.
- Service regression checks one solver call, signal propagation, exact point count, non-finite impedance rejection, and cancellation propagation.
- A Playwright test runs the real local nec2c/Wasm solver for an 11-point sweep and verifies the parsed point count and all six views.
- Browser tests cover centre/span entry, a saved overlay, optional Smith chart, 50/75-ohm re-derivation, CSV/PNG/project downloads, real worker cancellation, no partial result, and browser-console/page errors.
- Existing parser and whole-application regression suites are run before branch completion.

These are implementation and same-engine regression checks, not independent electromagnetic validation. They do not prove that a model is physically accurate.

## Known limits and manual checks

- The antenna geometry and segmentation are fixed for the sweep. Users must check that segment length/radius and ground assumptions remain valid at the highest frequency; an analyser sweep does not automatically change geometry between points.
- The batched `XQ` sweep intentionally contains no radiation patterns, gain, efficiency, or currents. The paired cuts come from the separate selected-frequency full-pattern calculation and therefore add one solver job when requested.
- Linear sweeps only are supported. Logarithmic, segmented, adaptive, and live VNA acquisition modes are not implemented.
- Overlays are in-memory until exported; analyser project-data import is not yet available.
- The PNG represents the currently selected chart, not the Smith chart or a composite report.
- A Windows 11 hardware/browser manual pass should confirm cancellation latency, 401-point runtime, PNG legibility in light/dark themes, keyboard cursor use, and downloaded-file handling.
- Independent sweep validation must compare common frequencies with separate single-frequency NEC runs and with at least one established NEC package before any release accuracy claim. See `VALIDATION_PLAN.md`.
