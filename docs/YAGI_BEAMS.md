# Yagi Beam Models

Status: implemented experimental workflow on `feature/yagi-beam-models`
Last reviewed: 2026-08-02

## Scope

The `/yagi-beams` workbench provides dedicated 2-element, 3-element, and configurable 2-to-8-element horizontal Yagi-Uda models. It is separate from the older generic `templates/yagi.ts` screen because directional metrics require an explicit forward-axis contract and stronger model/result identity.

The implemented controls are frequency, driven-element length, reflector length and spacing, zero to six independent director lengths/spacings, boom height, uniform wire/tube diameter, perfect or Sommerfeld/Norton ground, and 50/75-ohm SWR reference. Amateur-band buttons regenerate frequency-scaled starting dimensions. Every generated value is labelled as a starting point, not a resonant or optimized design.

The workbench displays immediate orbitable geometry, debounced calculation state, exact NEC deck, feed R/X and complex impedance, SWR, forward and rear gain, front-to-back and front-to-rear ratios, azimuth -3 dB beamwidth, take-off angle, azimuth/elevation polar cuts, an orbitable 3D pattern, and magnitude/phase currents for every element. Up to four solved models can be retained as labelled comparison traces. No optimizer is implemented.

## Typed model and coordinate contract

The SI-only `YagiAntennaModel` contains no NEC syntax. Elements lie parallel to X at the requested Z height. The driven element is at `y = 0`, the reflector is at negative Y, directors are placed at cumulative positive-Y spacing, and intended forward is always `+Y` (`phi = 90 degrees` in the NEC grid). The gray boom and yellow direction marker are visual aids, not conductors.

The dedicated adapter emits one `GW` card per element, `GE 1`, the selected `GN 1` or `GN 2` ground, a unit-voltage `EX` card on the driven element's exact centre segment, one `FR` frequency, element currents, and a 2-degree `RP` grid over the upper hemisphere. Eight-significant-digit coordinate formatting keeps every generated `GW` line within classic NEC's 80-column input limit. This was added after an independent NEC-2D run exposed that longer cards were not portable.

Automatic segmentation selects at least 11 odd segments per element, targets no more than `0.02 wavelength` per segment, caps each wire at 199 segments, and preserves the centre source. Diagnostics cover non-finite/out-of-range values, duplicate director identity, electrical thickness, segment-to-diameter ratio, very low height, unusually small element spacing, unexpected reflector/director ordering, and bounded interactive workload.

## Directional result definitions

- Forward gain is the maximum valid sample in the `+Y` hemisphere, not the unconstrained global maximum.
- Axial rear gain is sampled exactly 180 degrees behind the forward bearing at the same elevation.
- Front-to-back is forward gain minus axial rear gain.
- Maximum rear gain is the strongest sample anywhere in the rear hemisphere.
- Front-to-rear is forward gain minus maximum rear gain. It can be lower than front-to-back because a rear sidelobe need not lie on axis.
- Azimuth beamwidth uses interpolated -3 dB crossings around the explicit forward peak on the circular cut at the peak elevation.
- Take-off angle is `90 degrees - NEC theta` at the forward peak.

The 2-degree grid limits peak-angle reporting to 2-degree samples and makes interpolated beamwidth a post-processed estimate. The UI does not call front-to-back and front-to-rear interchangeable.

## Slider and comparison correctness

Geometry is regenerated immediately from the current immutable model. Solver work waits for 450 ms of stable input. A newer request aborts the active Wasm worker, increments request identity, and withholds all prior result-dependent plots and numbers. A late or aborted result cannot publish against a newer geometry. A 48-entry in-memory LRU cache is keyed by the complete serialized SI model, including ground and SWR reference. Saved comparisons are explicit immutable traces and therefore remain visible and labelled when the current model changes.

This proves the current single-page browser worker behavior. A future native runner still requires equivalent process-tree cancellation, output limits, and identity tests.

## Numerical evidence

### Exact-deck independent comparison

The three application-generated perfect-ground fixtures in `validation/yagi/` were run both through the pinned browser/Wasm solver and through the separately installed 4NEC2 merged NEC-2D build 2.7 (30-Jan-2008). `scripts/compare-yagi-4nec2.ps1` invokes the external engine directly, parses its output, checks numeric tolerances, and records executable SHA-256 `2FB857EF4EDD15C5A46FB2FE694502E965652E71F69855151B05210DDD410ACE`. The executable and its packaged models are not committed.

| 20 m perfect-ground fixture | R (ohm) | X (ohm) | Forward dBi | Forward theta | Axial rear dBi |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2-element | 57.7985 | +26.0063 | 11.85 | 62 degrees | -3.52 |
| 3-element | 20.5334 | +9.38469 | 13.38 | 64 degrees | -1.37 |
| 5-element | 24.6563 | +10.3626 | 14.87 | 66 degrees | -2.16 |

The comparator gate allows 0.02 ohm per impedance component, 0.02 dB forward/rear gain, and 0.01 degree peak theta. All three pass. This establishes same-deck agreement with another NEC-2 build; it does not establish that these starting dimensions are optimal or that perfect-ground gain predicts an installation.

### Published NBS/NIST sanity check

[NBS Technical Note 688, *Yagi Antenna Design*](https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote688.pdf) reports measured/modelled 400 MHz arrays at three wavelengths above ground. Its 0.4-wavelength-boom three-element case uses a `0.482 wavelength` reflector, `0.424 wavelength` director, `0.20 wavelength` spacings, a folded driven element, and measured half-power beamwidths of approximately 57 and 72 degrees with the rear response about 8 dB down. The application test scales those ratios to 14.175 MHz and obtains a 64.6-degree azimuth beamwidth and 12.1 dB axial front-to-back ratio.

This is an RF sanity envelope, not an exact oracle: the publication's folded/matched driven element, tube construction, measurement reference, and plane definitions are not identical to this straight perfect-conductor delta-gap model. The test deliberately does not tune dimensions to reproduce the publication.

The repository also records the official [NEC-2 GE](https://www.nec2.org/part_3/cards/ge.html) and [GN](https://www.nec2.org/part_3/cards/gn.html) definitions used in the adapter review. For strictly elevated elements, `GE 1` has no touching-ground current interpolation to perform and is compatible with the independent comparator.

## Review-loop findings

The code review separated the Yagi domain schema, geometry generator, NEC adapter, result definitions, scheduler, and UI. The RF review fixed the forward coordinate rather than inheriting “global maximum equals front,” distinguished axial rear from the worst rear hemisphere, and made the visual boom non-conducting. The solver-output review found and fixed the classic 80-column deck portability problem. Failure tests cover malformed output, absent currents/pattern, solver errors, and abort propagation. Browser regression covers 2/3/5-element solves, configurable directors, rapid sliders, comparison overlays, validity blocking, ground changes, 50/75-ohm SWR, mobile width, keyboard sliders, 3D canvases, and console errors.

## Known limitations and required next evidence

- Elements are straight, parallel, uniform perfect conductors. Tube taper, conductivity loss, folded/split driven geometry, gamma/beta/hairpin matching, traps, loading, insulated wire, and element correction are not represented.
- The boom, mast, clamps, feed line, balun/common-mode current, nearby structures, and terrain are absent.
- A continuous driven wire with a delta-gap source is an NEC abstraction, not a model of the physical feed gap and hardware.
- The same diameter applies to every element.
- Sommerfeld/Norton ground completes successfully but has not received the independent same-deck ground comparison used for the three perfect-ground fixtures.
- Segment-length, diameter, and 2-degree pattern-grid convergence studies remain release gates.
- The three comparator fixtures share the NEC-2 method. Published measurements add independent sanity evidence but are not a controlled equivalence study.
- Forward/rear metrics can be poor or negative for arbitrary user dimensions; the application reports them rather than silently flipping the boom direction.
- Absolute gain above ground includes ground reflection. It must not be read as free-space Yagi gain or guaranteed field performance.
- No frequency sweep, material-loss editor, matching network, optimizer, project persistence, or native packaged solver is added by this feature.
- Development-mode browser logs contain the inherited `THREE.Clock` deprecation warning from the current Three.js/React Three Fiber stack; the Yagi browser tests observe no console errors or uncaught page errors.

## Reproduction

From `frontend/`, run the unit, type, lint, build, and Playwright suites using the pinned toolchain in `BASELINE.md`. With the separately installed comparator at its documented default path, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\compare-yagi-4nec2.ps1
```

Review the engine description and SHA-256 in the output. A missing or different external executable must be treated as a new comparison environment, not silently accepted.
