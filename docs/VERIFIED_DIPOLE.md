# Verified centre-fed dipole vertical slice

Status: implemented and tested on `feature/verified-dipole-model`
Last reviewed: 2026-08-02

## Claim boundary

This branch contains a working, browser-local end-to-end model for one centre-fed horizontal dipole. The exact generated NEC deck is executed by the pinned nec2c WebAssembly build and the parsed result is checked before display.

This is a verified development slice, not a general accuracy certificate for AntennaSim, NEC-2, arbitrary wire structures, or ground modelling. The free-space result has an independent published NEC comparison. The perfect- and real-ground paths have execution and regression evidence but still need the planned 4NEC2 or equivalent established-package comparison.

## Traceable pipeline

| Stage | Implementation | Boundary |
| --- | --- | --- |
| User parameters | `VerifiedDipolePage.tsx` | Display values in MHz and selectable m/mm/ft/in |
| Internal antenna model | `features/verified-dipole/model.ts` | Typed, solver-independent, SI-only schema |
| Geometry assessment | `validation.ts` and `segmentation.ts` | Rejects invalid values; returns explicit warnings and an odd segment count |
| NEC adapter | `nec-adapter.ts` | One deterministic adapter; one continuous `GW` wire and a centre-segment `EX` source |
| Solver invocation | `WasmEngine.runDeck` and `wasm/worker.ts` | Sends the byte-identical displayed deck to a worker, MEMFS, and pinned nec2c/WASM |
| Parsed output | existing `parseNecOutput` | R, X, pattern grid, gain maximum, and per-segment complex current |
| Result validation | `result.ts` | Rejects missing/non-finite data, recomputes selected-reference SWR, normalizes cuts |
| UI | `/verified-dipole` | Summary, azimuth/elevation plots, current magnitude/phase table, exact NEC deck |

The worker writes the deck to `/input.nec`, calls `callMain(["-i", "/input.nec", "-o", "/output.out"])`, reads `/output.out`, and parses it locally. A 120-second outer timeout resets the worker; the feature service also has a separately tested timeout for injected or future adapters.

## Model contract

The current schema accepts:

- frequency in Hz;
- total dipole length, wire diameter, and height in metres;
- free space, perfect ground, or real ground;
- real-ground conductivity in S/m and relative permittivity;
- 50- or 75-ohm real reference impedance.

The conductor is currently perfect and the wire is oriented along the NEC X axis. Display units convert only at the UI boundary. Changing a display unit preserves the SI value.

## NEC representation

- A single continuous odd-segment `GW` card represents the dipole.
- The voltage source is `EX 0 1 <centre-segment> 0 1 0`.
- `GE 0`/`GN -1` represent free space.
- `GE -1`/`GN 1` represent perfect ground.
- `GE -1`/`GN 2 ... er sigma` select Sommerfeld-Norton real ground.
- `PT 0` requests currents.
- `FR 0 1` requests one frequency.
- `RP 0` requests a five-degree grid: theta 0–180 degrees in free space or 0–90 degrees above ground, and phi 0–355 degrees.

Take-off angle is `90° - NEC theta` for a ground model. It is deliberately reported as not applicable in free space. Pattern values remain absolute dBi in the result model; 2D cuts also carry a display-only normalization capped at -40 dB.

## Automatic segmentation and geometry diagnostics

The adapter targets 0.025 wavelength per segment, uses at least three and at most 199 odd segments, and keeps the source on the middle segment. It checks:

- segment length below 0.1 wavelength;
- a warning above 0.05 wavelength;
- rejection below 0.001 wavelength;
- segment length at least twice the wire radius for the ordinary thin-wire kernel;
- positive finite geometry and 1.8–54 MHz frequency;
- wire surface above a selected ground plane;
- implausibly thick wire and a suspect radius/wavelength ratio.

These thresholds follow the [NEC-2 structure modelling guidance](https://www.nec2.org/part_3/secii.html). They are conservative heuristics, not proof of convergence. The UI exposes the chosen segment and feed numbers and keeps warnings visible.

The [`GE` card guidance](https://www.nec2.org/part_3/cards/ge.html) defines zero as no geometry ground plane. A non-zero flag is required when ground is present; this adapter uses `-1` because its dipole is always elevated and must not acquire the `GE 1` current interpolation intended for a segment that touches ground.

## Validation evidence

### Independent published NEC-2 reference

Steve Ellingson's Virginia Tech/UNM memo, [Use of NEC-2 to Calculate Collecting Area](https://leo.phys.unm.edu/~lwa/memos/memo/lwa0065a.pdf), publishes a 38 MHz, 3.9474 m long, 0.1 mm diameter, free-space dipole deck and results. It uses 11 segments and reports `77.41 + j45.09 Ω` and `2.16 dB` maximum gain.

HF Antenna Studio's automatic policy selects 21 segments for the same physical model and produced:

| Quantity | Published NEC-2 | HF Antenna Studio | Absolute difference | Test tolerance |
| --- | ---: | ---: | ---: | ---: |
| Resistance | 77.41 Ω | 77.61 Ω | 0.20 Ω | 0.50 Ω |
| Reactance | +45.09 Ω | +45.41 Ω | 0.32 Ω | 0.50 Ω |
| Maximum gain | 2.16 dBi | 2.16 dBi | 0.00 dB | 0.05 dB |

The difference is not tuned away: the segment counts differ by design, and both are recorded. The result also agrees with the memo's 2.15 dBi vanishingly thin analytic benchmark. The comparison is automated in `e2e/verified-dipole-validation.spec.ts`.

### Same-engine regression set

The following 14.1 MHz cases use a 10.631 m half-wave dipole and 1 mm wire diameter. They are committed as regression envelopes, not independent truth. “Height” is the dipole height above perfect ground; the three requested 0.25λ, 0.5λ, and 1λ cases are interpreted as height ratios.

| Case | Ground / height | R (Ω) | X (Ω) | Gain (dBi) | Take-off |
| --- | --- | ---: | ---: | ---: | ---: |
| Half-wave free space | Free space | 78.27 | +44.44 | 2.16 | N/A |
| Half-wave over perfect ground | 0.10λ | 23.63 | +67.01 | 8.83 | 90° |
| Dipole at 0.25λ | Perfect / 0.25λ | 94.11 | +75.78 | 7.49 | 90° |
| Dipole at 0.5λ | Perfect / 0.50λ | 72.80 | +25.90 | 8.43 | 30° |
| Dipole at 1λ | Perfect / 1.00λ | 76.45 | +34.54 | 8.23 | 15° |
| Dipole at 2λ | Perfect / 2.00λ | 77.64 | +39.38 | 8.14 | 60° |

### External-package status

An informational run in the independent rftools.io NEC2 antenna simulator showed 2.1 dBi and a 21-segment half-wave free-space dipole. Its UI did not expose enough exact geometry or numeric impedance data to qualify as release evidence, so it is not an automated oracle.

PyNEC/NEC2++ 1.8.2 and necpp 2.3.2 were assessed as possible second implementations. The current Windows host lacks the required Visual C++ toolchain and PyPI does not provide a compatible Windows wheel; the attempted build therefore failed before solver execution. No comparison result is claimed. A byte-identical 4NEC2 comparison remains the release-blocking established-package task from `VALIDATION_PLAN.md`.

## Automated coverage

Tests cover:

- MHz/Hz, wavelength, m/mm/ft/in conversions;
- wire endpoints/radius and centre-feed placement;
- segment selection and invalid geometry;
- deterministic NEC generation for all three ground modes;
- exact-deck worker invocation;
- R/X/result validation and 50/75-ohm SWR;
- pattern cut normalization and current normalization/phase retention;
- missing/malformed solver output;
- worker failure and feature timeout;
- real nec2c/WASM UI execution, plots, current table, and console review;
- the six-case regression set and published 38 MHz reference.

## Known limitations and verification still required

- Only a single frequency and one straight, centre-fed, perfect-conductor dipole are in this slice.
- The five-degree maximum/take-off angle is a sampled grid value, not an interpolated peak.
- Azimuth is the phi cut through the sampled global maximum; elevation is the corresponding theta cut.
- Current magnitude is the absolute NEC source-current convention and normalized only for the plot; phase is displayed per segment.
- No segmentation convergence UI or user override is included yet.
- Real-ground numerical results have not yet been independently compared.
- The exact solver stdout/output is not yet persisted as a user-downloadable run artifact.
- General NEC import/export and the generic simulator still use their inherited paths; this adapter does not silently replace them.
- The target Tauri/native solver architecture remains undecided and unimplemented on this branch.

## Second critical review and disposition

After the first green implementation, the feature was reviewed from the position that its preferred exact-deck/Wasm design should be rejected. The review produced the following dispositions:

| Objection | Finding | Resolution |
| --- | --- | --- |
| “Verified” overstates a one-solver browser result. | Valid. | Claim boundary tightened; only the published free-space case has independent numeric evidence, and established-package ground comparison remains release-blocking. |
| The inherited `GE` convention may be backwards. | Confirmed defect in the first adapter draft. | Corrected to manual-defined `GE 0` for free space and `GE -1` for this elevated wire with ground; every numeric case was rerun without baseline movement. |
| Results can become stale after a user edits parameters. | Confirmed UI integrity risk. | Completed runs are keyed to the canonical SI model; a parameter change immediately hides the prior result while regenerating the pending deck. Browser regression coverage was added. |
| The shown deck could differ from the solved deck. | Valid in the inherited generic path. | The feature bypasses the generic builder after adaptation and passes the same string through `runDeck`; a worker-message test and browser assertion cover it. |
| Automatic segmentation can create false confidence. | Valid residual risk. | Counts and ratios are exposed, manual-based limits are enforced, and convergence is explicitly still required rather than claimed automatic. |
| A symmetric dipole cannot prove coordinate handedness. | Valid. | Keep the conventional theta contract here; require asymmetric Yagi/phased cases before general visualization validation. |
| Filtering stderr could hide a meaningful diagnostic. | Valid. | Solver output and stderr warning/error lines are retained in the result; a broader diagnostic corpus and raw-output download remain open work. |
| Wasm conflicts with the proposed native desktop architecture. | Valid if treated as product selection. | This remains an experimental adapter/proof of contracts. Native nec2c versus NEC2++ selection and Wasm parity gates are unchanged. |

No objection was closed merely because tests passed. The unresolved items remain in `RISK_REGISTER.md` and `VALIDATION_PLAN.md`.

## Assumptions requiring experimental verification

1. The published 38 MHz difference is predominantly segmentation/kernel discretization; run a controlled 11/21/41 segment convergence family in direct solvers.
2. `GN 2` behavior and ground constants match the intended Sommerfeld-Norton comparator settings.
3. Five-degree peak sampling is adequate for this first UI; compare with one-degree grids and interpolation.
4. NEC current values and phase reference are labelled appropriately for user interpretation.
5. Worker warning extraction catches meaningful nec2c diagnostics without treating its ordinary stderr usage banner as a warning.
6. The exact-deck adapter behaves identically in a clean offline Windows 11 package, not only the development server.
