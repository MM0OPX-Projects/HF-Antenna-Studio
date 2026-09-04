# Wire Editor

## Scope

The Wire Editor is the arbitrary-geometry path alongside the easier parametric template studio. Templates still generate the shared wire model and can be loaded into this editor; the editor does not create a second template-specific calculation pipeline.

The editor provides a fixed CAD-style 2D construction surface and a switchable 3D inspection/editing surface. Both views operate on the same typed wire model, undo history, sources, loads, junctions, validation, and results; switching views does not copy or convert the antenna. It does not add a new electromagnetic solver. Simulation continues through the same local NEC-2 Wasm worker selected for the v1 application.

## Coordinate and edit contract

- Canonical geometry uses right-handed NEC Cartesian coordinates in metres: X, Y, and Z, with +Z up.
- Precision construction defaults to the fixed **Front X/Z** plane, where Y is held at an explicitly displayed value. **Side Y/Z** holds X fixed, and **Top X/Y** holds Z fixed. The active plane, fixed coordinate, numbered grid, signed axes, cursor coordinates, origin crosshair, and `Z = 0` ground reference remain visible while drawing.
- The 2D canvas permits zooming with the wheel and panning with the middle button or Shift+drag without tilting the selected drawing plane. **Origin** recentres the empty workspace and **Fit** frames existing geometry. Origin, Cartesian-grid, and existing-endpoint snaps are visually distinguished.
- In Add mode, the cursor remains a crosshair over the empty 2D or 3D workspace, existing conductors and endpoint handles, so drawing mode stays visually distinct after the first wire is created. The first left-click starts a rubber-band wire and the second places it. Right-click or Escape cancels a pending first segment; during continuous-chain drawing it ends the chain without deleting completed wires. The draggable precision panel accepts synchronized exact length, in-plane angle and endpoint coordinates in metres, millimetres, feet or inches. Moving the pointer establishes direction; pressing `L` freezes that preview for length entry, and Enter places the wire without the pointer following the panel.
- In Select or Move mode, press and hold a wire body to translate that complete wire within the active 2D plane. An isolated wire moves rigidly and retains its orientation; when either end belongs to a persistent junction, that junction and the attached neighbouring wire endpoints move with it, deforming the connected polyline without breaking connectivity. Press and hold either endpoint circle to move only that end while the opposite end remains anchored; a bonded endpoint carries the other members of its junction. Release commits one undoable gesture; Escape or right-click cancels it. Endpoint snapping can create another persistent joined junction.
- In Select mode, double-clicking a normal conductor opens a local precision editor for full wire length, active-plane angle, start/end X/Y/Z coordinates, display units and the fixed length anchor. Values remain a private draft until **Apply** creates one undoable geometry change; Cancel, right-click or Escape makes no change. Managed radial conductors remain protected and direct the user to their radial-system controls. Tab and Shift+Tab cycle within both creation and existing-wire precision panels rather than escaping into unrelated page controls.
- Precision numeric inputs allow ordinary character-by-character Backspace/Delete editing, including a temporarily empty field. Valid partial entries update the preview; leaving a blank or invalid value restores the last valid number rather than forcing digits back during editing or applying invalid geometry.
- The **2D / 3D** control switches between precision construction and the retained orbiting 3D editor. The 3D editor continues to support wire selection and manipulation through the same antenna-object inspector. Right-click or Escape also cancels a pending 3D Add operation.
- Prominent **Undo** and **Redo** controls beside the view switch expose the same 100-step geometry history as Ctrl+Z/Ctrl+Y. A completed drag is one history step rather than one step per pointer movement.
- Normal 3D viewing hides endpoint spheres for a clean conductor view. Smaller endpoint handles appear only in Add/Move mode or when an endpoint is explicitly selected. The orange sphere is always retained because it marks the actual NEC source segment; the 3D legend names its wire and segment. The rendered conductor radius receives a modest editor-only visibility boost and emissive contrast, but the stored physical radius and generated NEC `GW` card are unchanged.
- After a pattern solve, the explicit **Pattern on/off** control beside the view buttons hides or restores the 3D radiation surface without discarding results. The grouped **Display** menu remains available for advanced shells, slice, currents, reflection and other layers.
- In the full-width analysis workspace, compact numerical summaries remain grouped at the left in aligned label/value columns. Wide plots, radiation cuts, Smith charts and genuinely tabular comparisons retain the available width.
- The Three.js view maps NEC `(x, y, z)` to view `(x, z, -y)`. The on-screen axis gizmo and coordinate legend display the NEC labels rather than exposing this rendering transform.
- The selected-object **Wire and Feedpoint Inspector** directly edits both X/Y/Z endpoints, diameter, segmentation, length, compass bearing, and elevation angle. Display units can be metres, millimetres, feet, or inches while canonical geometry remains SI. Length changes can keep the start, centre, or end fixed. The UI describes diameter as twice the stored radius where relevant; NEC `GW` cards store radius.
- Add, delete, endpoint move, whole-wire move, endpoint snap/connect, split, copy/paste, duplicate, translate, rotate, mirror-copy, and persistent junction locks share the Zustand editor command store and undo history.
- Delete removes tag-dependent sources, loads, and transmission lines. Split remaps those references and preserves manual segment totals where possible. Duplicate and mirror-copy clone sources/loads plus transmission lines whose two endpoints are wholly inside the copied selection.
- Numeric rotation is around the selected-wire endpoint centroid. Mirror deliberately creates a reflected copy and labels that behavior; it does not silently replace the source objects.
- Grid snapping can be disabled or selected from 1 mm through 1 m. Persistent endpoint snap/join is a separate option. Add mode can continue a connected polyline from the previous endpoint; the next endpoint highlights before selection and Escape ends the chain. During viewport drags, X/Y/Z constrain movement and Shift+X/Y/Z exclude an axis. Endpoint Snap and Keep Length are separate explicit operations.
- Perspective, top, front (X/Z), and side (Y/Z) camera presets remain available in the 3D view; they are inspection camera positions rather than substitutes for the fixed 2D drawing planes.
- The antenna object list has a visible Sources section showing the owning wire, exact NEC segment, requested/actual position, relative voltage magnitude, and phase. The 3D scene displays the adaptive ground grid, scale context, axes, sources, wire selection, and calculated overlays.
- The selected-wire inspector can attach a managed explicit radial system to Point 1 or Point 2. The chosen endpoint is the radial hub, the selected wire remains the driven radiator, every generated radial start is placed in one persistent junction, and the source is requested on the adjacent first/last radiator segment. Count, length, diameter, rotation, elevated droop, and near-surface clearance remain parametric; **Explode** deliberately converts the group to ordinary wires. Managed member wires cannot be independently edited, deleted, or fed until exploded.
- Elevated explicit radials may use perfect or finite ground and must remain wholly above it. Near-surface explicit radials are horizontal wires raised to a visible positive clearance over finite ground; they are never described as buried or exactly on soil. The ideal perfect-ground image and NEC's non-geometric radial-screen approximation remain separate specialist vertical-laboratory representations rather than being silently substituted in the arbitrary wire editor.
- Every managed radial is part of the same typed geometry sent to NEC and is rendered as an individual conductor in 2D and 3D—there is no decorative radial proxy. The 2D drawing uses a distinct radial stroke where the active projection separates the wires. The 3D view uses a consistent cyan radial colour, frames the complete field, and displays count, physical length, rotation, and either droop or near-surface clearance in its radial legend. Top view is normally the clearest count/rotation check; Front or Side view exposes elevated-radial droop.
- The 3D radiation bubble is anchored to the lowest physical point in the complete wire geometry, not to the feedpoint. This keeps centre-fed and end-fed models visually connected to the antenna while preserving the orange feed marker at its true NEC source segment. The convention is display-only; far-field calculations and source coordinates are unchanged.
- The editor exposes NEC `GE 0`, `GE -1`, and `GE 1` separately from `GN`. Automatic mode selects `GE 0` for free space, `GE 1` when an endpoint touches z=0, and `GE -1` for elevated geometry over ground. Imported GE values remain explicit.

## Sources and loads

Voltage sources can be placed by clicking or dragging along a wire, by entering a percentage from 0–100%, or by entering distance from the wire start. The editor retains the requested proportional position and safely remaps it when wire length or segmentation changes. It separately reports the requested point and the centre of the NEC segment that is actually excited. At 0% and 100%, NEC uses the first or last segment centre rather than the mathematical endpoint.

The fixed 2D editor has a dedicated **Place feedpoint** tool. It accepts a click or drag on a standalone wire or any leg of a connected polyline. The orange feed marker in both 2D and 3D identifies this requested physical connection—including an exact radial hub at 0% or 100%—while the inspector and 3D legend separately report the NEC segment centre where the `EX` card is applied. For an unbranched connected path, the inspector lists every leg and also accepts a reproducible distance along the complete path; crossing a junction moves the same source to the appropriate NEC wire while preserving relative magnitude and phase. Closed loops use the start of the lowest-numbered wire as an explicit distance datum. Branched networks allow deliberate leg selection but disable whole-path distance because more than one traversal is possible.

Multiple wires may carry sources. Relative voltage magnitude and phase are editable and are emitted as the real and imaginary values on NEC `EX` cards. An isolated end-position source produces an advisory warning to check for the intended counterpoise, second conductor, feed-line/common-mode path, or ground return; the editor does not silently invent that return path.

The load editor exposes only cards already accepted by the calculation adapter:

| NEC LD type | Editor meaning | Parameters |
|---:|---|---|
| 0 | Series RLC | resistance (ohms), inductance (henries), capacitance (farads) |
| 1 | Parallel RLC | resistance (ohms), inductance (henries), capacitance (farads) |
| 4 | Fixed complex impedance | resistance and reactance (ohms) |
| 5 | Wire conductivity | conductivity (siemens/metre) |

The editor validates the wire tag, segment range, finite values, and supported load type before enabling simulation. Represented transmission lines retain shunt terms and NEC's negative-impedance crossed-line convention. Exposing a card in the UI means it reaches generated NEC; it is not a claim that every load or transmission-line configuration has independent RF validation.

Imported `LD ... 0 0 0 ...` all-segment selection is retained. Absolute-segment addressing (`LDTAG=0` with non-zero segment indices) is blocked from structured editing because later arbitrary geometry edits can change NEC's global segment numbering; its original card remains in Original NEC.

## Loss-aware NEC import

NEC import first creates an ordered source report with line numbers, original card text, disposition, diagnostics, and the browser-decoded original file text. Code points and line endings are retained; arbitrary legacy encodings and byte-order marks are not claimed to round-trip byte-for-byte. Structured conversion is separate from text preservation.

### Structured subset

| Disposition | Cards / forms | Behavior |
|---|---|---|
| Represented | `GW`; `GE -1/0/1`; voltage-source `EX 0`; `LD 0/1/4/5`; `TL`; `GN -1/1/2`; linear `FR 0` | Converted to typed editor state without numeric clamping |
| Regenerated with report where material | `CM`, `CE`, `SY`, `PT`, `RP`, `EN` | Original text remains unchanged; generated export rebuilds control cards and expands `SY` expressions |
| Preserved only in original | `NE`, `NH`, `PQ`, `XQ`, content after `EN` | Structured antenna geometry may open, but these output requests are not claimed to survive generated export |
| Blocking | unsupported geometry/network/kernel cards, non-voltage `EX`, unsupported `GN`/`LD`/`FR` forms, malformed supported cards | Structured conversion is refused; the current editor model is not replaced |

The report explicitly counts represented, regenerated, preserved-only, and blocking cards. An unchanged imported model can download the exact original. After editing, the UI states that Generated NEC represents only supported editor state while Original NEC remains the unmodified source.

The importer does not:

- clamp imported wire segments, radius, frequencies, or coordinates;
- invent an excitation when no supported `EX` exists;
- silently discard parsed LD or TL data;
- substitute average ground for supported custom ground constants;
- open solver-significant unsupported cards as though conversion succeeded.

Multiple linear `FR` blocks are retained as the editor's multi-segment sweep and emitted as multiple generated frequency blocks. The wire-editor checkpoint introduced legacy `.antennasim` schema version 3 storage for the decoded NEC source/report, GE choice, frequency blocks, manual-segmentation/length-lock state, loads, transmission lines, and junctions. Schema v6 added managed radial-system identity without guessing that older loose wires were radials. Current `.hfas` schema v7 also retains reviewed specialist-Module provenance and its semantic transfer fingerprint without inventing an origin for older projects.

Imported segment counts are marked as manual overrides. Moving geometry therefore does not silently re-segment an imported design; the user can choose **Auto** on a wire to opt into the editor's frequency-based segmentation rule.

## Validation before calculation

Errors block calculation; warnings require interpretation but do not automatically block intentional models such as a Yagi with disconnected parasitic elements.

Checks include:

- empty geometry, duplicate tags, non-finite values, non-positive radii, non-integer segment counts, and zero-length wires;
- exact duplicates, partial collinear overlaps, and interior wire crossings;
- disconnected endpoint groups, labelled as possibly intentional;
- below-ground wires and ground-plane crossings for non-free-space ground;
- segment length versus wavelength, segment length versus radius, and total segment limits;
- missing, orphaned, duplicated, non-finite, or out-of-range sources;
- unsupported/orphaned/out-of-range loads;
- invalid transmission-line endpoints, impedance, or length;
- single-frequency and swept-frequency consistency.

Pairwise geometry analysis is bounded to the first 500 wires to keep the UI responsive; a warning states when this limit applies. The solver's separate segment limit still applies.

## Import and calculation pipeline

```text
browser-decoded NEC source text
  -> ordered loss-aware document/report
  -> structured-conversion gate
  -> typed editor model (SI)
  -> validation
  -> generated NEC deck
  -> local worker / pinned nec2c Wasm
  -> parsed impedance, SWR, pattern, gain, current and warning data
  -> existing 2D/3D result views
```

Raw source is retained for inspection/export but is not executed directly. This preserves the current safe structured-deck boundary; raw-deck execution requires a separate reviewed safe-card policy.

## Automated evidence

The feature test set includes:

- exact mixed-line-ending source retention;
- semantic structured round-trip of GW, GE, multiple EX-capable state, LD, TL, custom GN, and multiple FR blocks;
- large segment counts and small radii retained without import clamping;
- missing source retained as missing with a diagnostic;
- unsupported and malformed card conversion blocking;
- SY expression expansion diagnostics;
- duplicate/disconnected/overlap/intersection/ground/source/load/TL validation;
- translate/rotate/mirror-copy and undo behavior;
- project schema round-trip with unchanged browser-decoded NEC source text;
- managed radial hub geometry, count/length/rotation regeneration, near-surface clearance, source placement, undo, project migration, and a real local NEC solve;
- browser import report, object list, load UI, exact-original download, real Wasm solve, result rendering, and console-error checks.

The full test results and solver comparison status are recorded in the feature completion report and `VALIDATION_PLAN.md`; unit round-trips are regression evidence, not independent electromagnetic validation.

## Known limitations

- Only the published free-format subset above enters structured editing. Arcs, helices, geometry transforms/symmetry, networks, kernel controls, and other solver-specific cards remain raw-only/blocking.
- Generated NEC is deterministic application output, not a textual reconstruction of imported formatting, comments, symbols, or output requests. Use Original NEC to preserve the browser-decoded source text and line endings.
- Imported transmission-line details remain represented in typed state and generated NEC but do not yet have a dedicated arbitrary-network drawing interface.
- Clipboard paste currently copies geometry and contained junctions only. Use Duplicate or Mirror when attached sources, loads, and fully contained transmission lines must be cloned with the wires.
- A geometric interior crossing is not automatically split or declared connected.
- Snap-to-grid is Cartesian; angle, midpoint, intersection, and nearest-segment snapping are future work. Endpoint and origin snapping are explicit, and endpoint joins are persistent.
- Import parsing is bounded by browser memory but does not yet enforce the full native-host untrusted-file size policy proposed in the architecture.
- This feature adds interoperability and modelling-sanity tests. It does not make every arbitrary user model physically valid or independently validated.

## Adversarial review

The preferred bounded structured-editor approach was reviewed from the opposing position that HF Antenna Studio should either execute the imported deck unchanged or refuse NEC import entirely.

| Objection | Resolution / recorded issue |
|---|---|
| A generated deck can never be a lossless edit of arbitrary NEC. | Accepted. The UI separates Original NEC source text from Generated NEC and blocks solver-significant cards outside the published subset. It does not call generated text a round-trip of formatting or unsupported semantics. |
| A failed raw import could overwrite provenance for the currently open model. | Resolved by storing a refused raw-only document separately; the current model and its own source provenance remain unchanged. |
| Imported manual segmentation could be replaced on the first coordinate edit. | Resolved by marking imported segment counts as manual overrides until the user explicitly selects Auto. |
| `GE` and `GN` can contradict one another even when each card parses, and changing `GE 1` can alter ground-contact currents. | Resolved by representing `GE -1/0/1` in editor, project, solver, and export state; a cross-card consistency error blocks contradictory conversion. Multiple ordered GE or GN blocks also block conversion. |
| Multiple FR blocks could survive browser state but disappear through the alternate backend export route. | Resolved by passing frequency segments through both Wasm and FastAPI export contracts. |
| Retaining raw text inside native projects can increase project size or retain comments the user did not expect. | Accepted and documented. Source retention is local and intentional; future native packaging still needs file-size limits and a source-removal control. |
| O(n²) overlap checks can freeze arbitrary-geometry editing. | Mitigated by a 500-wire detailed-pair limit with an explicit warning. More scalable spatial indexing remains future work. |
| The original foundation expected a native process rather than browser/Wasm. | D-031 supersedes that sequence for v1 because the Wasm path has the complete application and package evidence. A future native adapter still requires full parity and safe raw-deck review. |
