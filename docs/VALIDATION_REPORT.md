# HF Antenna Studio Engineering Validation Report

Campaign: `hfas-validation-campaign-2026-08-06`

Branch: `feature/validation-campaign`
Status: **PASS within the exact models and tolerances recorded here**

## Executive result

Nine primary cases covering all eight requested antenna families were rerun through HF Antenna Studio's pinned local nec2c/WebAssembly solver and checked against published NEC results, a separately installed established NEC-compatible package, and appropriate analytical symmetry/gain bounds. The external comparator campaign also reran seven supplemental decks, for 16 exact-deck external runs in total.

No new calculation bug was confirmed. All primary metric differences are inside their declared pre-existing tolerances. The largest differences are the published 38 MHz dipole's `0.20 Ω` resistance and `0.32 Ω` reactance differences; these remain visible and are classified **Numerical tolerance** after a controlled exact-deck comparator showed that the application's 21-segment deck produces the same result in both solver builds. The publication used 11 segments.

This report does not validate every antenna, ground, frequency, segmentation, feed system, or physical installation. Most exact-deck comparisons use the same NEC-2 method in different implementations. Agreement is evidence against deck-generation, parser, coordinate, and result-metric faults; it is not independent proof that NEC-2's physical assumptions fit an arbitrary real antenna.

The machine-readable record is [`validation/campaign/reference-cases.json`](../validation/campaign/reference-cases.json). Every fixture is SHA-256 pinned, and automated tests fail if a deck, recorded difference, tolerance, or family regression contract drifts.

## Engines and environment

| Role | Program/build | Identity |
|---|---|---|
| Application | KJ7LNW nec2c WebAssembly, documented project version v1.3.3 | Source commit `55be1e0e3fe5ee9dad4ce6050711450d19c562fd` |
| Established-package comparator | 4NEC2 merged NEC-2D build 2.7, 30-Jan-2008, MinGW/G77 | `nec2dxs11k.exe` SHA-256 `2FB857EF4EDD15C5A46FB2FE694502E965652E71F69855151B05210DDD410ACE` |
| Host used for this campaign | Windows 11, PowerShell, browser-local Wasm application | Local, offline-capable solver path; comparator installed separately at `C:\4nec2\exe\nec2dxs11k.exe` |

The 4NEC2 executable, its application assets, and packaged models are not in this repository. The comparator is invoked directly with project-authored exact decks in isolated temporary directories. A different executable hash is a different validation environment and the unified runner fails closed.

## Method and controls

1. Select one reproducible project model per required family, plus broadside and end-fire states for the phased array.
2. Retain complete SI geometry, segment count, feed identity, frequency, ground cards, and radiation grid in a committed NEC fixture.
3. Verify that generated application decks remain byte-identical to their fixtures. The new dipole fixtures receive the same identity gate already used by vertical, loop, Yagi, and phased-array families.
4. Execute the displayed/generated deck through the pinned Wasm solver in the existing browser regression suite.
5. Execute the byte-identical deck through the separately installed 4NEC2 NEC-2D engine.
6. Compare R, X, gain, direction, F/B, take-off angle, or symmetry only where each quantity has an unambiguous definition for that model.
7. Recompute 50-ohm SWR from application R/X rather than accepting a separate oracle value.
8. Record signed application-minus-reference differences. Do not alter geometry or calculation constants to reduce a discrepancy.
9. Classify and investigate every discrepancy using the requested categories.

NEC theta is measured from +Z. For above-ground models the displayed take-off angle is `90° - theta`. Directional Yagis declare +Y as forward. Phased-array compass headings are transformed explicitly from NEC X/Y coordinates. These conversions explain apparently different raw theta/phi and UI-angle values; they are not numerical discrepancies.

## Tolerances

| Evidence type | R and X | Gain/forward/rear | Direction/take-off | Reason |
|---|---:|---:|---:|---|
| Published 38 MHz dipole with different segmentation | 0.50 Ω/component | 0.05 dB | Not used as a directional oracle | Published deck uses 11 segments; application policy uses 21 |
| Exact-deck 4NEC2 comparisons | 0.02 Ω/component | 0.02 dB | 0.01° at a sampled grid point | Covers printed numeric precision and small implementation/format differences |
| Derived F/B | N/A | 0.04 dB | N/A | Sum of two independently rounded axial gain samples |

The grids are 5° for the dipoles/vertical and 2° for loop/Yagi/phased cases. Angle agreement means agreement at that requested grid; it does not imply sub-grid physical precision.

## Primary comparison results

`Δ` is HF Antenna Studio minus reference. SWR is derived at 50 Ω from the recorded application impedance.

| Model | Frequency / ground | HF Antenna Studio | Trustworthy reference | Difference | Classification |
|---|---|---|---|---|---|
| Free-space dipole | 38 MHz / free space | `77.61 + j45.41 Ω`, SWR `2.2914`, `2.16 dBi` | Ellingson published NEC-2: `77.41 + j45.09 Ω`, `2.16 dBi` | `ΔR +0.20 Ω`, `ΔX +0.32 Ω`, `ΔG 0.00 dB` | Numerical tolerance — **pass** |
| Dipole at 0.5λ | 14.1 MHz / perfect | `72.80 + j25.90 Ω`, SWR `1.7584`, `8.43 dBi`, take-off `30°` | 4NEC2: `72.795 + j25.9006 Ω`, `8.43 dBi`, take-off `30°` | `+0.005 Ω`, `-0.0006 Ω`, `0 dB`, `0°` | Numerical tolerance — **pass** |
| Quarter-wave vertical | 14.1 MHz / perfect | `34.03 - j15.58 Ω`, SWR `1.7066`, `5.13 dBi`, take-off `0°` | 4NEC2: `34.0296 - j15.5759 Ω`, `5.13 dBi`; analytic ideal about `5.15 dBi` | `+0.0004 Ω`, `-0.0041 Ω`, `0 dB`; analytic gain `-0.02 dB` | Numerical tolerance — **pass** |
| Full-wave square loop | 14.175 MHz / perfect | `106.289 - j72.509 Ω`, SWR `3.2807`, `8.46 dBi`, take-off `36°` | 4NEC2 same values at recorded precision | Zero at recorded precision | Numerical tolerance — **pass** |
| Delta loop, bottom feed | 14.175 MHz / perfect | `103.861 - j77.3984 Ω`, SWR `3.4198`, `7.94 dBi`, take-off `42°` | 4NEC2 same values at recorded precision | Zero at recorded precision | Numerical tolerance — **pass** |
| 2-element Yagi | 14.175 MHz / perfect | `57.80 + j26.01 Ω`, SWR `1.6485`, forward/rear `11.85/-3.52 dBi`, F/B `15.37 dB`, take-off `28°` | 4NEC2 `57.7985 + j26.0063 Ω`; same pattern metrics | `+0.0015 Ω`, `+0.0037 Ω`; pattern zero at printed precision | Numerical tolerance — **pass** |
| 3-element Yagi | 14.175 MHz / perfect | `20.53 + j9.38 Ω`, SWR `2.5377`, forward/rear `13.38/-1.37 dBi`, F/B `14.75 dB`, take-off `26°` | 4NEC2 `20.5334 + j9.38469 Ω`; same pattern metrics | `-0.0034 Ω`, `-0.00469 Ω`; pattern zero at printed precision | Numerical tolerance — **pass** |
| 2-vertical broadside array | 14.1 MHz / perfect | opposite-axis gain `6.20/6.20 dBi`, F/B `0.00 dB`, take-off `2°` | 4NEC2 exact deck plus theoretical broadside symmetry | Zero at recorded precision | Numerical tolerance — **pass** |
| 2-vertical end-fire array | 14.1 MHz / perfect | forward/reverse `8.18/-26.72 dBi`, F/B `34.90 dB`, heading `90°`, take-off `2°` | 4NEC2 exact deck plus phase-reversal sanity | Zero at recorded precision | Numerical tolerance — **pass** |

Ideal-current phased-array mode has no single physical input port, so feed R/X and SWR are intentionally unavailable. Reporting a fabricated feed impedance would be less correct than leaving those metrics absent.

## Model definitions and pattern checks

### Free-space dipole

- Dimensions: 3.9474 m total length, 0.1 mm diameter, X-oriented and centre fed at 38 MHz.
- Segmentation: application 21 segments, centre segment 11; publication 11 segments.
- Cards/settings: `GE 0`, `GN -1`, unit-voltage source, 5° full-sphere pattern.
- Pattern evidence: the exact external run gives `2.16 dBi` at the reviewed broadside sample `(theta 90°, phi 90°)` and `-999.99 dBi` at the axial sample `(theta 90°, phi 0°)`, reproducing the thin-dipole broadside/null shape at solver output precision.
- Published comparison: [Steve Ellingson, *Use of NEC-2 to Calculate Collecting Area*](https://leo.phys.unm.edu/~lwa/memos/memo/lwa0065a.pdf). The memo also records the vanishingly thin analytical gain near 2.15 dBi.

### Dipole over ground

- Dimensions: 10.631 m length, 1 mm diameter, 10.631 m high (`0.5λ`) at 14.1 MHz.
- Segmentation: 21, centre source on segment 11.
- Ground: elevated geometry with `GE -1`; infinite perfect ground `GN 1`.
- Pattern: 5° upper hemisphere. Both engines identify NEC theta `60°`, converted to the displayed `30°` take-off angle.
- The exact-deck comparison closes the previously documented established-package gap for a perfect-ground dipole. Real ground remains separate and unvalidated by this case.

### Quarter-wave vertical

- Dimensions: 5.049695658 m (`0.2375λ`) ground-contact vertical, 2 mm diameter at 14.1 MHz.
- Segmentation/feed: 13; source on segment 1.
- Ground: `GE 1`/`GN 1`, infinite perfect plane, no explicit radials.
- Pattern: 5° upper hemisphere. The comparator records zero azimuth spread at its peak-theta row. The 5.13 dBi peak is within 0.02 dB of the approximately 5.15 dBi image-theory sanity value.
- The `-j15.58 Ω` reactance is expected: the convenient 0.2375λ starting wire is not claimed resonant.

### Full-wave square loop

- Dimensions: 5.3930918 m square; lower wire at 5.2873449 m; 2 mm conductor at 14.175 MHz.
- Segmentation/feed: 54 total, including an explicit one-segment bottom-centre source bridge.
- Ground/grid: perfect ground, 2° upper hemisphere.
- The perimeter is a starting dimension only. The exact `-j72.509 Ω` is retained rather than tuned toward resonance.

### Delta loop

- Dimensions: 7.1907892 m base, lower height 5.2873449 m, apex 11.514751 m, 2 mm conductor at 14.175 MHz.
- Segmentation/feed: 55 total, including the explicit one-segment bottom-centre bridge.
- Ground/grid: perfect ground, 2° upper hemisphere.
- The feed-conductor orientation comes from the bridge geometry. Neither the template name nor this result is used to claim polarisation.

### 2-element Yagi

- Geometry: 10.6592874 m reflector and 10.0671048 m driven element, 3.172407 m spacing, 10.57469 m height, 25.4 mm diameter.
- Segmentation: 27 + 25 = 52; source on the driven centre segment.
- Ground/grid/axes: perfect ground, 2°, explicit +Y forward and opposite axial rear.
- Forward, axial rear, F/B, and take-off agree. This does not make the starting dimensions optimal.

### 3-element Yagi

- Geometry: the 2-element geometry plus a 9.5595196 m director 4.229876 m beyond the driven element.
- Segmentation: 27 + 25 + 23 = 75.
- Ground/grid/axes: perfect ground, 2°, explicit +Y forward.
- Secondary published sanity: [NBS Technical Note 688, *Yagi Antenna Design*](https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote688.pdf) gives a non-identical 0.4λ-boom three-element case with roughly `57–72°` half-power beamwidth and rear response about 8 dB down. The scaled HFAS sanity model gives `64.6°` and `12.1 dB`. This is classified **Geometry difference**, not treated as an exact pass: the publication used a folded driver, different conductor/construction, and a measured comparison setup.

### Two-element phased vertical array

- Geometry: two 5.0496957 m verticals, 5.3154692 m (`0.25λ`) spacing, 2 mm diameter, 13 segments each, perfect ground at 14.1 MHz.
- Mode: ideal current/phase. NEC voltage sources are coupled-current calibration values, not a physical coax-feed prescription. Parsed feed currents are separately required to match the requested phasors.
- Broadside: equal opposite `6.20 dBi` lobes; heading is labelled an ambiguous axis.
- End-fire: target element-2 phase `-90°`, `8.18/-26.72 dBi` forward/reverse, `34.90 dB` F/B, heading `90°`.
- Reversal fixture: target phase `+90°` preserves gain/F/B and moves heading to `270°`, exactly 180° away at the 2° grid.

## Discrepancy register

No failed comparison is omitted.

| ID | Observation | Material? | Classification | Investigation and disposition |
|---|---|---:|---|---|
| VC-001 | Published 38 MHz dipole differs by +0.20 Ω R and +0.32 Ω X | No; below declared 0.50 Ω | Numerical tolerance | Published 11 versus application 21 segments. The application deck produces `77.6053 + j45.4105 Ω` in the external engine, ruling out an application parser/adapter discrepancy at the compared precision. Retained unchanged. |
| VC-002 | Ideal vertical peak is 5.13 dBi versus approximate analytic 5.15 dBi | No | Numerical tolerance | Finite thickness/length and sampled NEC model versus ideal image-theory bound. Exact decks agree cross-build. |
| VC-003 | Application R/X displays differ from external exact rows by up to 0.005 Ω | No | Numerical tolerance | Presentation rounding; raw external values and tolerances are recorded. No code change. |
| VC-004 | NBS three-element Yagi sanity case has 12.1 dB F/B versus publication's roughly 8 dB | Expected/non-equivalent | Geometry difference | Folded versus straight driven element, construction/diameter, measurement reference and model planes differ. Used only as a broad beamwidth/rear-response sanity envelope. |
| VC-005 | Broadside array has no unique heading | No; theoretical symmetry | Numerical tolerance | Equal opposite maxima are expected. UI correctly reports an axis/ambiguity rather than arbitrarily labelling one direction forward. |

Classification totals for the recorded campaign:

| Classification | Primary cases | Secondary discrepancies | Open material failures |
|---|---:|---:|---:|
| Bug | 0 | 0 | 0 |
| Numerical tolerance | 9 | 4 | 0 |
| Different solver implementation | 0 | 0 | 0 |
| Different ground model | 0 | 0 | 0 |
| Geometry difference | 0 | 1 | 0 |
| Unknown | 0 | 0 | 0 |

The exact-deck cases use different solver builds but did not show a material difference attributable to implementation. Therefore they are not labelled **Different solver implementation** merely because two executables were involved. No comparison with mismatched ground formulations was accepted into the primary table.

## Confirmed bugs and corrections

No new confirmed calculation bug was found, so no electromagnetic calculation behaviour was changed.

The campaign added evidence and test infrastructure rather than tuning calculations:

- added two deterministic dipole fixtures and a separate 4NEC2 comparator;
- added an exact free-space axial-null gate and vertical azimuth-symmetry gate;
- pinned primary decks and the comparator executable by SHA-256;
- linked the campaign record to existing family regression constants;
- added a unified fail-closed campaign runner.

Previously documented bugs—Yagi 80-column deck portability, incompatible `GN 2` radial-screen use, and absolute/local current-segment mapping—remain covered by their existing regressions, but they are not presented as discoveries of this campaign.

## Supplemental exact-deck results

The unified command also reruns these models beyond the nine primary states:

- 40 m and 10 m ideal perfect-ground verticals;
- diamond loop, two-element cubical quad, and single-band hexbeam;
- five-element Yagi; and
- reversed end-fire phased array.

All pass their existing exact-deck tolerances. The 4NEC2 runner executes 16 decks across five comparator families.

## Automated regression fixtures

- `validation/dipole/*.nec`
- `validation/vertical/*.nec`
- `validation/loop-beams/*.nec`
- `validation/yagi/*.nec`
- `validation/phased-arrays/*.nec`
- `validation/campaign/reference-cases.json`
- `frontend/src/features/validation-campaign/__tests__/campaign.test.ts`
- relevant real-solver Playwright files under `frontend/e2e/`

Run the external exact-deck campaign:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-validation-campaign.ps1
```

Run the application solver/reference regressions from `frontend/` with the pinned Node runtime:

```powershell
npm test
npm run test:smoke
```

The full completion run must also include type checking, linting, and the production Wasm build described in [`BASELINE.md`](BASELINE.md).

## Limitations and next validation priorities

1. Add independent finite Sommerfeld/Norton ground comparisons. Perfect ground and free space dominate this campaign; a different ground kernel was not treated as interchangeable.
2. Run systematic 0.01λ/0.02λ/0.04λ segmentation and 1°/2°/5° pattern-grid convergence, especially at feed bridges, array nulls, and ground contact.
3. Add a second solver family rather than relying mainly on two NEC-2 implementations.
4. Add package-authored reference decks where redistribution/provenance permits; project-authored decks can expose cross-build drift but not every shared modelling error.
5. Validate conductor loss, realistic radial fields, feed/matching networks, mast/feed-line/common-mode effects, and real installations separately.
6. Perform controlled calibrated measurements with complete construction and environment records. Measurement agreement is not replaced by same-method solver agreement.
7. Repeat on the packaged Windows 11 desktop runtime, offline, with the exact shipped solver binary; this campaign exercises the browser/Wasm development baseline.
8. Preserve raw comparator outputs or a signed machine-readable result bundle in a future release process after licensing, size, and provenance policy is agreed.

## Conclusion

Within the explicitly recorded geometry, perfect/free-space ground models, grids, and tolerances, HF Antenna Studio reproduces the selected trustworthy NEC references and analytical direction/symmetry checks. The campaign materially improves confidence in deck identity, impedance parsing, gain/direction mapping, take-off conversion, and directional metrics. It does not establish universal NEC accuracy or predict an unmodelled physical installation.
