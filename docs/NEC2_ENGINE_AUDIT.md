# NEC-2 engine audit

Date: 5 September 2026  
Runtime audited: bundled browser-local `nec2c` WebAssembly engine  
Branch: `feature/ground-radial-integration`

## Scope and method

This audit follows the complete supported path from application parameters through generated geometry/cards, the bundled NEC-2 solver, output parsing, derived results, and the user interface. Continuous numerical controls cannot be tested at literally every real-number value. The audit therefore uses boundary/equivalence-class validation, representative intermediate values, recorded engineering references, and direct real-solver execution.

The permanent real-solver matrix covers:

- all 17 registered general templates at their documented defaults;
- free space, perfect ground, every real-ground preset, and custom conductivity/permittivity;
- lossless, copper, aluminium, steel, stainless-steel, and custom conductor conductivity;
- 1°, 2°, 5°, and 10° far-field angular resolution;
- electrically scaled dipoles at 0.1, 0.5, 1.8, 3.5, 7.1, 14.1, 28.5, 54, 144, 432, and 2000 MHz, including both declared engine boundaries;
- a 101-point impedance-only frequency sweep;
- current output and complete radiation-pattern output;
- template-generated lumped loads, transmission lines, and multi-source models where those templates use them.

The wider integration suite additionally exercises validation failures, minimum/maximum UI limits, ground-contact rules, explicit radial wires (including high-count protection), source placement, physical and ideal phased feeds, cancellation/stale-result protection, NEC import/export, optimiser and parameter sweeps, current parsing, saved projects, measurement comparison, and reference-impedance calculations.

## Results

| Check | Result |
|---|---:|
| Unit/regression files | 82 passed |
| Unit/regression assertions | 759 passed |
| End-to-end/integration scenarios | 186 passed |
| Registered templates run through real NEC | 17/17 passed |
| Dedicated engine-variable real-NEC cases | 32/32 passed |
| TypeScript type check | Passed |
| ESLint | Passed with 0 errors and 26 existing React advisory warnings |
| Production WebAssembly build | Passed |

No reproducible NEC solver, request-generation, output-parsing, or result-association defect was found in the supported test matrix.

The first full UI run exposed stale regression-test assumptions following intentional interface changes: compact layouts hide the desktop material selector, the Wire Editor pattern-size control was deliberately removed, and the feedpoint legend was shortened. The tests—not the solver or application behaviour—were corrected. The clean 175-scenario rerun and the subsequent 11-case full-range extension passed, giving 186 passing scenarios in the final combined suite.

## Reference coverage

The full suite retains the existing independently recorded comparisons for the verified dipole, dipoles at multiple heights, 40/20/10 m verticals, ground-radial examples, loop/quad/Hexbeam families, 2/3/5-element Yagis, and classic phased-array cases. Details, tolerances, solver versions, and known evidence limits remain in `docs/VALIDATION_REPORT.md`.

## Limits of this conclusion

- A passing matrix proves the tested models and equivalence classes, not every conceivable arbitrary geometry or every floating-point value.
- NEC-2 thin-wire, ground, segmentation, and junction limitations still apply. The application validation can warn or block known invalid constructions but cannot make NEC-2 physically suitable for buried wires or every real installation.
- The legacy optional FastAPI/native-NEC backend is not the packaged Windows calculation runtime and was not executed in this audit; the release path uses the bundled browser-local WebAssembly solver.
- ESLint reports 26 non-blocking React advisory warnings in existing UI rendering/interaction code. There are no lint errors, and the affected workflows pass integration tests; these warnings are not evidence of an NEC numerical defect.

## Permanent regression additions

- `frontend/e2e/nec-template-matrix.spec.ts`
- `frontend/e2e/nec-engine-variables.spec.ts`

These tests must remain release-blocking so future changes cannot silently break a template, ground type, material, angular resolution, current extraction, pattern extraction, or ordinary batched sweep.
