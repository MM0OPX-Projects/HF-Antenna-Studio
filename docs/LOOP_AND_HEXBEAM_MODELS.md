# Loop, Cubical-Quad, and Hexbeam Models

Status: implemented experimental workflow; G3TXQ geometry correction revalidated locally
Last reviewed: 2026-08-29

## Implemented scope

The `/loop-and-hexbeam-models` workbench provides five independently generated model families:

- a vertical square loop with a frequency-derived `1.02 wavelength` starting perimeter;
- a vertical delta loop with independent base, height, apex offset, and bottom-centre, lower-left-corner-region, or left-side-region feed;
- a vertical diamond loop with independent horizontal and vertical diagonals;
- a two-, three-, or four-element cubical quad with independent reflector/driven/director perimeters and spacings; and
- a single-band G3TXQ broadband Hexbeam wire path for the 20, 17, 15, 12, and 10 metre construction bands.

All dimensions are SI values in a NEC-independent discriminated model. Controls update actual wire geometry immediately. A dedicated adapter generates the exact NEC deck, submits that same deck to the local Wasm worker after a 450 ms debounce, and withholds the prior result as soon as the model changes. The workbench displays R, X, complex impedance, 50/75-ohm SWR, peak gain, take-off angle, azimuth/elevation cuts, an orbitable 3D pattern, wire-current magnitude/phase, and the generated deck. Quad and hexbeam models additionally report explicit `+Y` forward/rear metrics and azimuth beamwidth.

No optimizer, matching network, multiband interaction model, frequency sweep, or physical construction guarantee is implemented by this feature.

## Geometry and feed contracts

Every coloured 3D path corresponds to a generated `GW` conductor. The six dashed gray radial spreaders and six perimeter cords are construction context only and never become NEC wires.

Closed loops are assembled from endpoint-identical straight sections. The generator verifies that closed-loop endpoints have degree two. The hexbeam deliberately has four degree-one endpoints: two open driven-element tips and two open reflector tips. It rejects any other open-end count.

The source is not placed approximately on the nearest arbitrary segment. A feed-bearing edge is split into a short collinear bridge, with length selected as at least `0.002 wavelength` or six wire diameters while remaining bounded by the parent edge. That bridge has exactly one NEC segment and carries the sole `EX` source. The adjacent wire sections terminate at its exact endpoints. This makes bottom-centre and side-region source placement inspectable and deterministic.

The UI reports **feed-conductor orientation** from the source bridge vector: horizontal, vertical, or sloping. It does not convert that local fact into a named polarisation. Radiated polarisation depends on the complete current distribution, observation direction, and ground; the current output parser does not yet retain NEC's polarisation components. The template name therefore never supplies a polarisation claim.

For quad and hexbeam models, intended forward is fixed at domain `+Y`, corresponding to NEC `phi = 90 degrees`. The metrics use the same definitions as the Yagi workbench: axial front-to-back and maximum-rear-hemisphere front-to-rear are separate values. Single-loop models use the unconstrained global maximum and make no front/rear claim.

## Hexbeam scope and provenance

The Hexbeam generator now represents Steve Hunt G3TXQ's broadband topology directly in plan view: two half-wires form the centre-fed classic M-shaped driver, each open driver tip is separated from its corresponding reflector tip, and the reflector then follows five consecutive sides of a regular hexagonal perimeter. Ten conductive sections are emitted: one short feed bridge, four driven sections, and five reflector sections. The support frame is visual only.

The starting half-driver, total-reflector, and tip-separation dimensions are the bare-wire values published in Steve Hunt G3TXQ's [broadband Hexbeam notes](https://karinya.net/g3txq/hexbeam/broadband/) and independently restated in K4KIO's [construction specifications](https://www.hex-beam.com/specs/). The engine derives the regular frame radius from those three electrical dimensions and the explicit source bridge. Consequently each driven half-wire length measured from the feed centre, the total five-side reflector length, and both tip gaps remain exact rather than moving a rear bend off the support perimeter. The 20 m starting model derives a `3.248 m` (`127.9 in`) idealised wire-frame radius; G3TXQ describes the practical antenna's turning radius as approximately `130 in`/`10.7 ft`, so this small construction/model distinction remains explicit.

This is a faithful implementation of the published **single-band two-dimensional wire topology**, not a reproduction or endorsement of a complete physical product. A practical antenna uses bowed flexible spreaders, construction-specific ties and insulation, conductor sag, a mast/feed system, and commonly several vertically stacked band wire sets. Those omitted details can change impedance and pattern. The source attribution validates the geometry choice and starting dimensions only; it does not validate construction performance.

## NEC adapter and validity policy

The adapter emits:

- eight-significant-digit `GW` cards constrained to the classic 80-column limit;
- `GE 1` for the strictly elevated geometry;
- either infinite perfect ground (`GN 1`) or Sommerfeld/Norton finite ground (`GN 2`);
- current output, one unit-voltage `EX`, one `FR`, and a `2 degree` upper-hemisphere `RP` grid with 8,280 samples; and
- no cards for the visual support frame.

Non-source sections target at most `0.02 wavelength` per segment, cap each wire at 199 segments, and require at least two segment lengths per diameter; ratios below four generate a warning. The exact source bridge remains one segment and must meet the same aspect test. The interactive model is blocked above 1,800 total segments.

Validation also checks frequency and ground ranges, finite/positive geometry, unique wire identity, clearance above ground, electrical thickness, closed-loop connectivity, quad director-array cardinality, complete quad ground clearance, exact hex driven/reflector fit, and the expected hex open tips. Inputs are reported rather than silently tuned to pass.

## Independent numerical reference set

Five application-generated, perfect-ground, 14.175 MHz decks are committed in `validation/loop-beams/`. They were executed byte-for-byte by both the pinned browser nec2c/Wasm engine and the separately installed 4NEC2 merged NEC-2D build 2.7 (30-Jan-2008). `scripts/compare-loop-beams-4nec2.ps1` invokes the external engine directly and gates resistance/reactance to 0.02 ohm, peak gain to 0.02 dB, and peak theta to 0.01 degree. The comparator executable SHA-256 is `2FB857EF4EDD15C5A46FB2FE694502E965652E71F69855151B05210DDD410ACE`.

| Perfect-ground reference deck | R (ohm) | X (ohm) | Peak dBi | NEC theta | UI take-off |
| --- | ---: | ---: | ---: | ---: | ---: |
| Square loop | 106.289 | -72.5090 | 8.46 | 54 degrees | 36 degrees |
| Delta loop, bottom feed | 103.861 | -77.3984 | 7.94 | 48 degrees | 42 degrees |
| Diamond loop, sloping feed | 88.9143 | -80.3723 | 7.95 | 90 degrees | 0 degrees |
| Two-element cubical quad | 84.0498 | +10.1830 | 14.36 | 72 degrees | 18 degrees |
| 20 m G3TXQ broadband Hexbeam path | 31.8707 | +3.0954 | 11.96 | 62 degrees | 28 degrees |

All five gates pass. These comparisons catch deck, parser, coordinate, and cross-build discrepancies. They are not five independent physical experiments: both engines implement NEC-2, the decks were authored by this project, and perfect ground is an idealisation.

The browser validation additionally solves every delta feed position, a four-element quad, and the 10 m hex preset; verifies all five hex preset geometries; checks current and 3D outputs; and exercises rapid superseding edits, keyboard input, a 390-pixel viewport, real-ground card controls, and browser-console errors. Unit tests cover every family, all hex bands, wire lengths, feed identity, connectivity, segmentation, line width, ground cards, result mapping, missing outputs, solver failures, and cancellation.

## Review-loop findings

- **Geometry review:** replaced both the inherited generic two-W-wire template and the first laboratory approximation with one shared G3TXQ generator. Tests prove the M-driver sequence, five-side reflector sequence, bilateral symmetry, exact half-driver/reflector lengths, exact open tip gaps, and non-conductive six-spreader/perimeter frame.
- **Connectivity review:** closed loops require exact endpoint closure; quad loops remain independent parasitic conductors; hex driver and reflector each have the expected open ends.
- **Feed review:** introduced the one-segment source bridge so no feed location relies on nearest-segment rounding. Delta orientation changes are derived from the bridge.
- **Segmentation review:** retained geometry corners and source identity while enforcing wavelength, aspect-ratio, total-count, and 80-column portability limits.
- **Pattern review:** fixed directional models to `+Y`, kept single loops non-directional, and compared exact peak samples through another NEC-2 build.
- **Regression review:** the existing unit suite, real-solver browser suite, type check, lint, and production build are release gates; no calculation constant is adjusted by a test at runtime.

## Known limitations and next evidence

- Straight bare perfect conductors omit insulation, resistive loss, wire sag, corner radius, fittings, support dielectric, feed gap hardware, balun/choke, feed line/common mode, mast, nearby objects, and terrain.
- The cubical quad uses square loop elements. Round/tapered conductors, boom/support effects, matching systems, and non-square quad variants are absent.
- The Hexbeam is a flat single-band G3TXQ topology. It does not model stacked-band coupling, spreader bow/deflection, insulation, tie points, or a complete published construction. Its numerical results still require source/corner/segment convergence plus an independently authored reference model or controlled measurement before any performance claim.
- The feed bridge is a controlled NEC delta-gap abstraction. Source-bridge length and corner/segment convergence studies remain required.
- Perfect-ground cross-engine agreement does not validate Sommerfeld/Norton results. Finite-ground exact-deck comparisons remain open.
- The 2-degree grid quantises peak direction. Pattern-grid and interpolation convergence remain open.
- Same-method NEC-2 agreement cannot expose a shared formulation limitation. Package-authored models, published outputs, or controlled measurements are still required per antenna family.
- “Full-wave” describes a frequency-scaled starting perimeter, not resonance. Manual geometry remains authoritative and no model is automatically tuned.
- No result should be used as a construction guarantee until conductor, feed, ground, segmentation, and environmental assumptions have been reviewed for that installation.

## Reproduction

Run the automated frontend gates with the pinned toolchain described in `BASELINE.md`. With the separately installed external comparator at its documented default path, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\compare-loop-beams-4nec2.ps1
```

A missing or changed executable is a different comparison environment. Do not weaken the recorded hash or tolerance silently.
