# EFHW template

The End-Fed Half-Wave template is shared by the Design simulator and the Wire Editor template loader. It generates a continuous half-wave radiator in one of four arrangements: horizontal, sloper, inverted-V, or vertical.

## Feed end

`End A` excites the first radiator wire/segment. `End B` excites the final radiator wire/segment. In an inverted-V, the two radiator wires meet at the apex; the source remains at the selected terminal. The explicit counterpoise, when enabled, is attached to that same terminal.

NEC-2 excites a segment centre, not a mathematical endpoint. The UI therefore reports the requested terminal and the actual NEC segment separately.

## Dimensions and orientation

Frequency-derived length is `0.5λ × 0.97` and is a starting dimension only. Selecting Manual length uses the entered total radiator length. Horizontal models hold both ends at the feed height. Slopers use End A and End B heights. Inverted-V models split the length at the configured apex percentage and use the apex height, end heights, bearing, and included angle. Vertical models run from the configured End A height upward.

## Matching and limitations

The default 49:1 unun is an ideal impedance transformation applied to the solved feed result. Transformer loss, winding parasitics, feed-line common-mode current, supports, and construction hardware are not included. An EFHW without a counterpoise, feed-line return, or other explicit return path is electrically incomplete and should be treated as a warning condition, not a construction prediction.

Existing projects without the new orientation/feed parameters retain the historical sloper geometry through template defaults when reopened; new parameters are added only when the EFHW template is regenerated.
