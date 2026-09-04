# Conductor-material presets

HF Antenna Studio applies a finite-conductivity conductor preset, when selected, as an NEC `LD 5` wire-conductivity card. NEC defines the `LD 5` value as conductivity in mhos/metre (equivalent to S/m); see the [NEC-2 Users Manual, Part III](https://www.nec2.org/other/nec2prt3.pdf), section “Loading (LD)”. The application does not model plating, oxide layers, temperature, skin-effect surface roughness, joints, clamps, or nearby dissimilar metals.

## Presets and evidence

The values below are engineering approximations at approximately room temperature, not material certificates or alloy identification.

| Preset | Application value | Approx. IACS* | Interpretation |
|---|---:|---:|---|
| Copper | 5.80 × 10⁷ S/m | 99.8% | Representative high-purity/annealed copper. The [IACS reference](https://ihiconnectors.com/IACS-conductivity-electrical-alloys.htm) defines 100% IACS as 58.108 MS/m at 20 °C. |
| Aluminium | 3.54 × 10⁷ S/m | 60.9% | Representative high-conductivity aluminium, close to commonly tabulated pure aluminium. A specific alloy such as 6061-T6 can be materially lower. |
| Steel | 1.03 × 10⁷ S/m | 17.7% | Generic steel/iron-scale approximation. Carbon and low-alloy steels vary substantially; this is not a claim for every steel grade. |
| Stainless steel | 1.10 × 10⁶ S/m | 1.9% | Low-conductivity stainless approximation. Austenitic, ferritic and martensitic grades differ significantly. |
| Perfect conductor | lossless | — | No `LD 5` loss card is emitted. This is an idealisation, not a physical material. |
| Custom conductivity | user supplied | — | Use when the wire alloy, temperature or measured value is known. |

\* IACS percentages use 58.108 MS/m as 100% IACS and are shown only to communicate scale; they do not identify an alloy.

The [NEC-2 online example](https://www.nec2.org/part_3/examples/ex2.html) demonstrates the same `LD 5` mechanism with an aluminium example at 3.720 × 10⁷ S/m. That difference from the application’s generic aluminium preset is an expected approximation, not evidence that one value is universally correct. Published engineering tables likewise show carbon-steel and stainless-steel values spanning wide ranges, so those presets must remain labelled generic.

## Engineering guidance

- For ordinary HF wire-loss estimates, Copper is a reasonable default when the actual conductor is copper or a similar high-conductivity alloy.
- Select Aluminium only when the physical wire/tube is aluminium; do not use it as a synonym for copper-clad steel.
- Treat Steel and Stainless steel results as sensitivity cases unless the alloy/grade is known.
- Compare Perfect conductor and finite-conductivity runs when loss is important. Differences can be smaller than other modelling uncertainties for short, thick HF conductors, but must not be assumed negligible.
- Record the selected preset or custom value with any published result. A simulated material choice cannot compensate for feedline loss, common-mode current, connectors, joints, corrosion, or construction details.

These presets are solver inputs, not independently validated claims of total antenna efficiency. Product-level validation still requires comparing finite-conductivity models against trusted NEC examples or measurements with the material and geometry documented.
