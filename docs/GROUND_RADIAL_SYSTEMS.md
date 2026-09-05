# Ground-radial systems

Status: implemented on local branch `feature/ground-radial-systems`
Last reviewed: 2026-08-25

## Supported electromagnetic representations

HF Antenna Studio keeps four models deliberately separate:

| Representation | NEC geometry/ground | Supported use | Must not be inferred |
|---|---|---|---|
| Perfect-ground image | Ground-contact vertical, `GE 1`, `GN 1`, no radial `GW` wires | Ideal single or phased monopoles | Soil loss, a finite radial field, or radial currents |
| Elevated explicit radials | Radial `GW` wires strictly above ground, `GE -1`, `GN 1` or `GN 2` | Elevated ground planes and independent phased-element radial sets | Buried/on-soil conductors |
| Near-surface explicit radials | Horizontal radial `GW` wires at a visible positive clearance, `GE -1`, `GN 2` | A NEC-2 raised-wire approximation to ground-laid radial systems | Exact surface contact, burial, ground stakes, or soil-wire interface currents |
| NEC radial-screen approximation | No radial `GW` geometry; `GN 0` radial fields and `RP 4` | Fast single-vertical reflection-coefficient approximation | Explicit radial currents, Sommerfeld/Norton equivalence, or edge diffraction |

The near-surface representation follows the NEC-2 User's Guide boundary: a wire screen over finite ground may be represented only when raised slightly above the interface. NEC-2 has no buried-wire interaction solution. The model therefore exposes wire-axis clearance and always warns that clearance/segmentation sensitivity is required. See the [NEC-2 User's Guide](https://www.nec2.org/other/nec2prt3.pdf), sections on finite ground and radial-wire screens.

## Single verticals

The Vertical Antennas laboratory offers all four representations. Its ground-mounted explicit-radial start uses:

- 14.1 MHz;
- a 0.2375 wavelength radiator;
- sixteen 0.25 wavelength horizontal radial wires;
- 1 mm wire diameter;
- 10 mm wire-axis clearance;
- Sommerfeld/Norton ground, relative permittivity 13 and conductivity 0.005 S/m; and
- odd segmentation no longer than 0.02 wavelength.

The quarter-wave vertical in the reusable template studio uses the same representation and ground defaults. Its normal parameter quantisation produces 5.060 m radiator and 5.300 m radials at 14.1 MHz; those exact dimensions have their own comparator fixture.

The primary Simulator's older **Ground Plane Vertical** remains an elevated-radial model. When it is selected, the template picker now says so explicitly and links directly to the specialist Vertical and Phased Arrays laboratories. It does not silently reinterpret that existing model as ground mounted.

## Phased verticals

Near-surface phased arrays support two explicit topologies:

- **Independent per element:** each vertical has its own radial field. Validation blocks fields whose radial extents overlap because crossings would otherwise be electrically ambiguous.
- **Shared bonded network:** both element bases connect through two explicit bond conductors to a centre hub; the requested radial count is the total number of spokes from that hub. Every connection is present in NEC geometry and current output.

Elevated radials currently remain independent per element. A shared elevated screen is not generated. The shared near-surface topology is a particular bonded network, not a universal representation of every broadcast or amateur radial layout.

## Validity gates

Calculation is blocked when:

- a near-surface wire surface touches/crosses `z = 0`;
- near-surface radials have droop;
- near-surface radials are combined with perfect ground;
- independent phased radial fields overlap;
- an elevated shared topology is requested;
- radial count, dimensions, soil values, segment aspect ratio, or total segment budget are invalid; or
- explicit geometry otherwise penetrates ground.

Warnings identify the NEC-2 raised-wire approximation, wire-axis clearance below two diameters, a plane above 0.005 wavelength, large feed junctions, electrically thick wires, and elevated-field overlap.

## Independent numerical evidence

`scripts/compare-ground-radials-4nec2.ps1` runs three immutable application decks through the separately installed 4NEC2 merged NEC-2D 2.7 engine (`nec2dxs11k.exe`, SHA-256 `2FB857EF4EDD15C5A46FB2FE694502E965652E71F69855151B05210DDD410ACE`).

| Exact deck | Deck SHA-256 | Comparator result |
|---|---|---|
| Specialist single vertical | `473847CBE76DE50FEEA7A4A5BFF1FACA968D358C53E50D9B5B87DF938230D941` | 32.3154 − j15.3840 Ω; −0.16 dBi; 25° take-off; 0.00 dB azimuth spread |
| Template single vertical | `D13C1A9FBC7C2452BA196D1D2F28FBF8BCAFF0D4AC25DA8D49F74FE376C3A882` | 32.3095 − j15.5247 Ω; −0.16 dBi; 25° take-off; 0.00 dB azimuth spread |
| Shared phased radial network, equal one-volt sources | `9FC10FF9337D3A003A1C7F730B86DFFE3BC6C0D76AAD1B16564926105EC1467E` | Port impedances 121.795 + j566.626 Ω and 121.807 + j566.639 Ω; −2.80 dBi at both broadside axes |

The single-vertical browser tests reproduce the comparator R/X, gain, take-off, current, and pattern results through the bundled nec2c/Wasm engine. The phased browser test separately verifies the application's calibrated equal-current mode, final feed-current equality, bidirectional symmetry, explicit current results, and stale-result safety. The external phased fixture is a fixed equal-voltage deck; it validates the shared geometry and NEC path, not the complete application calibration algorithm against an external two-port recalculation.

All radial-count controls accept up to 128 wires (subject to each topology's minimum). Counts above 64 can create a large shared junction and segment workload; the application keeps these values available but raises a convergence/workload warning where appropriate. This is a modelling limit, not a claim that every 128-radial model is numerically converged.

For elevated radials with droop, the editor rejects any geometry whose lowest wire surface would touch or cross the ground plane. The rejection is shown in the editor status message and leaves the prior model unchanged; raise the hub, shorten the radials, or reduce droop to proceed.

## Remaining limitations

- Buried wires, exact soil contact, ground rods/stakes, soil stratification, corrosion, and conductor/soil contact impedance are not modelled.
- Clearance, radial count/length, and segmentation convergence still require a systematic multi-band campaign before broad accuracy claims.
- The post-v1 Windows package smoke now requires the explicit single and shared phased radial decks to execute offline in the installed application. Its browser-equivalent offline test passes locally, but the native installed-app rerun remains pending on a Windows build host with Rust/NSIS. When it passes, that is packaging/integration evidence, not an additional physical-accuracy oracle.
- Cross-connected meshes other than the implemented centre-bond topology require the arbitrary wire editor and explicit junction review.
- Real installations also depend on feed-line common mode, bonding, nearby conductors, terrain, and measured soil properties.
