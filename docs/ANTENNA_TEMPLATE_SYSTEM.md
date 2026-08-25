# HF Antenna Studio — Parametric Antenna Template System

Status: implemented experimental framework on `feature/antenna-template-system`  
Last reviewed: 2026-08-02

## Scope and claim boundary

This branch replaces template-specific calculation screens with one registry-driven framework and one shared workbench. Eight initial definitions generate the same solver-independent, SI-only antenna model, which is then segmented and compiled by one NEC adapter. The exact displayed deck is the deck submitted to the local solver.

The generated dimensions are starting points for exploration, not resonant-length claims. Installation details, conductor environment, feed line, ground, segment convergence, and construction tolerances can move resonance and radiation results. The numerical cases in this document are same-engine regression evidence unless explicitly labelled otherwise; they do not independently validate electromagnetic accuracy.

## Data flow

```text
template definition + band/frequency + user overrides
                 ↓
validated SI parameter record
                 ↓
solver-independent TemplateAntennaModel
                 ↓
shared odd-segment policy + NEC adapter
                 ↓
exact NEC deck → pinned nec2c/Wasm worker
                 ↓
structurally checked impedance/pattern result → common UI
```

Changing a valid parameter rebuilds geometry synchronously. A geometry error is shown to the user, disables the run action, and withholds executable NEC text; geometry is never silently clamped to make it solvable. A prior result is hidden whenever its complete model identity differs from the current model.

## Template contract

Every `AntennaTemplateDefinition` declares:

| Concern | Contract |
|---|---|
| Identity | Stable template ID, name, description, version |
| Parameters | Quantity, SI storage unit, metric/imperial display units, min/max/step/default, slider eligibility |
| Presets | Amateur-band ID, label, and starting frequency |
| Dimensions | A deterministic frequency-to-starting-parameter function |
| Geometry | One or more finite straight wires with unique IDs and diameters |
| Feed | Wire ID, fractional position, and complex source voltage |
| Loads | Zero or more typed series-RLC loads; the common adapter emits `LD` cards |
| Ground | Requirement text, default ground, and whether an endpoint legitimately touches ground |
| Segmentation | Target/max segment length in wavelengths, per-wire bounds, odd-count rule |
| Validation | Cross-parameter and geometry rules returning explicit errors or warnings |

The output `TemplateAntennaModel` contains only metres, hertz, radians, siemens/metre, farads, henries, volts, and ohms. Display conversion is outside the model. It does not contain NEC card syntax.

## Initial templates

Starting ratios are intentional heuristics and require tuning for a user's installation.

| Template | Starting geometry | Feed | Default ground / important limitation |
|---|---|---|---|
| Horizontal dipole | Straight wire, total length about 0.475λ | Centre | Average real ground; balanced feed/feed-line effects omitted |
| Inverted-V | Two equal arms, about 0.47λ total, 120° included angle | Apex junction | Average real ground; source lies on the segment adjacent to the junction |
| Sloper | Centre-fed straight wire, about 0.47λ, 30° inclination | Centre | This is not an end-fed half-sloper and does not model a tower/feed line |
| Quarter-wave vertical | 0.2375λ-class radiator plus sixteen initial horizontal 0.25λ explicit radials at visible clearance | Radiator bottom at radial junction | Average real ground; NEC-2 raised-wire approximation, not burial or exact soil contact |
| Ground-plane vertical | Vertical radiator plus four initial drooping radials | Radiator bottom | Average real ground; radial number, length, droop, and base clearance are parameterised |
| Full-wave loop | 16-chord vertical circular approximation, perimeter about 1.02λ | Bottom-centre chord | Average real ground; polygon convergence remains to be characterised |
| Delta loop | Three-wire vertical triangle, perimeter about 1.02λ | Centre of bottom wire | Average real ground; corner/feed segmentation sensitivity remains open |
| Square loop | Four-wire vertical square, perimeter about 1.02λ | Centre of bottom wire | Average real ground; corner/feed segmentation sensitivity remains open |

The 160, 80, 60, 40, 30, 20, 17, 15, 12, 10, and 6 metre presets set a representative starting frequency and regenerate dimensions only while the workbench is in **Frequency-linked start** mode. Editing any dimensional field enters **Manual dimensions** mode. Frequency and band changes then preserve those dimensions until the user explicitly restores generated starting dimensions.

## Shared segmentation and NEC mapping

- Segment recommendations target no more than 0.025λ per straight wire segment, with explicit per-wire minima/maxima and odd counts.
- Feed and load fractions map deterministically to legal NEC segment numbers.
- The adapter emits all `GW` cards, then `GE`, `GN`, optional `LD`, `PT`, `EX`, single-frequency `FR`, a 5° `RP` grid, and `EN`.
- Elevated geometries and the quarter-wave template's explicit near-surface radial geometry use `GE -1`. The latter keeps every wire surface above `z = 0`; the ideal `GE 1` ground-contact monopole remains a separate specialist-laboratory configuration rather than being silently substituted for a radial system.
- Perfect ground emits `GN 1`; real ground emits `GN 2` with the selected relative permittivity and conductivity.

This is a safe default policy, not proof of convergence. Release-level validation must repeat representative cases at finer segmentation and explain any material movement.

## Automated evidence on this branch

The feature tests cover all eight templates for registry uniqueness, declared UI bounds, finite/nonzero geometry, feed placement, topology, closed loops, segmentation limits, NEC generation, explicit near-surface radial mode, common load serialization, invalid cross-parameter geometry, display-unit invariance, and actual local solver completion. Browser coverage also checks live geometry regeneration, band/manual-mode behavior, mobile-width overflow, and all eight same-engine numeric regression cases.

Default 20 m regression values from the pinned nec2c v1.3.3 Wasm build are:

| Template | R (Ω) | X (Ω) | Peak gain (dBi) | Sampled take-off |
|---|---:|---:|---:|---:|
| Horizontal dipole | 62.87 | -40.14 | 7.35 | 30° |
| Inverted-V | 64.52 | -65.52 | 5.52 | 45° |
| Sloper | 70.23 | -61.24 | 5.46 | 35° |
| Quarter-wave vertical, 16 near-surface radials over average ground | 32.31 | -15.52 | -0.16 | 25° |
| Ground-plane vertical | 54.48 | -16.75 | 0.22 | 20° |
| Full-wave loop | 137.33 | -23.94 | 5.45 | 40° |
| Delta loop | 98.64 | -64.50 | 2.74 | 80° |
| Square loop | 116.71 | -66.58 | 4.90 | 50° |

These values lock current application/engine behaviour; they must not be cited as independent validation or tuned into the generators merely to pass tests.

## RF and adversarial review

The preferred design is one shared definition contract. The strongest arguments against it and their dispositions are:

| Challenge | Resolution or documented limitation |
|---|---|
| One generic schema may hide topology-specific RF semantics. | Definitions own geometry/feed/validation; the model remains generic. Template-specific validation tests are required before adding a definition. |
| One segmentation heuristic can be wrong at bends, junctions, loads, and feedpoints. | Treat it as a recommendation only; add convergence studies and per-template overrides when evidence requires them. |
| An endpoint/junction source is represented by a source on an adjacent NEC segment. | Show the exact wire/segment and retain this as a documented modelling approximation; validate sensitive junction cases externally. |
| A 16-sided “circular” loop may alter impedance/pattern. | Label it a polygonal approximation and run 16/32/64-chord convergence before accuracy claims. |
| A near-surface radial model could be mistaken for buried or exactly-on-soil wires. | Keep a positive clearance parameter visible, require Sommerfeld/Norton ground, emit the raised-wire warning, and preserve the ideal monopole as a separate specialist-lab mode. |
| Shared same-engine expected numbers can institutionalise a solver defect. | Keep them classified as regression only. Published NEC cases, a separately built accepted solver, and at least one established package remain mandatory external evidence. |
| Band-generated dimensions could be mistaken for resonance presets. | The UI and deck state “starting dimensions only”; manual tuning is explicit and formulas use non-textbook factors rather than promising resonance. |

## Remaining experimental verification

Before these templates are called validated or supported for release:

1. Run identical saved decks through the selected native solver build and prove adapter parity with the Wasm path.
2. Compare every topology against independently sourced NEC results and at least one established antenna package using the same deck/settings.
3. Perform segment-convergence studies, especially at loop corners, the inverted-V apex, ground-plane junctions, and the near-surface radial/feed junction.
4. Extend the new same-deck `GN 2` comparator case with independent finite-ground references, clearance and segmentation convergence, and controlled measurement.
5. Check the five-degree pattern grid and take-off extraction at one degree on multi-lobed cases.
6. Add loss-bearing template cases when loads become user-editable; the current eight definitions intentionally emit no loads.
7. Retain the passing Windows 11 installed/offline gate for the selected packaged Wasm runtime, and require equivalent evidence before any future native replacement.

## Adding a template

Add one registry definition rather than a page. Provide complete parameter metadata, deterministic starting dimensions, geometry, feed, loads, ground semantics, segmentation recommendation, and validation rules. Then add topology/feed/limits/NEC tests, an actual-solver smoke case, RF sanity review, convergence plan, user-facing limitations, and provenance for any external formula or reference data.
