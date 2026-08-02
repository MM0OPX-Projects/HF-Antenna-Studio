# Phased Vertical-Array Laboratory

Status: implemented experimental workflow on `feature/phased-arrays`
Last reviewed: 2026-08-02

## Scope and claim boundary

The `/phased-arrays` workbench models two identical vertical wires with configurable frequency, length, base height, diameter, spacing in metres or wavelengths, relative bearing, ground, and radial representation. It displays immediate orbitable geometry, debounced calculation status, azimuth/elevation/3D patterns, peak and reverse gain, front-to-back and front-to-rear ratios, beam heading, take-off angle, per-element current magnitude/phase, a phasor diagram, the exact final NEC deck, and up to four immutable comparison traces.

This is an experimental browser/Wasm slice, not a claim that a physical two-element installation will reproduce the screen. It intentionally implements two non-equivalent modes.

### Mode 1: ideal current/phase

The user prescribes relative complex feed currents. NEC `EX 0` is a voltage source, not a conductor-current constraint. The application therefore does not put the requested current numbers into voltage fields. For fixed geometry, ground, segmentation, and frequency it runs two small calibration decks:

1. one volt on element 1, with element 2 passive;
2. one volt on element 2, with element 1 passive.

The parsed complex feed currents form the coupled two-port admittance matrix:

```text
[I1]   [Y11 Y12] [V1]
[I2] = [Y21 Y22] [V2]
```

The adapter solves `V = inverse(Y) I_target`, generates a final two-source NEC deck, and accepts the pattern only when the final parsed feed currents match both normalized complex targets within 3%. The current calibration is cached by the complete geometry/ground/frequency identity, so a later phase or amplitude change normally needs only the final solve. A singular calibration matrix or failed final verification blocks the result.

The resulting `EX` voltages are numerical enforcement values. They are shown for audit but are not described as a realizable feed network. There is deliberately no single feed impedance for this mode.

This interpretation follows NEC-2's [EX card definition](https://www.nec2.org/part_3/cards/ex.html), which identifies type 0 as an applied-field voltage source and permits multiple voltage sources. Type 4 is an elementary current element that illuminates a structure and is prohibited over ground; it is not a way to prescribe a conductor feed current.

### Mode 2: physical feed network

One one-segment source-junction conductor is driven by a one-volt `EX 0` source. Two NEC `TL` cards connect it to the element feed segments. The available starting network controls are:

- common coax characteristic impedance;
- common velocity factor;
- line 1 and line 2 length entered as physical metres, electrical degrees, or delay in nanoseconds;
- parallel hub-to-elements topology;
- tapped cascade topology (`hub -> element 1 -> element 2`);
- optional source, element-1, and element-2 shunt resistive terminations.

The application reports the source-junction impedance and the element feed currents that NEC solves. It never displays the mode-1 amplitude and phase settings as physical-mode achievements. The tapped cascade is not called an identical-current series feed.

NEC's [TL card](https://www.nec2.org/part_3/cards/tl.html) represents characteristic impedance, line length, and shunt admittances between structure segments. These are ideal lossless, non-radiating lines. The present model does not include coax conductor/shield geometry, common-mode shield current, attenuation, connector or junction parasitics, transformers, or velocity-factor dispersion. A requested zero-delay line is emitted as `1e-8 wavelength` because zero/blank line length is reserved by NEC implementations for geometric auto-length; the substitution is visible as a warning.

## Coordinates, geometry, ground, and radials

The model is SI-only. User bearing is a compass bearing: `0 degrees` is north (`+Y` in NEC coordinates), `90 degrees` is east (`+X`), and element 2 is placed ahead of element 1 on that bearing. NEC phi is converted to compass bearing as `(90 - phi) modulo 360`.

The workbench keeps these representations distinct:

- a ground-contact pair with no radial `GW` wires and infinite perfect `GN 1` image ground;
- elevated explicit radial wires above perfect ground;
- elevated explicit radial wires above `GN 2` Sommerfeld/Norton real ground.

The [NEC-2 GN definition](https://www.nec2.org/part_3/cards/gn.html) identifies `GN 1` as perfect ground and `GN 2` as the Sommerfeld/Norton method. Explicit radial wires are ordinary current-carrying geometry; they are not NEC's reflection-coefficient ground-screen approximation. Every explicit radial must remain strictly above `z = 0` in this workflow. Overlapping radial fields produce an inspection warning because the generator does not automatically split wire crossings into junctions.

Elements use at least 11 odd segments and explicit radials at least 5 odd segments, targeting at most `0.02 wavelength` per segment with a 199-segment per-wire cap and 3,000-segment workbench cap. Segment length/diameter diagnostics, electrically thick wires, extremely close element spacing, ground penetration, non-finite geometry, invalid line values, and invalid ground/radial combinations are checked before execution. These checks are conservative application diagnostics, not a complete NEC validity proof.

The full pattern grid is 2-degree samples: theta `0..88 degrees` and phi `0..358 degrees`. The exact grazing ray at theta 90 is excluded because a first RF review found unstable direction selection at the ground boundary. Consequently the lowest reported take-off angle is 2 degrees. This grid is suitable for interactive comparison, not precision null-depth or fine beam-heading claims.

## Directional metrics

- Forward gain is the global valid sample after centring any equal-gain azimuth plateau caused by NEC's 0.01 dB output precision.
- Beam heading is the compass centre of that plateau. If the exactly opposite axial response is within 0.1 dB, it is labelled a bidirectional axis rather than a unique forward direction.
- Reverse gain is sampled 180 degrees from that heading at the same theta.
- Front-to-back is forward minus exact axial reverse.
- Maximum rear gain is the strongest sample anywhere more than 90 degrees from the selected heading.
- Front-to-rear is forward minus maximum rear gain.
- Take-off angle is `90 degrees - NEC theta` at the forward peak.

The plateau-centre rule was added after real-solver review. A quarter-wave end-fire case had fourteen adjacent samples that all rounded to 8.18 dBi; reporting the first sample made a symmetric 270-degree beam appear as 286 degrees. Unit and browser tests now require 90/270-degree reversal and a stable 0/180-degree broadside axis.

## Interaction and stale-result safety

Geometry is regenerated synchronously for every slider event. Solver work waits for 450 ms of stable input. A new model aborts/supersedes the active worker, increments request identity, and immediately withholds every result-dependent number and plot. A result can render only when its complete serialized SI model key equals the current model key. A 48-result in-memory cache retains exact models; a separate 32-entry cache retains ideal-mode admittance calibrations.

The automatic phase sweep advances element-2 phase from 0 through 360 degrees only after the preceding exact model has completed or been restored from cache. Saved overlays retain both the model and result, including which modelling mode produced them.

## Validation evidence

All three fixtures use 14.1 MHz, 5.0496957 m vertical elements (the `0.2375 wavelength` starting value), 2 mm diameter, `0.25 wavelength` spacing, ground-contact perfect ground, 13 segments per element, equal unit target-current magnitude, and the 2-degree non-grazing pattern grid.

The application-generated final decks in `validation/phased-arrays/` were run byte-for-byte through the pinned browser nec2c/Wasm build and a separately installed 4NEC2 merged NEC-2D build 2.7 (30-Jan-2008). `scripts/compare-phased-arrays-4nec2.ps1` checks the reviewed theoretical axes rather than selecting arbitrarily among gain values tied at 0.01 dB. The external executable SHA-256 is `2FB857EF4EDD15C5A46FB2FE694502E965652E71F69855151B05210DDD410ACE`.

| Case | E2 target phase | Heading/axis | Forward dBi | Reverse dBi | F/B dB | Take-off |
|---|---:|---:|---:|---:|---:|---:|
| Broadside | 0 degrees | 0/180 degrees | 6.20 | 6.20 | 0.00 | 2 degrees |
| End-fire +bearing | -90 degrees | 90 degrees | 8.18 | -26.72 | 34.90 | 2 degrees |
| End-fire reversed | +90 degrees | 270 degrees | 8.18 | -26.72 | 34.90 | 2 degrees |

Deck hashes:

- broadside: `316310BC04F1C2A354326C9184C8F8BA53749A2E0AF9AF3E7201DAA4BDEDF99D`
- end-fire +bearing: `8E71C25BFDF8F4AF8BB939BE48009E9938018248D9AC442FCC710AAD8595581B`
- end-fire reversed: `8E7A1B67070F88D2F77ED6B42014FF525A3F055D14AF544F6EE2A3CF8727947E`

The two end-fire cases have equal gain, equal axial suppression, and headings separated by exactly 180 degrees at the grid resolution. The broadside case is symmetric with equal opposite peaks. These are the requested broadside, end-fire, reversal, and symmetry sanity checks. The exact final currents are also checked in the browser as `1∠0 degrees` and `1∠target phase` ampere after normalization.

This is independent package/executable, same-deck NEC-2 evidence. It catches compiler, solver-build, parser, coordinate, and metric defects. It is not independent physical truth: both engines implement NEC-2, the decks originated in this project, and perfect ground plus ideal enforced currents are abstractions. Physical-mode TL cases, real ground, explicit radials, spacing/segment/grid convergence, another solver family, a package-authored phased-array model, and controlled measurement remain open release gates.

## Adversarial RF and architecture review

| Argument against the implementation | Resolution or retained limitation |
|---|---|
| Multiple `EX` cards prescribe voltages, so the UI cannot honestly promise current phasing. | Accepted. Mode 1 measures the coupled admittance matrix, solves the required voltages, and rejects a final solve whose parsed feed currents miss the complex targets by more than 3%. |
| A user may copy calibrated voltages into a coax network and expect the same pattern. | The voltages are labelled enforcement values, not a network design. The two modes have separate controls, results, help text, diagrams, and deck topology. |
| NEC `TL` cards are not physical coax. | Accepted as a material limitation. Loss, shield radiation/common mode, connectors, transformers, and parasitics are explicitly absent. No stronger physical-feed validation claim is made. |
| A tapped TL cascade is not a true series-current feed. | The UI and warning call it a tapped cascade and state that identical element current is not enforced. |
| The short source-junction wire can radiate and its size is arbitrary. | It is rendered and included in the exact deck. Junction-size and segment convergence remain required before physical-mode validation. |
| Coarse rounded pattern data can give unstable headings and exaggerated null depth. | Theta 90 is excluded, tied plateaus are centred, ambiguity is labelled, and the 2-degree/0.01 dB limit is documented. Finer-grid convergence remains open. |
| Explicit radial wires from the two elements can cross without a NEC junction. | Radial-field overlap is warned and the 3D geometry must be inspected. Automatic crossing topology is not claimed. |
| Calibration caching can apply old coupling data to new geometry. | The key contains frequency, all conductor geometry, bearing, ground, and radial values; it excludes only requested ideal excitation and unrelated physical-network inputs. Final current verification provides a second guard. |
| 4NEC2 is not an independent physical oracle. | Accepted. Results are described only as cross-build same-deck evidence. A package-authored/reference case, convergence, another implementation, and measurement remain open. |

## Reproduction

Run the normal frontend unit, type, lint, build, and Playwright gates documented in `BASELINE.md`. With the separately installed comparator at the recorded path, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\compare-phased-arrays-4nec2.ps1
```

Review the engine name, executable hash, deck hashes, and all three pass flags. A different executable or changed deck is a new validation environment and must not silently inherit these results.
