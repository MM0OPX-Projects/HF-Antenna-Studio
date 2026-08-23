# HF Antenna Studio — Vertical Antenna Laboratory

Status: implemented experimental workflow on `feature/vertical-antennas`
Last reviewed: 2026-08-02

## Scope and claim boundary

The `/vertical-antennas` workbench models three deliberately different NEC-2 configurations:

1. an ideal ground-mounted quarter-wave-class monopole touching an infinite perfect ground plane;
2. an elevated quarter-wave-class radiator with an explicit set of straight radial wires over perfect or Sommerfeld/Norton finite ground; and
3. NEC-2's simplified radial-wire ground-screen approximation with finite-ground reflection coefficients.

They are not physically or numerically interchangeable. The UI, generated NEC comments, model summary, warnings, and validation rules state which representation is active. Frequency-generated dimensions are starting values, not resonance claims.

## Model contract

The SI-only `VerticalAntennaModel` stores:

- configuration and ground method;
- frequency in hertz;
- radiator length/diameter and feed height in metres;
- radial representation, count, length, diameter, and droop in radians;
- real-ground conductivity in siemens/metre and relative permittivity;
- 50 or 75 ohm SWR reference; and
- whether dimensions remain frequency-linked or have been manually overridden.

The model produces straight-wire geometry and explicit issues before NEC syntax is generated. Geometry changes are immediate. Changing any model input aborts an active run and removes its result; a result is displayable only when its immutable model key still matches the current controls.

## Ground and radial representations

| UI mode | Geometry/cards | What it means | Important limitation |
|---|---|---|---|
| Ideal ground-mounted monopole | One wire starts at `z = 0`; `GE 1`, `GN 1`, `RP 0` | Infinite, perfectly conducting plane with the ground-contact current expansion | No soil loss or explicit radial/feed-line system; not a physical radial field |
| Elevated explicit radials, perfect ground | Radiator plus N radial `GW` wires; `GE -1`, `GN 1`, `RP 0` | All radial currents are solved; an infinite perfect plane remains below them | Still an ideal lossless earth plane |
| Elevated explicit radials, real ground | Same explicit wires; `GE -1`, `GN 2`, `RP 0` | NEC-2 Sommerfeld/Norton finite-ground interaction using entered conductivity/permittivity | No wire may touch or penetrate ground; no buried radials in this NEC-2 workflow |
| NEC radial-screen approximation | Only the radiator is `GW` geometry; `GE 1`, `GN 0` with radial count/radius/wire radius, and `RP 4` | NEC reflection-coefficient ground plus its radial-density screen approximation | Screen wires have no segment currents; current at screen centre follows the perfect-ground solution; edge diffraction is omitted |

The official NEC-2 `GN` documentation defines `GN 0` as finite-ground reflection-coefficient approximation, `GN 1` as perfect ground, and `GN 2` as Sommerfeld/Norton. It also documents the radial-screen fields. The `RP` documentation requires mode 4 to include that screen in far-field calculation. See the [NEC-2 GN card](https://nec2.org/part_3/cards/gn.html), [RP card](https://www.nec2.org/part_3/cards/rp.html), and [GE card](https://www.nec2.org/part_3/cards/ge.html).

## Controls and outputs

Controls cover 1.8–54 MHz, radiator dimensions, elevated-feed height, radial count/length/diameter/droop, perfect versus real ground, conductivity, permittivity, display units, SWR reference, and amateur-band starts from 160 through 6 metres. Exact numeric fields accompany keyboard-operable sliders.

The workbench displays:

- interactive 3D radiator/radial geometry;
- exact generated NEC text and segment/feed identity;
- feed resistance, reactance, complex impedance, and SWR;
- peak gain, sampled take-off angle, and azimuth variation;
- absolute-dBi or normalised elevation and azimuth polar cuts;
- an orbitable 3D radiation surface; and
- radiator plus first-radial current magnitude plots and per-wire peak magnitude/phase tables.

The azimuth cut is sampled at the theta row containing the global pattern maximum. The elevation cut is sampled at the phi column containing that maximum. Take-off resolution is therefore limited to the current 5° NEC grid.

## NEC validity checks

Execution is blocked for non-finite/out-of-range dimensions, incompatible ground/configuration combinations, too few radials, explicit radial ground penetration, segment aspect ratio below two diameters, more than 3,500 interactive segments, or a wire that remains above 0.05λ per segment at the safety cap.

Warnings identify:

- Sommerfeld/Norton wire clearance below 0.001λ;
- more than 16 explicit wires at the feed junction;
- segment length below four wire diameters;
- electrically thick wires; and
- every use of the simplified radial-screen approximation.

Automatic segmentation uses odd counts, targets at most 0.02λ on each straight wire, uses at least nine radiator and five radial segments, and caps a wire at 199. This is a conservative interactive policy, not a substitute for convergence testing. The NEC-2 modelling guide discusses thin-wire, bend/junction, and ground-screen constraints and explicitly notes that screen edge diffraction is omitted: [NEC-2 structure modelling guidelines](https://www.nec2.org/part_3/secii.html).

## Established NEC example

The official NEC-2 User's Guide Example 10 models a 10 MHz, 7.5 m monopole on six 30 m radial wires at 0.01 m over ground with relative permittivity 4 and conductivity 0.001 S/m. Its original deck uses rotational symmetry and a staged numerical Green's-function file (`GR`, `WG`, `GF`). The source fixture is preserved at `validation/vertical/nec2-user-guide-example-10.nec`, based on the [NEC-2 User's Guide](https://www.nec2.org/other/nec2prt3.pdf) and its [sample-file transcription](https://antenna2.github.io/cebik/content/amod/amod86.html).

HF Antenna Studio's automated case expands the six radials into explicit wires and applies its own odd 0.02λ segmentation. It successfully completes the local Sommerfeld/Norton calculation and returns finite impedance, pattern, and current tables. Because the Green's-function staging and segmentation differ, this is a topology/ground/solver-success check—not a byte-identical numeric reproduction of the unavailable Example 10 output.

## Independent 4NEC2 comparison

Three exact application decks were run through the separate `nec2dxs11k.exe` installed with 4NEC2:

- reported engine: merged NEC-2D build 2.7, 30-Jan-2008, MinGW/G77;
- executable SHA-256: `2FB857EF4EDD15C5A46FB2FE694502E965652E71F69855151B05210DDD410ACE`;
- application engine: pinned KJ7LNW nec2c v1.3.3 Wasm build; and
- comparator command: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/compare-vertical-4nec2.ps1`.

| Case | Deck SHA-256 | App R + jX (Ω) | 4NEC2 NEC-2D R + jX (Ω) | App / comparator peak | Peak theta |
|---|---|---:|---:|---:|---:|
| 40 m, 7.1 MHz | `7990044CE3972FD3CDCD3F79BCC76170A0BB5B1CC1BCE799255696180C9CE158` | 33.82 − j19.01 | 33.8233 − j19.0060 | 5.13 / 5.13 dBi | 90° |
| 20 m, 14.1 MHz | `D9BDDC57C2A5F1181E26AED0FED3C5041C4089668419A819581EF934343300AA` | 34.03 − j15.58 | 34.0296 − j15.5759 | 5.13 / 5.13 dBi | 90° |
| 10 m, 28.5 MHz | `566B3FDD42CB56A0DEBE8AA3F63EEB5256958DD40FEC06E6A2244C6A9B511208` | 34.30 − j12.00 | 34.2984 − j11.9986 | 5.13 / 5.13 dBi | 90° |

All pass the scripted tolerances of 0.02 Ω per R/X component, 0.01 dB gain, and 0.01° theta. This is independent implementation/package comparison evidence for these three ideal perfect-ground decks. It does not validate the real-ground or radial approximations.

## Independent numerical sanity

The 5.13 dBi peak and zero azimuth variation for the ideal monopoles agree with the image-theory expectation of approximately 5.15 dBi and rotational symmetry for a thin quarter-wave monopole over a perfect infinite plane. The 0.2375λ starting radiator remains capacitively reactive in all three cases; this is expected and reinforces that the generated dimension is not claimed resonant. Because physical wire diameter is held at 2 mm while wavelength changes, the small R/X movement across bands is also expected rather than a scale-invariance failure.

Browser solver tests additionally cover 3, 4, and 8 explicit radials; changed radial length/droop/base height; real-ground controls; the simplified screen; radial current presence/absence; 50/75 ohm SWR; invalid ground penetration; metric/imperial invariance; and narrow viewport layout.

The visible-browser review and automated representative-run check found no browser-console errors or uncaught page errors. The existing React Three Fiber/Three.js dependency combination still emits the baseline-documented `THREE.Clock` deprecation warning; it originates outside this feature and does not prevent the 3D views from rendering.

## RF and failure review findings

Two calculation/presentation defects were found and corrected during the review loops:

1. The first simplified-screen adapter combined `GN 2` Sommerfeld/Norton with radial-screen fields. Both nec2c and 4NEC2 NEC-2D reject this combination. The mode now emits `GN 0` and is explicitly labelled reflection-coefficient approximation, while `GN 2` is reserved for elevated explicit wires.
2. The first current mapper treated NEC's absolute segment number as a wire-local segment number. Radial traces collapsed at one x-coordinate. Mapping now uses each tag's absolute segment span, with unit and real-browser regression coverage.

The review also rejects these tempting but incorrect claims:

- more radials do not automatically make an elevated model equivalent to an infinite perfect plane;
- a `GN 0` screen approximation is not Sommerfeld/Norton and does not expose radial currents;
- an elevated wire grid above real ground is not a model of buried/on-soil radials;
- simulated feed impedance does not include an unmodelled feed line, common-mode current, ground rod, matching network, conductor loss, or local objects; and
- 5° sampled take-off angle and a visually smooth 3D surface are not finer-resolution numerical evidence.

## Remaining validation work

Before broad release support claims:

1. Compare elevated explicit-radial and simplified-screen decks against an established package using matching ground kernels/settings.
2. Run 0.01λ/0.02λ/0.04λ segment convergence across 2, 4, 8, 16, 32, and 64 radials.
3. Perform feed-junction segmentation sensitivity, especially above 16 radials.
4. Run height/clearance sensitivity for Sommerfeld/Norton cases near 0.001λ.
5. Compare radial length and soil sweeps against published numeric tables where redistribution/provenance permits.
6. Retain the Windows installed/offline and exact-deck gates for the selected packaged Wasm solver, and require the same corpus before any future native solver replacement.
7. Add measured-antenna comparisons only with documented feed-line isolation, soil measurement, construction tolerances, and calibration uncertainty.
