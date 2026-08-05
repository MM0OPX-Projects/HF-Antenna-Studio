# NEC current visualisation

Status: implemented experimental browser/Wasm feature on `feature/current-visualisation`
Scope: parsed segment currents for the Simulator, Wire Editor, verified dipole, vertical, loop/compact-beam, Yagi, and phased-array result views

## Evidence boundary

The visualisation consumes the complex segment-current records parsed from the local NEC solver output. It does not generate a sinusoidal textbook envelope, interpolate missing samples, or substitute requested phased-array currents for solved currents. Specialist result adapters now retain each parsed sample's NEC tag, segment number, XYZ position, magnitude, and phase.

This establishes result lineage and rendering behaviour; it is not independent validation of the NEC calculation. Absolute current depends on the deck's excitation. Tube thickness, glyph size, and brightness are normalised to the largest solved magnitude in the displayed run. The inspector reports the parsed value in A, mA, or µA and the legend states when a display quantity is normalised.

## Modes

- **Magnitude:** blue-to-red colour and thickness represent `|I| / max(|I|)` for the current run.
- **Phase:** cyclic colour represents the parsed phase from −180° through +180°; glyph/tube size is not presented as an absolute-current scale.
- **Combined:** phase colour plus magnitude-dependent thickness.
- **Animate phase:** each segment independently displays a slowed snapshot of `Re{I exp(jωt)} / max(|I|)`. Amber/cyan show instantaneous sign. This is a phasor teaching view, not literal RF-speed charge motion or propagation along a wire.

The former wire-average “Flow” particles were removed. They collapsed all segment results into one average per wire and could imply a travelling current that the solver output did not establish.

## Inspection and coordinates

Clicking a current tube selects the nearest solved segment; clicking a segment glyph selects that exact instance. The keyboard-accessible selector provides the same operation. The inspector identifies:

- wire/NEC tag;
- NEC segment number as emitted by the current parser;
- current magnitude with an explicit engineering unit;
- phase in degrees;
- NEC XYZ position in metres.

NEC coordinates are converted only at the Three.js boundary: `(x, y, z) -> (x, z, -y)`. Numeric inspection remains in NEC XYZ coordinates. A one-sample conductor is represented by its solved glyph; the view does not invent endpoints from that midpoint.

## Data paths

```text
NEC output current table
  -> shared SegmentCurrent parser record
  -> family result validator retains XYZ/magnitude/phase
  -> current-visualisation adapter (no sample generation)
  -> shared controls + segment-resolved Three.js renderer
```

The verified dipole, vertical, loop/quad/hex, Yagi, and phased-array pages use positioned-current adapters. The generic Simulator and Wire Editor already receive the shared `SegmentCurrent[]` directly. All current panels carry `data-current-source="nec-solver"` for integration assertions.

## Tests and reviews

Automated checks cover phase wrapping, magnitude normalisation, per-segment phasor animation, current-unit formatting, exact parametric position mapping, retention of parsed XYZ samples, invalid wire references/fractions, and selection/legend behaviour. A real-Wasm Playwright path solves and inspects one dipole, vertical, loop, Yagi, and phased-array model without console or page errors.

The existing independent NEC-2D antenna-family comparisons validate selected impedances and patterns, not complex current tables. Current-specific external validation remains required under `VALIDATION_PLAN.md`: compare complex segment currents from byte-identical decks against raw NEC reference output or an established package, using absolute tolerances near current nulls.

## Known limitations and manual checks

- The separate current plots retained on specialist pages remain for regression/context; the new 3D panel is the authoritative interactive segment inspector.
- Tube surfaces join solver sample centres. They are a visual aid, not physical conductor-radius geometry.
- Tags are called “wire” in the compact UI, although imported NEC decks may use one tag for a modelling purpose that is not a complete physical element.
- Phase is unstable/meaningless where magnitude is near numerical zero; a future view should visibly de-emphasise phase below a documented threshold.
- Three.js currently emits an upstream `THREE.Clock` deprecation warning and headless Chromium may emit WebGL readback performance warnings. The feature test rejects application console errors/page errors but does not relabel those third-party warnings as fixed.
- Manually verify click accuracy, camera interaction, colour perception, animation legibility, and inspector layout on Windows 11 with representative GPU/DPI combinations and keyboard-only navigation.
