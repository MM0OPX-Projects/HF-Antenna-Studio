# Professional UI Workbench

Status: implemented application-shell and Simulator workbench checkpoint on `feature/ui-overhaul`; broader packaged-Windows usability evidence remains outstanding.

## Purpose and claim boundary

HF Antenna Studio now uses an original desktop engineering-workbench layout. It is informed by the needs of antenna modelling—persistent parameters, a large spatial view, visible result provenance, and plot comparison—not by the artwork or exact arrangement of AN-SOF, EZNEC, 4NEC2, or another commercial application. No third-party interface artwork or assets were introduced.

This change does not alter antenna geometry, NEC card generation, solver invocation, parsing, or RF calculations. A professional visual hierarchy is not numerical validation. Solver and model limitations remain governed by the validation documents for each antenna family.

## Desktop layout

At 1280 CSS pixels and wider the main Simulator has four distinct regions:

| Region | Purpose | Behaviour |
|---|---|---|
| Left: **Model inputs** | Project, antenna, environment/feed, frequency request, and contextual guidance | Independently scrollable, collapsible, and horizontally resizable from 260–440 px |
| Centre: **Design workspace** | Interactive wire geometry, ground, measurements, and optional current/pattern overlays | Receives remaining space; never shares its surface with editable model fields |
| Right: **Calculated values** | Current-result status, input-condition recap, R, X, SWR, gain, direction, and diagnostics | Independently scrollable, collapsible, and horizontally resizable from 250–420 px |
| Bottom: **Analysis** | SWR, impedance, Smith, pattern, gain, band, and matching tabs | Vertically resizable from 180–420 px and collapsible |

The summary deliberately repeats the solved frequency, ground type, antenna, and segment count next to calculated values. This reduces the risk of interpreting a result without its conditions. When a model or ground input changes, the existing simulation-store invalidation clears the old result; the status changes to **Not calculated** and numerical result cards are withheld.

The 1024–1279 px landscape layout retains the established three-pane workspace with narrower side panels. Below 1024 px the geometry remains primary and controls/results move into a keyboard-operable bottom tab panel. Tablet support is secondary; phones remain usable but are not the Windows-first optimisation target.

## Interaction

Resizable dividers support pointer, touch, and keyboard operation. Arrow keys adjust a focused divider by 16 px, `Home` and `End` select its minimum and maximum, and double-click restores the documented default. Collapse buttons remain available on each region.

Workspace shortcuts are:

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` | Run the current NEC calculation |
| `Ctrl+Shift+L` | Toggle model inputs |
| `Ctrl+Shift+R` | Toggle calculated summary |
| `Ctrl+Shift+B` | Toggle analysis |
| `?` | Open shortcut help |
| `Escape` | Close shortcut help |

Standard viewport shortcuts remain documented inside the shortcut dialog. Form editing takes precedence, so ordinary keystrokes in text fields, selectors, and numeric controls do not toggle panels.

## Visual system

The light and dark palettes use locally available Windows system fonts (`Segoe UI Variable` with `Segoe UI` fallback, and `Cascadia Mono` with `Consolas` fallback). No font, image, or UI dependency is downloaded at runtime. The original waveform mark is an inline project-authored SVG.

Colour roles distinguish neutral work surfaces, editable controls, selection/action accent, and diagnostic severities. Text labels such as **Results current**, **Calculation failed**, **Warning**, and **NEC warning** accompany colour and symbols. Inputs use ordinary UI typography; computed engineering numbers use tabular monospace typography. Unit suffixes remain attached to every primary result and parameter controls retain their unit selectors/labels.

## Accessibility contract

- Every resizer exposes separator orientation and minimum/current/maximum values.
- Result and calculation status text is announced through polite live regions.
- Tabs use `tablist`, `tab`, `aria-selected`, roving focus, arrow keys, `Home`, and `End`.
- Collapsible inspectors expose `aria-expanded` and controlled-region relationships.
- Icon-only theme, warning-dismiss, help, and close actions have accessible names.
- A visible two-pixel focus ring is applied consistently.
- Essential result state is never conveyed only by colour.
- The keyboard-help overlay is a named modal dialog and closes with `Escape`.

Charts remain a known accessibility limitation: several inherited chart views rely mainly on SVG/canvas graphics and hover inspection. Their exact-value tables and textual summaries must be expanded before a future accessibility support claim.

## Usability review loops

### Loop 1 — information architecture

Review found that the prior 1280 px view gave equal prominence to controls, geometry, and a largely empty results panel. Resolution: the geometry receives flexible centre space; inputs and results have explicit labels; plots move to a bottom analysis region; and empty calculated values say why they are empty.

### Loop 2 — calculation truthfulness

Review found that colour or a retained chart could make result currency ambiguous. Resolution: model/ground changes continue to clear the simulation store; summary values render only for `success`; the top and bottom status text says **Not calculated**, **Calculating**, **Results current**, or **Calculation failed**.

### Loop 3 — desktop density

Review found that always-expanded ground, feed, frequency, tips, and project controls produced a very long inspector. Resolution: model and frequency start open, less-frequent environment/feed and help sections are collapsible, and panel scrolling is independent of the viewer and calculate action.

### Loop 4 — responsive/GPU behaviour

Review found that rendering desktop and compact layouts with CSS alone would mount two Three.js canvases. Resolution: a media-query state selects one layout, so only one WebGL viewer is mounted. Tablet side panels were reduced to 288 px.

### Loop 5 — keyboard and non-colour use

Review added labelled resizers, region shortcuts, keyboard tabs, dialog semantics, explicit diagnostic words, and focus treatment. Automated browser checks cover the main paths, but manual Windows screen-reader and high-contrast testing remains required.

## Verification

Automated coverage includes:

- panel-size clamping, direction, and keyboard deltas;
- desktop region presence and exactly one WebGL canvas;
- keyboard panel resize and collapse/restore;
- shortcut-dialog keyboard operation;
- real local Wasm NEC calculation reaching explicitly labelled results;
- theme switching with textual calculation state;
- 1024 px and 768 px responsive sanity checks;
- console-error capture and narrow-layout horizontal-overflow check;
- the full existing unit, integration, solver-validation, and browser regression suites.

Passing these checks establishes application behaviour in the test environment. It does not yet establish visual quality across representative Windows DPI scaling, GPUs, touch hardware, assistive technologies, or the eventual packaged desktop runtime.

## Known limitations and manual checks

- Panel sizes and collapsed states are session state only; persistence is intentionally deferred until preferences have a versioned local schema.
- The professional four-region workbench currently applies to the main Simulator. Specialist laboratories share the global navigation, palette, focus treatment, and controls but retain their purpose-built layouts.
- Dragging resizers still requires manual Windows pointer/touch review; automated tests exercise the sizing functions plus synthetic pointer and keyboard paths.
- Test Windows 11 at 100%, 125%, 150%, and 200% display scaling, with a small and a large desktop monitor.
- Test Edge/WebView2 GPU acceleration and software rendering with dense current and 3D radiation surfaces.
- Test Windows High Contrast, reduced motion, keyboard-only navigation, Narrator, and at least one additional screen reader.
- Confirm every chart has an inspectable exact-value alternative before an accessibility conformance claim.
- Confirm all offline help and eventual packaged assets remain bundled and no runtime request leaves the computer.
