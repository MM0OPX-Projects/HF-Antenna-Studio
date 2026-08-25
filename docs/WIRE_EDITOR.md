# Wire Editor

## Scope

The Wire Editor is the arbitrary-geometry path alongside the easier parametric template studio. Templates still generate the shared wire model and can be loaded into this editor; the editor does not create a second template-specific calculation pipeline.

This feature extends the inherited editor instead of replacing its already useful 3D interaction, junction, measurement, results, and project components. It does not add a new electromagnetic solver. Simulation continues through the same local NEC-2 Wasm worker selected for the v1 application.

## Coordinate and edit contract

- Canonical geometry uses right-handed NEC Cartesian coordinates in metres: X, Y, and Z, with +Z up.
- The Three.js view maps NEC `(x, y, z)` to view `(x, z, -y)`. The on-screen axis gizmo and coordinate legend display the NEC labels rather than exposing this rendering transform.
- Numeric endpoints, radius, and segments are editable. The UI describes diameter as twice the stored radius where relevant; NEC `GW` cards store radius.
- Add, delete, endpoint move, whole-wire move, endpoint snap/connect, split, copy/paste, duplicate, translate, rotate, mirror-copy, and persistent junction locks share the Zustand editor command store and undo history.
- Delete removes tag-dependent sources, loads, and transmission lines. Split remaps those references and preserves manual segment totals where possible. Duplicate and mirror-copy clone sources/loads plus transmission lines whose two endpoints are wholly inside the copied selection.
- Numeric rotation is around the selected-wire endpoint centroid. Mirror deliberately creates a reflected copy and labels that behavior; it does not silently replace the source objects.
- Grid snapping can be disabled or selected from 1 mm through 1 m. During viewport drags, X/Y/Z constrain movement and Shift+X/Y/Z exclude an axis. Endpoint Snap and Keep Length are separate explicit operations.
- The antenna object list marks wires that own a source or lumped load. The 3D scene displays the adaptive ground grid, scale context, axes, sources, wire selection, and calculated overlays.
- The editor exposes NEC `GE 0`, `GE -1`, and `GE 1` separately from `GN`. Automatic mode selects `GE 0` for free space, `GE 1` when an endpoint touches z=0, and `GE -1` for elevated geometry over ground. Imported GE values remain explicit.

## Sources and loads

Voltage sources can be placed on an exact wire segment numerically or by picking a segment in 3D. Source segment references are validated after every relevant model change.

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

Multiple linear `FR` blocks are retained as the editor's multi-segment sweep and emitted as multiple generated frequency blocks. The wire-editor checkpoint introduced legacy `.antennasim` schema version 3 storage for the decoded NEC source/report, GE choice, frequency blocks, manual-segmentation/length-lock state, loads, transmission lines, and junctions. Current `.hfas` schema v5 retains those editor fields unchanged.

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
- browser import report, object list, load UI, exact-original download, real Wasm solve, result rendering, and console-error checks.

The full test results and solver comparison status are recorded in the feature completion report and `VALIDATION_PLAN.md`; unit round-trips are regression evidence, not independent electromagnetic validation.

## Known limitations

- Only the published free-format subset above enters structured editing. Arcs, helices, geometry transforms/symmetry, networks, kernel controls, and other solver-specific cards remain raw-only/blocking.
- Generated NEC is deterministic application output, not a textual reconstruction of imported formatting, comments, symbols, or output requests. Use Original NEC to preserve the browser-decoded source text and line endings.
- The structured UI does not yet edit arbitrary source voltage magnitude/phase or imported transmission-line details, although represented values remain in typed state and generated NEC.
- Clipboard paste currently copies geometry and contained junctions only. Use Duplicate or Mirror when attached sources, loads, and fully contained transmission lines must be cloned with the wires.
- A geometric interior crossing is not automatically split or declared connected.
- Snap-to-grid is Cartesian; angle, midpoint, and nearest-segment snapping are future work.
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
